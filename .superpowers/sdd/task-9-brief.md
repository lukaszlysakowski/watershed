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

