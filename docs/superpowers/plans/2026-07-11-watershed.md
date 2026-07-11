# Watershed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A p5.js plotter-art maker: fold-field terrain drained by flow accumulation — dendritic ink stream trees over whisper contours, red divide, family maker UI, SVG pen passes + PNG export.

**Architecture:** Single `index.js` (+ `index.html`, vendored `p5.min.js`, no build step). Pipeline per regenerate: `rollTerrain → buildGrid → runHydrology (priority-flood → D8 → accumulation) → buildStreams → buildBasins → buildDivide → buildContours → renderAll`. All geometry lives in `state` arrays consumed identically by the canvas renderer and the SVG exporter.

**Tech Stack:** p5.js (vendored), vanilla JS, Node harness (`vm.runInContext` + p5-stub) for verification.

**Spec:** `docs/superpowers/specs/2026-07-11-watershed-design.md` (approved).

## Global Constraints

- Canvas `CS = 2170`, `PAD = Math.round(CS * 0.04)` (= 87). Paper `#F7E6D4`, ink `#1A1613` (rgb 26,22,19), red `#A93B2A`. Red appears ONLY in the Divide pass.
- Determinism contract: `Math.random` ONLY at seed choice (`regenerate(true)`) and `randomizeAll`. Everything downstream of `randomSeed(state.masterSeed)` is deterministic. Cell jitter and wobble use seeded hashes/reseeds, never `Math.random`.
- Wobble parity: canvas and SVG both wobble via `wobblePts`, seeded from `pts[0].x * 0.01 + 50`. Default OFF.
- SVG pen passes, exact labels and weights: Border ink 0.9 · Contours ink 0.35 · Streams-fine ink 0.45 · Streams-mid ink 0.7 · Streams-trunk ink 1.0 · Divide red 1.0 · Signature ink. Paths are M/L-only.
- Signature: `Watershed · seed N · <k> basins · <f> folds  YYYY-MM-DD HH:MM`.
- A11y floor: sidebar CSS copied from Fold (`--muted: #969082`, `.ctrl` min-height 24px). Never regress.
- Read-only sources (NEVER modify): `/Users/lukasz/genuary-2026/sketches/fold/*`, `/Users/lukasz/genuary-2026/sketches/second-reading/*`, `/Users/lukasz/genuary-2026/sketches/palimpsest/*`.
- Timeout-resilience protocol (controller + implementers): incremental commits after each step, write `.superpowers/sdd/task-N-report.md` EARLY (create at task start, update as you go), so a session-limit kill loses nothing. Controller: detect limit-killed subagents (tiny result / "session limit"), salvage from git + working tree, CONTROLLER INLINE fallback with ledger attribution, final review by a fresh independent subagent.
- Controller note: after Task 1, add launch config `watershed` (npx serve `/Users/lukasz/genuary-2026/sketches/watershed` --listen 3462, port 3462) to `/Users/lukasz/claude/self-redaction/.claude/launch.json` — controller does this inline; implementers never touch files outside the repo.

---

### Task 1: Scaffold — page, sidebar shell, seed plumbing, harness stub

**Files:**
- Create: `index.html` (copied from Fold, retitled)
- Create: `index.js` (skeleton: constants, ui, state, setup/draw, regenerate shell, paper/border/signature render)
- Create: `p5.min.js` (copied)
- Create: `.superpowers/sdd/p5-stub.js` (copied)
- Test: `.superpowers/sdd/task-1-verify.js`

**Interfaces:**
- Produces: globals `CS`, `PAD`, `PAPER`, `INK`, `INK_RGB`, `RED`, `TBASE`, `CONTROL_DEFS`, `ui`, `state`, functions `regenerate(newSeed)`, `renderAll()`, `signatureText()`, `randomizeAll()`, `setupControls()`, `drawPoly(pts)`, `wobblePts(pts)`, `jitterHash(idx, salt)`. Later tasks fill the pipeline hooks `rollTerrain/buildGrid/runHydrology/buildStreams/buildBasins/buildDivide/buildContours` — Task 1 defines them as no-op function declarations so the file always parses and runs.
- Consumes: nothing.

- [ ] **Step 1: Copy vendored assets**

```bash
cd /Users/lukasz/genuary-2026/sketches/watershed
cp /Users/lukasz/genuary-2026/sketches/fold/p5.min.js .
mkdir -p .superpowers/sdd
cp /Users/lukasz/genuary-2026/sketches/second-reading/.superpowers/sdd/p5-stub.js .superpowers/sdd/
cp /Users/lukasz/genuary-2026/sketches/fold/index.html .
```

- [ ] **Step 2: Adapt index.html**

Edit the copied `index.html`: change `<title>` to `Watershed` and the sidebar `<h1>` to `Watershed`. Keep the `<style>` block byte-for-byte (it carries the a11y floor). Verify these element ids exist (grep); if the copied file uses different ids, rename them in the HTML to exactly these:
`canvas-holder`, `controls`, `btn-random`, `btn-refresh`, `btn-svg`, `btn-png`, `btn-png4`.
Script tags at the end of `<body>` must be:

```html
<script src="p5.min.js"></script>
<script src="index.js"></script>
```

Remove any Fold-specific static text in the sidebar other than the h1 and the buttons (control rows are built by JS into `#controls`).

- [ ] **Step 3: Write index.js skeleton**

```javascript
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
function rollTerrain() {}
function buildGrid() {}
function runHydrology() {}
function buildStreams() {}
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
        lab.className = 'lab';
        lab.textContent = def.label;
        const btn = document.createElement('button');
        btn.className = 'val';
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
    c.parent('canvas-holder');
    pixelDensity(1);
    noLoop();
    setupControls();
    regenerate(true);
}

function draw() {}

function mousePressed() {
    if (mouseX >= 0 && mouseX <= CS && mouseY >= 0 && mouseY <= CS) regenerate(true);
}
```

Note: `.ctrl` / `.lab` / `.val` class names must match the CSS copied from Fold's `index.html` — grep the copied `<style>` block; if Fold's CSS uses different class names for control rows/labels/value buttons, use Fold's names in `setupControls` instead (CSS wins; JS adapts).

