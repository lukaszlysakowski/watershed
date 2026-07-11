// Watershed — fold-field terrain drained by flow accumulation.
// Family: palimpsest / core-samples / second-reading / fold.

const CS = 2170;
const PAD = Math.round(CS * 0.04);
const PAPER = '#F7E6D4';
const INK = '#1A1613';
const INK_RGB = [26, 22, 19];
const RED = '#A93B2A';
// Density → accumulation threshold (upstream cells) at N=400, scaled by area.
const TBASE = [640, 288, 128, 56]; // Sparse / Medium / Dense / Flood

const CONTROL_DEFS = [
    { key: 'folds',     label: 'Folds',     opts: ['random', '2', '3', '4'],              def: 0 },
    { key: 'character', label: 'Character', opts: ['Soft', 'Mixed', 'Sharp'],             def: 1 },
    { key: 'rough',     label: 'Roughness', opts: ['Low', 'Med', 'High'],                 def: 1 },
    { key: 'density',   label: 'Density',   opts: ['Sparse', 'Medium', 'Dense', 'Flood'], def: 2 },
    { key: 'detail',    label: 'Detail',    opts: ['320', '400', '480'],                  def: 1 },
    { key: 'contours',  label: 'Contours',  opts: ['Off', 'Whisper', 'Light'],            def: 1 },
    { key: 'basins',    label: 'Basins',    opts: ['Off', 'Major', 'All'],                def: 1 },
    { key: 'wobble',    label: 'Wobble',    opts: ['Off', 'On'],                          def: 0 }
];

const ui = { folds: 0, character: 1, rough: 1, density: 2, detail: 1, contours: 1, basins: 1, wobble: 0 };

const state = {
    masterSeed: 1,
    folds: [],
    detail: null,
    kBasins: 2,
    keptCount: 0,
    grid: { N: 0, cell: 0 },
    terr: null,
    filled: null,
    dir: null,
    accum: null,
    threshold: 0,
    label: null,
    streams: [],
    divide: [],
    contours: []
};

const ctrlButtons = {};

// --- pipeline hooks (filled in by later tasks) ---

// Fold's fold field, reused as relief (source: fold/index.js, read-only).
function foldZ(folds, x, y) {
    let z = 0;
    for (const f of folds) {
        const t = x * Math.cos(f.theta) + y * Math.sin(f.theta);
        if (f.kind === 'sine') z += f.amp * Math.sin(t * f.freq + f.phase);
        else z += f.amp * Math.max(0, 1 - Math.abs(t - f.c) / f.w);
    }
    return z;
}

// Seeded 3-octave value noise — self-contained so canvas and harness agree exactly.
function makeNoise2D(seed) {
    function hash(ix, iy) {
        let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 974634167)) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    const smooth = t => t * t * (3 - 2 * t);
    function vnoise(x, y) {
        const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
        const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
        const u = smooth(fx), v = smooth(fy);
        return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
    }
    return function fbm(x, y) {
        return (vnoise(x, y) + 0.5 * vnoise(x * 2.13 + 31.7, y * 2.13 + 11.3) +
            0.25 * vnoise(x * 4.31 + 7.7, y * 4.31 + 53.1)) / 1.75;
    };
}

function terrainZ(wx, wy) {
    const d = state.detail;
    return foldZ(state.folds, wx, wy) +
        d.amp * ((d.fbm(wx * d.ns + d.ox, wy * d.ns + d.oy) - 0.5) * 2);
}

