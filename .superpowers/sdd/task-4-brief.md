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