- [ ] **Step 4: Write verify script**

`.superpowers/sdd/task-1-verify.js`:

```javascript
// Task 1 verification: skeleton loads, regenerates, deterministic seed plumbing
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { installP5Stub } = require('./p5-stub.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'index.js'), 'utf8');
const sandbox = Object.assign({}, installP5Stub(), {
    console,
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch: () => ({ catch: () => {} }),
    confirm: () => false,
    document: { getElementById: () => null, createElement: () => ({ click: () => {} }) },
    Blob: function () {}, URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
    window: {}
});
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox);
// index.js declares state/ui/CS/PAD with const — lexical bindings are NOT sandbox
// properties, so export them explicitly for direct sandbox.X reads below.
vm.runInContext('globalThis.state = state; globalThis.ui = ui; globalThis.CS = CS; globalThis.PAD = PAD; renderAll = function () {};', sandbox);

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log(`  ok  ${name}`); }
    else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

check('CS is 2170', sandbox.CS === 2170);
check('PAD is 87', sandbox.PAD === 87);
check('ui defaults', sandbox.ui.density === 2 && sandbox.ui.contours === 1 && sandbox.ui.wobble === 0);
vm.runInContext('state.masterSeed = 123; regenerate(false);', sandbox);
check('regenerate(false) keeps seed', sandbox.state.masterSeed === 123);
const j1 = vm.runInContext('jitterHash(42, 1)', sandbox);
const j2 = vm.runInContext('jitterHash(42, 1)', sandbox);
check('jitterHash deterministic', j1 === j2 && j1 >= -0.5 && j1 < 0.5, `${j1}`);
const sig = vm.runInContext('signatureText()', sandbox);
check('signature format', /^Watershed · seed 123 · \d+ basins · \d+ folds  \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(sig), sig);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 5: Run verify**

Run: `cd /Users/lukasz/genuary-2026/sketches/watershed && node .superpowers/sdd/task-1-verify.js`
Expected: `6 passed, 0 failed`

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Task 1: scaffold — page, sidebar shell, seed plumbing, harness"
```

---

### Task 2: Fold-field terrain + grid sampling

**Files:**
- Modify: `index.js` (replace `rollTerrain` and `buildGrid` stubs; add `foldZ`, `makeNoise2D`, `terrainZ`)
- Test: `.superpowers/sdd/task-2-verify.js`

**Interfaces:**
- Consumes: `ui`, `state`, p5 `random/randomSeed` (seeded by `regenerate`).
- Produces: `foldZ(folds, x, y) → number`; `terrainZ(wx, wy) → number` (world coords centered on page); `rollTerrain()` fills `state.folds` (array of `{kind:'sine',theta,amp,freq,phase}` | `{kind:'sharp',theta,amp,c,w}`), `state.detail` (`{amp, ns, ox, oy, fbm}`), `state.kBasins` (int 2–4); `buildGrid()` fills `state.grid = {N, cell}` and `state.terr` (Float64Array N², row-major `idx = y*N + x`, sample at page point `PAD + (x+0.5)*cell`).

- [ ] **Step 1: Implement**

Replace the `rollTerrain` and `buildGrid` stubs with:

```javascript
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

function terrainZ(wx, wy) {
    const d = state.detail;
    return foldZ(state.folds, wx, wy) +
        d.amp * ((d.fbm(wx * d.ns + d.ox, wy * d.ns + d.oy) - 0.5) * 2);
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
```

- [ ] **Step 2: Write verify script**

`.superpowers/sdd/task-2-verify.js` (same sandbox boilerplate as task-1 — copy task-1-verify.js from the top through the `check` function definition, INCLUDING the globals-export `vm.runInContext` line; every later verify script does the same, then):

```javascript
// Continuity: no jumps at 0.5-unit steps
for (const seed of [100, 101, 102]) {
    vm.runInContext(`state.masterSeed = ${seed}; regenerate(false);`, sandbox);
    const maxAmp = vm.runInContext('Math.max(...state.folds.map(f => f.amp))', sandbox);
    let maxJump = 0;
    for (let x = -900; x <= 900; x += 150) {
        for (let y = -900; y <= 900; y += 150) {
            const z1 = vm.runInContext(`terrainZ(${x}, ${y})`, sandbox);
            const z2 = vm.runInContext(`terrainZ(${x + 0.5}, ${y})`, sandbox);
            maxJump = Math.max(maxJump, Math.abs(z2 - z1));
        }
    }
    check(`seed ${seed}: continuity (max jump ${maxJump.toFixed(3)} < ${maxAmp.toFixed(0)})`, maxJump < maxAmp);
}

// Superposition of foldZ
const superErr = vm.runInContext(`
    (function () {
        const f1 = { kind: 'sine', theta: 0.5, amp: 80, freq: 0.008, phase: 0.3 };
        const f2 = { kind: 'sharp', theta: 2.5, amp: 120, c: 50, w: 180 };
        let e = 0;
        for (let x = -200; x <= 200; x += 50)
            for (let y = -200; y <= 200; y += 50)
                e = Math.max(e, Math.abs(foldZ([f1], x, y) + foldZ([f2], x, y) - foldZ([f1, f2], x, y)));
        return e;
    })()
