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

