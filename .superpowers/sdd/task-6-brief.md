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