`, sandbox);
check('foldZ superposition', superErr < 1e-9, `${superErr}`);

// Character control
vm.runInContext('ui.character = 0; state.masterSeed = 42; regenerate(false);', sandbox);
check('Soft: no sharp folds', vm.runInContext("state.folds.filter(f => f.kind === 'sharp').length", sandbox) === 0);
vm.runInContext('ui.character = 2; state.masterSeed = 42; regenerate(false);', sandbox);
check('Sharp: >=1 sharp fold', vm.runInContext("state.folds.filter(f => f.kind === 'sharp').length", sandbox) >= 1);
vm.runInContext('ui.character = 1; ui.folds = 2; state.masterSeed = 42; regenerate(false);', sandbox);
check('folds=3 control', sandbox.state.folds.length === 3);

// Grid shape
vm.runInContext('ui.folds = 0; ui.detail = 0; state.masterSeed = 7; regenerate(false);', sandbox);
check('grid N=320', sandbox.state.grid.N === 320 && sandbox.state.terr.length === 320 * 320);
check('cell size', Math.abs(sandbox.state.grid.cell - (2170 - 174) / 320) < 1e-9);

// Determinism
vm.runInContext('state.masterSeed = 777; regenerate(false); globalThis.__t1 = state.terr[12345]; globalThis.__f1 = JSON.stringify(state.folds);', sandbox);
vm.runInContext('state.masterSeed = 777; regenerate(false); globalThis.__t2 = state.terr[12345]; globalThis.__f2 = JSON.stringify(state.folds);', sandbox);
check('determinism: terr + folds', sandbox.__t1 === sandbox.__t2 && sandbox.__f1 === sandbox.__f2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run verify**

Run: `node .superpowers/sdd/task-2-verify.js`
Expected: `10 passed, 0 failed`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 2: fold-field terrain + noise detail + grid sampling"
```

---

### Task 3: Hydrology core — priority-flood, D8, accumulation

**Files:**
- Modify: `index.js` (replace `runHydrology` stub; add `MinHeap`, `priorityFlood`, `computeD8`, `computeAccum`, direction tables)
- Test: `.superpowers/sdd/task-3-verify.js`

**Interfaces:**
- Consumes: `state.terr`, `state.grid.N`, `ui.density`, `TBASE`.
- Produces: module-level `DX/DY/DDIST` (8-neighbor tables); `priorityFlood(terr, N) → Float64Array filled`; `computeD8(filled, N) → Int32Array dir` (`dir[i]` = downstream cell index, `-1` = outlet, outlets only on border); `computeAccum(filled, dir, N) → Float64Array accum` (each cell contributes 1); `runHydrology()` fills `state.filled`, `state.dir`, `state.accum`, `state.threshold`.

- [ ] **Step 1: Implement**

```javascript
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
```

Replace the `runHydrology` stub with the real one; `MinHeap`/`priorityFlood`/`computeD8`/`computeAccum`/tables go above it.

- [ ] **Step 2: Write verify script**

`.superpowers/sdd/task-3-verify.js` (sandbox boilerplate, then — use `ui.detail = 0` for speed):

```javascript
vm.runInContext('ui.detail = 0; state.masterSeed = 4242; regenerate(false);', sandbox);
const N = sandbox.state.grid.N;
const dir = sandbox.state.dir;
const filled = sandbox.state.filled;
const accum = sandbox.state.accum;

// 1. Outlets only on border; interior cells always drain
let badInterior = 0, badOutlet = 0;
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const border = x === 0 || y === 0 || x === N - 1 || y === N - 1;
    if (dir[i] < 0 && !border) badInterior++;
    if (dir[i] >= 0 && !(filled[dir[i]] < filled[i])) badOutlet++;
}
check('interior cells all drain', badInterior === 0, `${badInterior} stranded`);
check('strict descent along dir', badOutlet === 0, `${badOutlet} non-descending`);

// 2. Every cell reaches an outlet without cycling
let cycles = 0;
for (let i = 0; i < N * N; i += 7) {
    let j = i, steps = 0;
    while (dir[j] >= 0 && steps <= N * N) { j = dir[j]; steps++; }
    if (steps > N * N) cycles++;
}
check('no flow cycles (sampled)', cycles === 0, `${cycles}`);

// 3. Mass conservation: rain in = flow out
let out = 0;
for (let i = 0; i < N * N; i++) if (dir[i] < 0) out += accum[i];
check('mass conservation', Math.abs(out - N * N) < 1e-6, `${out} vs ${N * N}`);

// 4. Threshold scales with density control
vm.runInContext('ui.density = 0; regenerate(false); globalThis.__tS = state.threshold;', sandbox);
vm.runInContext('ui.density = 3; regenerate(false); globalThis.__tF = state.threshold;', sandbox);
check('Sparse threshold > Flood threshold', sandbox.__tS > sandbox.__tF, `${sandbox.__tS} vs ${sandbox.__tF}`);

// 5. Determinism
vm.runInContext('ui.density = 2; state.masterSeed = 99; regenerate(false); globalThis.__a1 = state.accum[5000];', sandbox);
vm.runInContext('state.masterSeed = 99; regenerate(false); globalThis.__a2 = state.accum[5000];', sandbox);
check('determinism: accum', sandbox.__a1 === sandbox.__a2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run verify**

Run: `node .superpowers/sdd/task-3-verify.js`
Expected: `6 passed, 0 failed` (runtime < 30s at N=320)

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 3: hydrology core — priority-flood, D8, accumulation"
```

---

### Task 4: Streams — channel tracing with junction merge

**Files:**
- Modify: `index.js` (replace `buildStreams` stub; add `cellPt`)
- Test: `.superpowers/sdd/task-4-verify.js`

**Interfaces:**
- Consumes: `state.accum`, `state.dir`, `state.threshold`, `state.grid`, `jitterHash`.
- Produces: `cellPt(i) → {x, y}` (page coords, jittered ±0.35 cell, deterministic per cell); `buildStreams()` fills `state.streams` = array of `{cls: 0|1|2, pts: [{x,y}, ...]}` (fine/mid/trunk; class breakpoints `8*T` and `40*T`; each channel cell appears in exactly one traced tree path — traces stop at junctions with already-drawn channels).

- [ ] **Step 1: Implement**

```javascript
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
```

- [ ] **Step 2: Write verify script**

`.superpowers/sdd/task-4-verify.js` (boilerplate, then):

