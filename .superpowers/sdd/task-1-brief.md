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

