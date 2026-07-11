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