```javascript
vm.runInContext('ui.detail = 0; ui.density = 2; state.masterSeed = 4242; regenerate(false);', sandbox);
const st = sandbox.state;
const N = st.grid.N, cell = st.grid.cell, PAD = sandbox.PAD, CS = sandbox.CS;

check('streams exist', st.streams.length > 0, `${st.streams.length}`);
check('all runs have >=2 pts', st.streams.every(s => s.pts.length >= 2));
check('classes in {0,1,2}', st.streams.every(s => s.cls === 0 || s.cls === 1 || s.cls === 2));
check('all three classes present', new Set(st.streams.map(s => s.cls)).size === 3);

// all points inside drawable region (+1 cell tolerance for jitter)
const inPage = st.streams.every(s => s.pts.every(p =>
    p.x > PAD - cell && p.x < CS - PAD + cell && p.y > PAD - cell && p.y < CS - PAD + cell));
check('points within drawable region', inPage);

// no duplicated channel drawing: total interior vertices bounded by channel cell count + junction re-touches
let chan = 0;
for (let i = 0; i < N * N; i++) if (st.accum[i] >= st.threshold) chan++;
let verts = 0;
for (const s of st.streams) verts += s.pts.length;
check('vertex count ~ channel cells (no braided duplicates)',
    verts <= chan + 2 * st.streams.length, `verts ${verts}, channels ${chan}, runs ${st.streams.length}`);

// density: Flood yields more stream vertices than Sparse
vm.runInContext('ui.density = 0; regenerate(false); globalThis.__vS = state.streams.reduce((a, s) => a + s.pts.length, 0);', sandbox);
vm.runInContext('ui.density = 3; regenerate(false); globalThis.__vF = state.streams.reduce((a, s) => a + s.pts.length, 0);', sandbox);
check('Flood > Sparse vertices', sandbox.__vF > sandbox.__vS, `${sandbox.__vF} vs ${sandbox.__vS}`);

// determinism
vm.runInContext('ui.density = 2; state.masterSeed = 31; regenerate(false); globalThis.__s1 = JSON.stringify(state.streams.slice(0, 5));', sandbox);
vm.runInContext('state.masterSeed = 31; regenerate(false); globalThis.__s2 = JSON.stringify(state.streams.slice(0, 5));', sandbox);
check('determinism: streams', sandbox.__s1 === sandbox.__s2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run verify**

Run: `node .superpowers/sdd/task-4-verify.js`
Expected: `8 passed, 0 failed`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 4: stream tracing with junction merge + weight classes"
```

---

### Task 5: Basins + red divide

**Files:**
- Modify: `index.js` (replace `buildBasins` and `buildDivide` stubs; add `computeBasinRaw`, `mergeOutlets`, `chainSegments`, `chaikin`, `cornerPt`)
- Test: `.superpowers/sdd/task-5-verify.js`

**Interfaces:**
- Consumes: `state.dir`, `state.grid`, `state.kBasins`, `ui.basins` (0 Off / 1 Major / 2 All).
- Produces: `buildBasins()` fills `state.label` (Int32Array, kept-basin rank or −1) and `state.keptCount`; `buildDivide()` fills `state.divide` = array of page-coord polylines (`[{x,y},...]`), Chaikin-smoothed ×2, lying on grid-cell boundaries between different kept basins. `chainSegments(segs)` and `chaikin(pts)` are reused by Task 6.

- [ ] **Step 1: Implement**

```javascript
// basin root (outlet cell index) per cell, iterative with memoization
function computeBasinRaw(dir, N) {
    const raw = new Int32Array(N * N).fill(-1);
    for (let i = 0; i < N * N; i++) {
        if (raw[i] >= 0) continue;
        const stack = [];
        let j = i;
        while (raw[j] < 0) {
            stack.push(j);
            if (dir[j] < 0) { raw[j] = j; break; }
            j = dir[j];
        }
        const root = raw[j];
        for (const s of stack) raw[s] = root;
    }
    return raw;
}

// union adjacent border outlets into single basin mouths
function mergeOutlets(dir, N) {
    const parent = new Map();
    const find = i => {
        while (parent.get(i) !== i) {
            parent.set(i, parent.get(parent.get(i)));
            i = parent.get(i);
        }
        return i;
    };
    const union = (a, b) => {
        a = find(a); b = find(b);
        if (a !== b) parent.set(Math.max(a, b), Math.min(a, b));
    };
    for (let i = 0; i < N * N; i++) if (dir[i] < 0) parent.set(i, i);
    for (const i of [...parent.keys()]) {
        const x = i % N, y = (i - x) / N;
        for (let k = 0; k < 8; k++) {
            const nx = x + DX[k], ny = y + DY[k];
            if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
            const n = ny * N + nx;
            if (parent.has(n)) union(i, n);
        }
    }
    return find;
}

function buildBasins() {
    const { N } = state.grid;
    const raw = computeBasinRaw(state.dir, N);
    const find = mergeOutlets(state.dir, N);
    const groupOf = new Int32Array(N * N);
    const count = new Map();
    for (let i = 0; i < N * N; i++) {
        const g = find(raw[i]);
        groupOf[i] = g;
        count.set(g, (count.get(g) || 0) + 1);
    }
    const groups = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    state.keptCount = Math.min(state.kBasins, groups.length);
    let keptIds = [];
    if (ui.basins === 1) keptIds = groups.slice(0, state.keptCount).map(g => g[0]);
    else if (ui.basins === 2) keptIds = groups.filter(g => g[1] >= 0.02 * N * N).map(g => g[0]);
    const rank = new Map(keptIds.map((g, r) => [g, r]));
    const label = new Int32Array(N * N).fill(-1);
    for (let i = 0; i < N * N; i++) {
        const r = rank.get(groupOf[i]);
        if (r !== undefined) label[i] = r;
    }
    state.label = label;
}

function cornerPt(gp) {
    const { cell } = state.grid;
    return { x: PAD + gp[0] * cell, y: PAD + gp[1] * cell };
}

// chain undirected segments (integer or float endpoints) into polylines
function chainSegments(segs, keyFn) {
    const key = keyFn || ((x, y) => x + ',' + y);
    const adj = new Map();
    const addAdj = (k, si) => {
        if (!adj.has(k)) adj.set(k, []);
        adj.get(k).push(si);
    };
    segs.forEach((s, si) => {
        addAdj(key(s[0], s[1]), si);
        addAdj(key(s[2], s[3]), si);
    });
    const used = new Uint8Array(segs.length);
    const chains = [];
    for (let si = 0; si < segs.length; si++) {
        if (used[si]) continue;
        used[si] = 1;
        const chain = [[segs[si][0], segs[si][1]], [segs[si][2], segs[si][3]]];
        for (const end of [1, 0]) {
            while (true) {
                const tip = end ? chain[chain.length - 1] : chain[0];
                const cands = (adj.get(key(tip[0], tip[1])) || []).filter(j => !used[j]);
                if (!cands.length) break;
                const j = cands[0];
                used[j] = 1;
                const s = segs[j];
                const other = (Math.abs(s[0] - tip[0]) < 1e-9 && Math.abs(s[1] - tip[1]) < 1e-9)
                    ? [s[2], s[3]] : [s[0], s[1]];
                if (end) chain.push(other); else chain.unshift(other);
            }
        }
        chains.push(chain);
    }
    return chains;
}

// corner-cutting smoothing, endpoints preserved
function chaikin(pts) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
        out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    out.push(pts[pts.length - 1]);
    return out;
}

function buildDivide() {
    state.divide = [];
    if (ui.basins === 0) return;
    const { N } = state.grid;
    const lab = state.label;
    const segs = [];
    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N - 1; x++) {
            const a = lab[y * N + x], b = lab[y * N + x + 1];
            if (a >= 0 && b >= 0 && a !== b) segs.push([x + 1, y, x + 1, y + 1]);
        }
    }
    for (let y = 0; y < N - 1; y++) {
        for (let x = 0; x < N; x++) {
            const a = lab[y * N + x], b = lab[(y + 1) * N + x];
            if (a >= 0 && b >= 0 && a !== b) segs.push([x, y + 1, x + 1, y + 1]);
        }
    }
    state.divide = chainSegments(segs)
        .map(ch => chaikin(chaikin(ch.map(cornerPt))));
}
```