function rollTerrain() {
    const nOpt = CONTROL_DEFS[0].opts[ui.folds];
    const n = nOpt === 'random' ? Math.floor(random(2, 5)) : parseInt(nOpt, 10);
    state.folds = [];
    for (let i = 0; i < n; i++) {
        const wantSharp = ui.character === 0 ? false
            : ui.character === 2 ? (i === 0 || random() < 0.6)
            : random() < 0.4;
        const theta = random(Math.PI * 2);
        const amp = random(90, 240);
        if (wantSharp) {
            state.folds.push({ kind: 'sharp', theta, amp, c: random(-600, 600), w: random(150, 450) });
        } else {
            state.folds.push({ kind: 'sine', theta, amp, freq: random(0.002, 0.006), phase: random(Math.PI * 2) });
        }
    }
    const maxAmp = Math.max(...state.folds.map(f => f.amp));
    state.detail = {
        amp: [0.10, 0.15, 0.22][ui.rough] * maxAmp,
        ns: random(0.004, 0.008),
        ox: random(1000),
        oy: random(1000),
        fbm: makeNoise2D(state.masterSeed + 7919)
    };
    state.kBasins = Math.floor(random(2, 5));
}

function buildGrid() {
    const N = [320, 400, 480][ui.detail];
    const cell = (CS - 2 * PAD) / N;
    const terr = new Float64Array(N * N);
    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            const px = PAD + (x + 0.5) * cell, py = PAD + (y + 0.5) * cell;
            terr[y * N + x] = terrainZ(px - CS / 2, py - CS / 2);
        }
    }
    state.grid = { N, cell };
    state.terr = terr;
}

// --- Hydrology: priority-flood, D8 flow, accumulation ---

const DX = [-1, 0, 1, -1, 1, -1, 0, 1];
const DY = [-1, -1, -1, 0, 0, 1, 1, 1];
const DDIST = [Math.SQRT2, 1, Math.SQRT2, 1, 1, Math.SQRT2, 1, Math.SQRT2];

// Binary min-heap keyed by (height, insertion order) — deterministic pops.
class MinHeap {
    constructor() { this.k = []; this.s = []; this.v = []; this.seq = 0; }
    size() { return this.k.length; }
    push(key, val) {
        this.k.push(key); this.s.push(this.seq++); this.v.push(val);
        let i = this.k.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this._less(i, p)) { this._swap(i, p); i = p; } else break;
        }
    }
    pop() {
        const top = this.v[0];
        const last = this.k.length - 1;
        this._swap(0, last);
        this.k.pop(); this.s.pop(); this.v.pop();
        let i = 0;
        while (true) {
            const l = 2 * i + 1, r = l + 1;
            let m = i;
            if (l < this.k.length && this._less(l, m)) m = l;
            if (r < this.k.length && this._less(r, m)) m = r;
            if (m === i) break;
            this._swap(i, m); i = m;
        }
        return top;
    }
    _less(a, b) { return this.k[a] < this.k[b] || (this.k[a] === this.k[b] && this.s[a] < this.s[b]); }
    _swap(a, b) {
        [this.k[a], this.k[b]] = [this.k[b], this.k[a]];
        [this.s[a], this.s[b]] = [this.s[b], this.s[a]];
        [this.v[a], this.v[b]] = [this.v[b], this.v[a]];
    }
}

// Barnes 2014 priority-flood: raise pits to spill level + EPS so every cell drains to the border.
function priorityFlood(terr, N) {
    const filled = new Float64Array(terr);
    const visited = new Uint8Array(N * N);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < terr.length; i++) {
        if (terr[i] < lo) lo = terr[i];
        if (terr[i] > hi) hi = terr[i];
    }
    const EPS = Math.max(hi - lo, 1) * 1e-6;
    const heap = new MinHeap();
    const seed = i => { if (!visited[i]) { visited[i] = 1; heap.push(filled[i], i); } };
    for (let x = 0; x < N; x++) { seed(x); seed((N - 1) * N + x); }
    for (let y = 0; y < N; y++) { seed(y * N); seed(y * N + N - 1); }
    while (heap.size()) {
        const i = heap.pop();
        const cx = i % N, cy = (i - cx) / N;
        for (let k = 0; k < 8; k++) {
            const nx = cx + DX[k], ny = cy + DY[k];
            if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
            const n = ny * N + nx;
            if (visited[n]) continue;
            visited[n] = 1;
            filled[n] = Math.max(terr[n], filled[i] + EPS);
            heap.push(filled[n], n);
        }
    }
    return filled;
}

