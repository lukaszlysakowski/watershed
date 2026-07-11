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