- [ ] **Step 2: Write verify script**

`.superpowers/sdd/task-5-verify.js` (boilerplate, then):

```javascript
vm.runInContext('ui.detail = 0; ui.density = 2; ui.basins = 1; state.masterSeed = 4242; regenerate(false);', sandbox);
const st = sandbox.state;
const N = st.grid.N;

check('divide exists (Major)', st.divide.length > 0, `${st.divide.length}`);
check('keptCount in 2..4', st.keptCount >= 2 && st.keptCount <= 4, `${st.keptCount}`);
check('labels bounded by keptCount', (() => {
    let max = -1;
    for (let i = 0; i < N * N; i++) max = Math.max(max, st.label[i]);
    return max === st.keptCount - 1;
})());

// divide-vs-stream crossing rate (sampled): dual structures — expect near zero
function segInt(p1, p2, p3, p4) {
    const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (Math.abs(d) < 1e-12) return false;
    const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
    const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
    return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
}
let divSegs = [];
for (const pl of st.divide)
    for (let i = 0; i < pl.length - 1; i += 4) divSegs.push([pl[i], pl[i + 1]]);
let strSegs = [];
for (const s of st.streams)
    for (let i = 0; i < s.pts.length - 1; i += 3) strSegs.push([s.pts[i], s.pts[i + 1]]);
let crossings = 0;
const sampleDiv = divSegs.filter((_, i) => i % 3 === 0);
for (const d of sampleDiv)
    for (const s of strSegs)
        if (segInt(d[0], d[1], s[0], s[1])) { crossings++; break; }
const rate = sampleDiv.length ? crossings / sampleDiv.length : 0;
check('divide/stream crossing rate <= 2%', rate <= 0.02, `${(rate * 100).toFixed(2)}% of ${sampleDiv.length}`);

// Off mode
vm.runInContext('ui.basins = 0; regenerate(false);', sandbox);
check('Off: no divide', sandbox.state.divide.length === 0);
vm.runInContext('ui.basins = 2; regenerate(false);', sandbox);
check('All mode runs', Array.isArray(sandbox.state.divide));

// determinism
vm.runInContext('ui.basins = 1; state.masterSeed = 55; regenerate(false); globalThis.__d1 = JSON.stringify(state.divide.slice(0, 2));', sandbox);
vm.runInContext('state.masterSeed = 55; regenerate(false); globalThis.__d2 = JSON.stringify(state.divide.slice(0, 2));', sandbox);
check('determinism: divide', sandbox.__d1 === sandbox.__d2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run verify**

Run: `node .superpowers/sdd/task-5-verify.js`
Expected: `7 passed, 0 failed`

Note on the crossing test: streams are jittered inside their cells and the divide runs on cell boundaries between basins, so crossings can only occur at diagonal flow steps clipping a corner plus Chaikin corner-cutting — a small, honest tolerance (≤2%), same spirit as Fold's sliver tripwire. If the rate exceeds 2%, investigate before loosening: likely a labeling bug, not a tolerance problem.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 5: basins + red divide (labels, boundary chains, Chaikin)"
```

---

### Task 6: Whisper contours — marching squares

**Files:**
- Modify: `index.js` (replace `buildContours` stub; add `marchCell`, `samplePt`)
- Test: `.superpowers/sdd/task-6-verify.js`

**Interfaces:**
- Consumes: `state.filled`, `state.grid`, `ui.contours` (0 Off / 1 Whisper=4 levels / 2 Light=7 levels), `chainSegments` (Task 5).
- Produces: `buildContours()` fills `state.contours` = array of page-coord polylines on the FILLED heightfield, levels evenly spaced between the 5th and 95th height percentiles.

- [ ] **Step 1: Implement**