function computeD8(filled, N) {
    const dir = new Int32Array(N * N).fill(-1);
    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            const i = y * N + x;
            let best = -1, bestSlope = 0;
            for (let k = 0; k < 8; k++) {
                const nx = x + DX[k], ny = y + DY[k];
                if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
                const n = ny * N + nx;
                const slope = (filled[i] - filled[n]) / DDIST[k];
                if (slope > bestSlope) { bestSlope = slope; best = n; }
            }
            dir[i] = best; // -1 only where no strictly lower neighbor exists (border outlets)
        }
    }
    return dir;
}

function computeAccum(filled, dir, N) {
    const order = Array.from({ length: N * N }, (_, i) => i)
        .sort((a, b) => filled[b] - filled[a] || a - b);
    const accum = new Float64Array(N * N).fill(1);
    for (const i of order) if (dir[i] >= 0) accum[dir[i]] += accum[i];
    return accum;
}

function runHydrology() {
    const { N } = state.grid;
    state.filled = priorityFlood(state.terr, N);
    state.dir = computeD8(state.filled, N);
    state.accum = computeAccum(state.filled, state.dir, N);
    state.threshold = Math.max(8, Math.round(TBASE[ui.density] * (N * N) / 160000));
}

function cellPt(i) {
    const { N, cell } = state.grid;
    const x = i % N, y = (i - x) / N;
    return {
        x: PAD + (x + 0.5) * cell + jitterHash(i, 1) * 0.7 * cell,
        y: PAD + (y + 0.5) * cell + jitterHash(i, 2) * 0.7 * cell
    };
}

function buildStreams() {
    const { N } = state.grid;
    const acc = state.accum, dir = state.dir;
    const T = state.threshold;
    const clsOf = a => a >= 40 * T ? 2 : a >= 8 * T ? 1 : 0;
    const isChan = i => acc[i] >= T;

    // channel heads: channel cells with no upstream channel neighbor
    const heads = [];
    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            const i = y * N + x;
            if (!isChan(i)) continue;
            let hasUp = false;
            for (let k = 0; k < 8 && !hasUp; k++) {
                const nx = x + DX[k], ny = y + DY[k];
                if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
                const n = ny * N + nx;
                if (isChan(n) && dir[n] === i) hasUp = true;
            }
            if (!hasUp) heads.push(i);
        }
    }
    heads.sort((a, b) => acc[b] - acc[a] || a - b); // main stems first

    const drawn = new Uint8Array(N * N);
    state.streams = [];
    for (const h of heads) {
        if (drawn[h]) continue;
        const cells = [h];
        let i = h;
        while (dir[i] >= 0) {
            const nx = dir[i];
            cells.push(nx);
            if (drawn[nx]) break; // junction with an already-drawn channel
            i = nx;
        }
        for (const c of cells) drawn[c] = 1;
        if (cells.length < 2) continue;
        // split into constant-class runs; an edge takes its upstream cell's class
        let runCls = clsOf(acc[cells[0]]);
        let run = [cellPt(cells[0])];
        for (let e = 0; e < cells.length - 1; e++) {
            const cls = clsOf(acc[cells[e]]);
            if (cls !== runCls) {
                state.streams.push({ cls: runCls, pts: run });
                run = [run[run.length - 1]];
                runCls = cls;
            }
            run.push(cellPt(cells[e + 1]));
        }
        state.streams.push({ cls: runCls, pts: run });
    }
}
function buildBasins() {}
function buildDivide() {}
function buildContours() {}

function regenerate(newSeed) {
    if (newSeed) state.masterSeed = Math.floor(Math.random() * 1e9);
    randomSeed(state.masterSeed);
    rollTerrain();
    buildGrid();
    runHydrology();
    buildStreams();
    buildBasins();
    buildDivide();
    buildContours();
    renderAll();
}