```javascript
function samplePt(gx, gy) {
    const { cell } = state.grid;
    return { x: PAD + (gx + 0.5) * cell, y: PAD + (gy + 0.5) * cell };
}

// standard 16-case marching squares on one 2x2 block; emits [x1,y1,x2,y2] in grid coords
function marchCell(x, y, v00, v10, v01, v11, lv, segs) {
    let c = 0;
    if (v00 >= lv) c |= 1;
    if (v10 >= lv) c |= 2;
    if (v11 >= lv) c |= 4;
    if (v01 >= lv) c |= 8;
    if (c === 0 || c === 15) return;
    const t = (a, b) => (lv - a) / (b - a);
    const top = () => [x + t(v00, v10), y];
    const bottom = () => [x + t(v01, v11), y + 1];
    const left = () => [x, y + t(v00, v01)];
    const right = () => [x + 1, y + t(v10, v11)];
    const add = (p, q) => segs.push([p[0], p[1], q[0], q[1]]);
    switch (c) {
        case 1: case 14: add(left(), top()); break;
        case 2: case 13: add(top(), right()); break;
        case 3: case 12: add(left(), right()); break;
        case 4: case 11: add(right(), bottom()); break;
        case 6: case 9: add(top(), bottom()); break;
        case 7: case 8: add(left(), bottom()); break;
        case 5: {
            const mid = (v00 + v10 + v01 + v11) / 4 >= lv;
            if (mid) { add(left(), top()); add(right(), bottom()); }
            else { add(left(), bottom()); add(top(), right()); }
            break;
        }
        case 10: {
            const mid = (v00 + v10 + v01 + v11) / 4 >= lv;
            if (mid) { add(top(), right()); add(left(), bottom()); }
            else { add(left(), top()); add(right(), bottom()); }
            break;
        }
    }
}

function buildContours() {
    state.contours = [];
    const nLevels = [0, 4, 7][ui.contours];
    if (!nLevels) return;
    const { N } = state.grid;
    const f = state.filled;
    const sorted = Float64Array.from(f).sort();
    const p05 = sorted[Math.floor(0.05 * sorted.length)];
    const p95 = sorted[Math.floor(0.95 * sorted.length)];
    const fkey = (x, y) => x.toFixed(3) + ',' + y.toFixed(3);
    for (let li = 0; li < nLevels; li++) {
        const lv = p05 + ((li + 1) / (nLevels + 1)) * (p95 - p05);
        const segs = [];
        for (let y = 0; y < N - 1; y++) {
            for (let x = 0; x < N - 1; x++) {
                marchCell(x, y,
                    f[y * N + x], f[y * N + x + 1],
                    f[(y + 1) * N + x], f[(y + 1) * N + x + 1], lv, segs);
            }
        }
        for (const ch of chainSegments(segs, fkey)) {
            state.contours.push(ch.map(gp => samplePt(gp[0], gp[1])));
        }
    }
}
```

- [ ] **Step 2: Write verify script**

`.superpowers/sdd/task-6-verify.js` (boilerplate, then):

```javascript
vm.runInContext('ui.detail = 0; ui.contours = 1; state.masterSeed = 4242; regenerate(false);', sandbox);
const st = sandbox.state;
const N = st.grid.N, cell = st.grid.cell, PAD = sandbox.PAD, CS = sandbox.CS;

check('Whisper: contours exist', st.contours.length > 0, `${st.contours.length}`);

// each chain is closed, or both endpoints lie near the grid edge
const edgeTol = 1.6 * cell;
let bad = 0;
for (const pl of st.contours) {
    const a = pl[0], b = pl[pl.length - 1];
    const closed = Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
    const nearEdge = p =>
        p.x < PAD + edgeTol || p.y < PAD + edgeTol ||
        p.x > CS - PAD - edgeTol || p.y > CS - PAD - edgeTol;
    if (!closed && !(nearEdge(a) && nearEdge(b))) bad++;
}
check('chains closed or edge-terminated', bad === 0, `${bad} of ${st.contours.length}`);

vm.runInContext('ui.contours = 0; regenerate(false);', sandbox);
check('Off: none', sandbox.state.contours.length === 0);
vm.runInContext('ui.contours = 2; regenerate(false);', sandbox);
check('Light: contours exist', sandbox.state.contours.length > 0);

vm.runInContext('ui.contours = 1; state.masterSeed = 88; regenerate(false); globalThis.__c1 = JSON.stringify(state.contours.slice(0, 3));', sandbox);
vm.runInContext('state.masterSeed = 88; regenerate(false); globalThis.__c2 = JSON.stringify(state.contours.slice(0, 3));', sandbox);
check('determinism: contours', sandbox.__c1 === sandbox.__c2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run verify**

Run: `node .superpowers/sdd/task-6-verify.js`
Expected: `5 passed, 0 failed`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 6: whisper contours via marching squares"
```

---

### Task 7: Full-pipeline control effects (integration check)

The renderer and sidebar were wired in Task 1; the pipeline is complete after Task 6. This task verifies end-to-end control behavior — the seams between tasks.

**Files:**
- Test: `.superpowers/sdd/task-7-verify.js`
- Modify: `index.js` only if a defect is found.

**Interfaces:**
- Consumes: everything.
- Produces: confidence.

- [ ] **Step 1: Write verify script**

`.superpowers/sdd/task-7-verify.js` (boilerplate, then):

```javascript
function run(setup) {
    vm.runInContext(`
        ui.folds = 0; ui.character = 1; ui.rough = 1; ui.density = 2;
        ui.detail = 0; ui.contours = 1; ui.basins = 1; ui.wobble = 0;
        ${setup}
        regenerate(false);
        globalThis.__snap = {
            streams: state.streams.length,
            verts: state.streams.reduce((a, s) => a + s.pts.length, 0),
            contours: state.contours.length,
            divide: state.divide.length
        };
    `, sandbox);
    return sandbox.__snap;
}

const base = run('state.masterSeed = 4242;');
check('base: all layers populated', base.streams > 0 && base.contours > 0 && base.divide > 0);
check('base: dense default yields >2000 stream vertices', base.verts > 2000, `${base.verts}`);

const sparse = run('state.masterSeed = 4242; ui.density = 0;');
const flood = run('state.masterSeed = 4242; ui.density = 3;');
check('density monotone: sparse < base < flood', sparse.verts < base.verts && base.verts < flood.verts,
    `${sparse.verts} / ${base.verts} / ${flood.verts}`);

const rough0 = run('state.masterSeed = 4242; ui.rough = 0;');
const rough2 = run('state.masterSeed = 4242; ui.rough = 2;');
check('roughness changes geometry', rough0.verts !== rough2.verts);

const noApp = run('state.masterSeed = 4242; ui.contours = 0; ui.basins = 0;');
check('pure structure: no apparatus', noApp.contours === 0 && noApp.divide === 0 && noApp.streams > 0);

// full determinism across whole pipeline
vm.runInContext('state.masterSeed = 4242; ui.density = 2; ui.contours = 1; ui.basins = 1; regenerate(false); globalThis.__w1 = JSON.stringify({ s: state.streams, d: state.divide, c: state.contours });', sandbox);
vm.runInContext('state.masterSeed = 4242; regenerate(false); globalThis.__w2 = JSON.stringify({ s: state.streams, d: state.divide, c: state.contours });', sandbox);
check('full-pipeline determinism', sandbox.__w1 === sandbox.__w2);

// three fresh seeds survive the pipeline
let ok = 0;
for (const seed of [11, 222, 3333]) {
    const s = run(`state.masterSeed = ${seed};`);
    if (s.streams > 0 && s.verts > 200) ok++;
}
check('3 fresh seeds all viable', ok === 3, `${ok}/3`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run verify**

Run: `node .superpowers/sdd/task-7-verify.js`
Expected: `7 passed, 0 failed`

If `dense default yields >2000 stream vertices` fails at N=320, the density calibration missed the mark — adjust `TBASE` values downward (denser) rather than the test, and re-run Tasks 3–7 verifies.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Task 7: full-pipeline control-effect verification"
```

---

### Task 8: Export — SVG pen passes + PNG

**Files:**
- Modify: `index.js` (replace `exportSVG`/`exportPNG` stubs; add `polyToPath`, `svgPass`, `buildSVG`)
- Test: `.superpowers/sdd/task-8-verify.js`

**Interfaces:**
- Consumes: `state.streams/divide/contours`, `wobblePts`, `signatureText`.
- Produces: `buildSVG() → string` (7 passes: Border, Contours, Streams-fine, Streams-mid, Streams-trunk, Divide, Signature; M/L-only paths; red only in Divide); `exportSVG()` downloads it; `exportPNG(scale)` re-renders at pixelDensity and saves (`scale` 1 or 4).

- [ ] **Step 1: Implement**

```javascript
function polyToPath(pts) {
    const w = wobblePts(pts);
    let d = `M ${w[0].x.toFixed(2)} ${w[0].y.toFixed(2)}`;
    for (let i = 1; i < w.length; i++) d += ` L ${w[i].x.toFixed(2)} ${w[i].y.toFixed(2)}`;
    return d;
}

function svgPass(label, color, weight, paths) {
    if (!paths.length) return '';
    let s = `  <g id="${label}" inkscape:groupmode="layer" inkscape:label="${label}" ` +
        `stroke="${color}" stroke-width="${weight}" fill="none" ` +
        `stroke-linecap="round" stroke-linejoin="round">\n`;
    for (const d of paths) s += `    <path d="${d}"/>\n`;
    s += '  </g>\n';
    return s;
}

function buildSVG() {
    const contourPaths = state.contours.map(polyToPath);
    const finePaths = [], midPaths = [], trunkPaths = [];
    for (const s of state.streams) {
        [finePaths, midPaths, trunkPaths][s.cls].push(polyToPath(s.pts));
    }
    const dividePaths = state.divide.map(polyToPath);
    const borderPath = `M ${PAD} ${PAD} L ${CS - PAD} ${PAD} L ${CS - PAD} ${CS - PAD} ` +
        `L ${PAD} ${CS - PAD} L ${PAD} ${PAD}`;
    let s = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        `<svg xmlns="http://www.w3.org/2000/svg" ` +
        `xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" ` +
        `width="${CS}" height="${CS}" viewBox="0 0 ${CS} ${CS}">\n`;
    s += `  <rect width="${CS}" height="${CS}" fill="${PAPER}"/>\n`;
    s += svgPass('Border', INK, 0.9, [borderPath]);
    s += svgPass('Contours', INK, 0.35, contourPaths);
    s += svgPass('Streams-fine', INK, 0.45, finePaths);
    s += svgPass('Streams-mid', INK, 0.7, midPaths);
    s += svgPass('Streams-trunk', INK, 1.0, trunkPaths);
    s += svgPass('Divide', RED, 1.0, dividePaths);
    s += `  <g id="Signature" inkscape:groupmode="layer" inkscape:label="Signature">\n` +
        `    <text x="${PAD}" y="${CS - PAD + 44}" font-family="monospace" font-size="26" ` +
        `fill="${INK}">${signatureText()}</text>\n  </g>\n`;
    s += '</svg>\n';
    return s;
}