// Deterministic per-cell hash → [-0.5, 0.5)
function jitterHash(idx, salt) {
    let h = (Math.imul(idx, 2654435761) ^ Math.imul(state.masterSeed + salt, 40503)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    return h / 4294967296 - 0.5;
}

function wobblePts(pts) {
    if (!ui.wobble) return pts;
    randomSeed(pts[0].x * 0.01 + 50);
    return pts.map(p => ({ x: p.x + random(-1.2, 1.2), y: p.y + random(-1.2, 1.2) }));
}

function drawPoly(pts) {
    const w = wobblePts(pts);
    beginShape();
    for (const p of w) vertex(p.x, p.y);
    endShape();
}

function signatureText() {
    const d = new Date();
    const p2 = n => String(n).padStart(2, '0');
    return `Watershed · seed ${state.masterSeed} · ${state.keptCount} basins · ${state.folds.length} folds  ` +
        `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

function renderAll() {
    background(PAPER);
    noFill();
    // contours (whisper apparatus)
    if (state.contours.length) {
        stroke(INK_RGB[0], INK_RGB[1], INK_RGB[2], ui.contours === 1 ? 60 : 90);
        strokeWeight(0.7);
        for (const pl of state.contours) drawPoly(pl);
    }
    // streams, fine → trunk
    const sw = [1.1, 1.8, 2.6];
    stroke(INK);
    for (let cls = 0; cls <= 2; cls++) {
        strokeWeight(sw[cls]);
        for (const s of state.streams) if (s.cls === cls) drawPoly(s.pts);
    }
    // red divide
    if (state.divide.length) {
        stroke(RED);
        strokeWeight(2.6);
        for (const pl of state.divide) drawPoly(pl);
    }
    // border + signature
    stroke(INK);
    strokeWeight(2.2);
    rect(PAD, PAD, CS - 2 * PAD, CS - 2 * PAD);
    noStroke();
    fill(INK);
    textSize(26);
    textAlign(LEFT, BASELINE);
    text(signatureText(), PAD, CS - PAD + 44);
    noFill();
}

function syncControlButtons() {
    for (const def of CONTROL_DEFS) {
        if (ctrlButtons[def.key]) ctrlButtons[def.key].textContent = def.opts[ui[def.key]];
    }
}

function randomizeAll() {
    for (const def of CONTROL_DEFS) {
        if (def.key === 'detail' || def.key === 'wobble') continue;
        ui[def.key] = Math.floor(Math.random() * def.opts.length);
    }
    syncControlButtons();
    regenerate(true);
}

function setupControls() {
    const panel = document.getElementById('controls');
    for (const def of CONTROL_DEFS) {
        const row = document.createElement('div');
        row.className = 'ctrl';
        const lab = document.createElement('span');
        lab.className = 'ctrl-name';
        lab.textContent = def.label;
        const btn = document.createElement('button');
        btn.className = 'ctrl-val';
        btn.textContent = def.opts[ui[def.key]];
        btn.addEventListener('click', () => {
            ui[def.key] = (ui[def.key] + 1) % def.opts.length;
            btn.textContent = def.opts[ui[def.key]];
            regenerate(false);
        });
        ctrlButtons[def.key] = btn;
        row.appendChild(lab);
        row.appendChild(btn);
        panel.appendChild(row);
    }
    document.getElementById('btn-random').addEventListener('click', randomizeAll);
    document.getElementById('btn-refresh').addEventListener('click', () => regenerate(true));
    document.getElementById('btn-svg').addEventListener('click', () => exportSVG());
    document.getElementById('btn-png').addEventListener('click', () => exportPNG(1));
    document.getElementById('btn-png4').addEventListener('click', () => exportPNG(4));
}

// export stubs — Task 8 replaces these
function exportSVG() {}
function exportPNG(scale) {}

function setup() {
    const c = createCanvas(CS, CS);
    c.parent('canvas-container');
    pixelDensity(1);
    noLoop();
    setupControls();
    regenerate(true);
}

function draw() {}

function mousePressed() {
    if (mouseX >= 0 && mouseX <= CS && mouseY >= 0 && mouseY <= CS) regenerate(true);
}