function exportSVG() {
    const blob = new Blob([buildSVG()], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `watershed-seed${state.masterSeed}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
}

function exportPNG(scale) {
    pixelDensity(scale);
    renderAll();
    saveCanvas(`watershed-seed${state.masterSeed}-${scale}x`, 'png');
    pixelDensity(1);
    renderAll();
}
```

- [ ] **Step 2: Write verify script**

`.superpowers/sdd/task-8-verify.js` (boilerplate, then):

```javascript
vm.runInContext('ui.detail = 0; ui.density = 2; ui.contours = 1; ui.basins = 1; ui.wobble = 0; state.masterSeed = 4242; regenerate(false);', sandbox);
const svg = vm.runInContext('buildSVG()', sandbox);

const labels = ['Border', 'Contours', 'Streams-fine', 'Streams-mid', 'Streams-trunk', 'Divide', 'Signature'];
for (const l of labels) {
    check(`pass present: ${l}`, svg.includes(`inkscape:label="${l}"`));
}
check('exactly 7 layer groups', (svg.match(/inkscape:groupmode="layer"/g) || []).length === 7);

// red only in the Divide pass
const groups = svg.split('<g ').slice(1);
let redOK = true;
for (const g of groups) {
    if (g.includes('#A93B2A') && !g.startsWith('id="Divide"')) redOK = false;
}
check('red only in Divide', redOK);

// M/L-only path data
const ds = [...svg.matchAll(/ d="([^"]+)"/g)].map(m => m[1]);
check('paths exist', ds.length > 10, `${ds.length}`);
check('M/L-only paths', ds.every(d => /^M( -?\d+(\.\d+)?){2}( L( -?\d+(\.\d+)?){2})+$/.test(d.replace(/ +/g, ' '))));

check('viewBox correct', svg.includes('viewBox="0 0 2170 2170"'));
check('signature in svg', /Watershed · seed 4242 · \d+ basins/.test(svg));

// wobble parity: wobble ON changes both canvas geometry source and svg identically per call
vm.runInContext('ui.wobble = 1;', sandbox);
const w1 = vm.runInContext('buildSVG()', sandbox);
const w2 = vm.runInContext('buildSVG()', sandbox);
check('wobble deterministic across builds', w1 === w2);
check('wobble changes geometry', w1 !== svg);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run verify**

Run: `node .superpowers/sdd/task-8-verify.js`
Expected: `15 passed, 0 failed`

Note: the p5-stub must expose `randomSeed/random` used by `wobblePts` — it already does (Task 1 boilerplate). If `saveCanvas`/`pixelDensity` are missing from the stub, add no-ops to the SANDBOX in the verify script, not to the stub file.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 8: SVG pen passes + PNG/PNG-4x export"
```

---

### Task 9: README + final multi-seed QA

**Files:**
- Create: `README.md`
- Test: `.superpowers/sdd/task-9-verify.js`

**Interfaces:**
- Consumes: everything.
- Produces: documentation + a timed multi-seed pipeline soak.

- [ ] **Step 1: Write README.md**

```markdown
# Watershed

The same fold, rained on. A fold-field terrain (the [fold](https://github.com/lukaszlysakowski/fold)
sine + sharp-crease math reused as relief, with fine value-noise detail) is drained by
flow accumulation: priority-flood pit filling, D8 steepest descent, upstream-area
accumulation. The page is dominated by dendritic ink stream trees — pen weight grows as
tributaries join — over whisper-light contour lines. One red line: the divide, the ridge
separating the major drainage basins.

Plan view, straight down. Fold shows the sheet as an object in space; Watershed shows
what water does to the same mathematics, from above.

## Running

Static files, no build step: serve the directory (`npx serve . --listen 3462`) and open
`index.html`.

## Controls

- **Terrain** — Folds (random/2/3/4) · Character (Soft/Mixed/Sharp) · Roughness (noise detail)
- **Water** — Density (Sparse/Medium/Dense/Flood — accumulation threshold) · Detail (grid 320/400/480)
- **Apparatus** — Contours (Off/Whisper/Light) · Basins (red divide: Off/Major/All)
- **Style** — Wobble (default Off)
- randomize / refresh / svg / png / png 4x · click canvas = new seed

## Exports

Layered SVG pen passes (Border / Contours / Streams-fine / Streams-mid / Streams-trunk /
Divide / Signature) for multi-pen plotting; PNG at 1x (2170²) and 4x (8680²).

## Honest approximations

- Streams are jittered ±0.35 cell inside their grid cells; the divide runs on cell
  boundaries and is Chaikin-smoothed. Diagonal flow steps can therefore graze the divide
  at corners — verified ≤2% of divide segments; invisible at plot scale.
- D8 drainage quantizes flow to 8 directions; the value-noise detail layer is what keeps
  channels from reading as lattice-parallel.

## Family

[palimpsest](https://github.com/lukaszlysakowski/palimpsest) ·
[core-samples](https://github.com/lukaszlysakowski/core-samples) ·
[second-reading](https://github.com/lukaszlysakowski/second-reading) ·
[fold](https://github.com/lukaszlysakowski/fold) ·
[field-script](https://github.com/lukaszlysakowski/field-script)
```

- [ ] **Step 2: Write soak script**

`.superpowers/sdd/task-9-verify.js` (boilerplate, then):

```javascript
let allOK = true;
for (const seed of [17, 404, 9090, 123456, 777777]) {
    const t0 = Date.now();
    vm.runInContext(`ui.detail = 1; ui.density = 2; ui.contours = 1; ui.basins = 1; state.masterSeed = ${seed}; regenerate(false);`, sandbox);
    const ms = Date.now() - t0;
    const st = sandbox.state;
    const verts = st.streams.reduce((a, s) => a + s.pts.length, 0);
    const ok = st.streams.length > 0 && verts > 1000 && st.contours.length > 0 && st.divide.length > 0 && ms < 20000;
    console.log(`  seed ${seed}: ${st.streams.length} runs, ${verts} verts, ${st.contours.length} contours, ${st.divide.length} divide chains, ${ms}ms ${ok ? 'ok' : 'FAIL'}`);
    if (!ok) allOK = false;
}
check('5-seed soak at N=400', allOK);

const svg = vm.runInContext('buildSVG()', sandbox);
check('soak SVG has all passes', (svg.match(/inkscape:groupmode="layer"/g) || []).length === 7);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run soak**

Run: `node .superpowers/sdd/task-9-verify.js`
Expected: `2 passed, 0 failed`, each seed well under 20s.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 9: README + multi-seed soak"
```

---

## Post-plan (controller, not a subagent task)

1. Add `watershed` launch config (port 3462) to `/Users/lukasz/claude/self-redaction/.claude/launch.json`.
2. Browser gate: start the dev server, screenshot at defaults + a few randomizes, check density/contour/divide legibility, tune canvas stroke weights/alphas if needed (SVG weights are spec-fixed; canvas is presentation).
3. Final review: fresh independent subagent (opus), zero deference to inline work.
4. GitHub publish only when the user asks.
