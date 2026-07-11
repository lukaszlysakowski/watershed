# Watershed — Design Spec (2026-07-11)

## Concept

**Watershed — the same fold, rained on.** A fold-field terrain (Fold's sine + sharp-crease
math reused as relief, plus fine Perlin detail) is drained by flow accumulation. The page
is dominated by dendritic ink trees — thousands of fine converging stream polylines whose
pen weight grows as tributaries join — over a handful of whisper-light contour lines that
explain the bends without turning the sheet into a map. One red line: the divide, the
ridge path separating the major drainage basins.

Plan view, straight down, no camera. Fold shows the sheet as an object in space; Watershed
shows what water does to the same mathematics, from above.

Decisions made during brainstorming (user-approved):
- **Composition:** drainage-dominant + whisper contours (Off toggle for pure structure).
  Not a full topographic reading — that was flagged as the "too literal" trap.
- **Terrain:** fold field + noise detail (family echo is the concept).
- **Red:** the divide — the watershed itself, the piece's namesake.
- **Format:** square 2170×2170, matching Fold.
- **Scope:** full family maker, local git repo first; GitHub publish only when asked.
- **Engine:** flow accumulation (priority-flood + D8), not particle erosion, not growth
  networks.

## Page & livery

- Canvas 2170×2170 (`CS = 2170`), `PAD = round(CS * 0.04)`.
- Paper `#F7E6D4`, ink `#1A1613`, red `#A93B2A` (the divide is the ONLY red).
- Border rectangle at PAD; signature bottom-left inside border:
  `Watershed · seed N · <k> basins · <folds> folds  YYYY-MM-DD HH:MM`.
- House idiom: single `index.html` + `index.js`, vendored `p5.min.js`, no build step.
- Sidebar CSS copied from Palimpsest/Fold (a11y floor: `--muted: #969082`,
  `.ctrl min-height: 24px`; Lighthouse a11y 100 — never regress).

## Engine

### Terrain

```
terrainZ(x, y) = foldZ(folds, x, y) + detail(x, y)
```

- `foldZ` is Fold's exact math: 2–4 superposed folds, each sine
  (`amp·sin(t·freq + phase)`) or sharp triangular (`amp·max(0, 1 − |t−c|/w)`),
  where `t = x·cosθ + y·sinθ`. Ported from `~/genuary-2026/sketches/fold/index.js`
  (read-only source).
- `detail` = 2–3 octaves of seeded Perlin noise (p5 `noise()` after `noiseSeed`),
  amplitude 10–20% of the max fold amplitude, scaled by the Roughness control.
- All rolls at plan level from `masterSeed`; per-subsystem seeds
  `masterSeed + i*7919`. `Math.random` ONLY at seed choice + randomizeAll
  (the family determinism contract).

### Grid

Sample `terrainZ` on an N×N grid spanning the drawable square
(`PAD..CS−PAD` both axes). N = 320 / 400 / 480 via the Detail control
(default 400). All hydrology is pure functions of this `Float64Array`.

### Priority-flood (pit filling)

Barnes-2014 priority-flood: seed a min-priority queue with all border cells;
pop the lowest, push unvisited neighbors at
`filled[n] = max(terrain[n], filled[popped] + EPS)` (`EPS ≈ 1e-6` of height range,
monotone so flow stays directed). Result: `filled` heightfield in which every
cell has a strictly descending path to the grid border. Binary-heap priority
queue (no dependency; ~30 lines).

### D8 + accumulation

- `dir[i]` = index of the steepest-descent neighbor of 8 on `filled`
  (diagonal distances √2-corrected); border cells may point off-grid (outlet).
- Sort cell indices by descending `filled`; one pass pushing
  `accum[i] (init 1)` onto `accum[dir[i]]`. O(n log n) total, no recursion.

### Streams

- Channel cells: `accum[i] ≥ threshold`. Threshold set by the Density control
  (Sparse/Medium/Dense/Flood) as a fraction of grid area — calibrated in
  implementation so Dense yields thousands of fine segments (the rated
  preference), Flood pushes further.
- Channel heads: channel cells with no upstream channel neighbor. Trace each
  head downstream via `dir` to the border, emitting one polyline in page
  coordinates. Sub-cell seeded jitter (≤0.35 cell) de-lattices the lines;
  jitter per cell index so shared downstream runs stay coincident (tributaries
  visually merge instead of braiding).
- Three weight classes by accumulation breakpoints (fine/mid/trunk), emitted as
  three separate stream passes. A polyline is split where its class changes.

### Divide (the red)

- `basin[i]`: follow `dir` to the border, memoize the outlet id along the path
  (path-compression style; iterative, O(n) amortized).
- Merge outlets: border outlet cells adjacent along the border with each other
  belong to one basin (rivers exit as one mouth). Keep the k largest basins,
  k rolled 2–4 at plan level; Basins control Off/Major/All (Major = k largest,
  All = every basin above a floor area).
- The divide is the marching path along edges between cells of different kept
  basin labels — polygonize the label boundary (marching-squares-style on the
  label grid), light Chaikin smoothing (2 rounds). Invariant: the divide never
  crosses a stream polyline (dual structures of one flow field).

### Contours

Marching squares on the FILLED heightfield at 4–7 evenly spaced levels between
the field's 5th and 95th height percentiles. Whisper = 4 levels at 0.35 SVG
weight and low-opacity canvas ink; Light = 7 levels slightly darker; Off = none.
Contours are the terrain's voice — they use `filled`, not raw terrain, so they
never contradict the streams.

## Rendering & export

Draw order (back → front): paper → contours → streams-fine → streams-mid →
streams-trunk → red divide → border → signature.

SVG pen passes via family `svgPass(label, color, weight, paths)` — M/L-only
polyline paths:

| Pass          | Color | Weight |
|---------------|-------|--------|
| Border        | ink   | 0.9    |
| Contours      | ink   | 0.35   |
| Streams-fine  | ink   | 0.45   |
| Streams-mid   | ink   | 0.7    |
| Streams-trunk | ink   | 1.0    |
| Divide        | red   | 1.0    |
| Signature     | ink   | 0.9    |

- Canvas/SVG parity: identical geometry arrays feed both renderers.
- Wobble (Style control, default OFF): seeded from `seg.x1*0.01` in BOTH
  renderers (family parity rule).
- Exports: SVG, PNG, PNG 4x (8680²) via `exportPNG(scale)` pixelDensity
  re-render (port from Fold/Second Reading).

## Maker UI

Family sidebar (cycleCtrl / CONTROL_DEFS / setupControls / randomizeAll):

- **Terrain:** Folds (random/2/3/4) · Character (Soft/Mixed/Sharp) ·
  Roughness (Low/Med/High)
- **Water:** Density (Sparse/Medium/Dense/Flood, default Dense) ·
  Detail (320/400/480, default 400)
- **Apparatus:** Contours (Off/Whisper/Light, default Whisper) ·
  Basins (Off/Major/All, default Major)
- **Style:** Wobble (On/Off, default Off)
- Buttons: randomize / refresh / svg / png / png 4x.
- Click canvas = new seed, same params. Randomize = reroll all + new seed.
  Refresh = new seed, same params.
- No rating/learning system (family decision for the post-Core-Samples pieces).

## Testing

Node harness: `.superpowers/sdd/p5-stub.js` (seeded splitmix32) + `vm.runInContext`
of the real `index.js` with localStorage/fetch/document/confirm shims (port from
second-reading/fold). Per-task verify scripts assert at minimum:

1. Fold-field port: continuity, superposition, sharp-fold crest (Fold's task-2 suite).
2. Priority-flood: after filling, every cell has a strictly descending path to
   the border (walk `dir` from every cell, must terminate off-grid; no cycles).
3. Accumulation: mass conservation — sum of accumulation leaving the border
   equals N² (every cell's unit of rain exits).
4. Streams: every traced polyline's last vertex lies at the drawable border
   region; weight classes partition the channel cells.
5. Divide: no divide segment intersects any stream segment (sampled
   intersection test on a few seeds); divide only borders kept basins.
6. Contours: marching-squares paths are closed or border-terminated; contour
   count matches the control.
7. Determinism: same seed twice → deep-equal streams, divide, contours arrays.
8. Export: SVG contains exactly the 7 passes, M/L-only path data, red appears
   only in the Divide pass.

Build process: subagent-driven development with the timeout-resilience protocol
in the ledger (incremental commits, early report files, controller-inline
fallback with attribution, fresh independent final review — the Fold protocol).

## Infrastructure

- New git repo at `/Users/lukasz/genuary-2026/sketches/watershed`.
- Launch config `watershed`: `npx serve <dir> --listen 3462`, port 3462, added
  to `/Users/lukasz/claude/self-redaction/.claude/launch.json`.
- Read-only sources (never modify): `~/genuary-2026/sketches/fold/*`,
  `~/genuary-2026/sketches/palimpsest/index.html` (CSS),
  `~/genuary-2026/sketches/second-reading/.superpowers/sdd/p5-stub.js`.
- GitHub publish deferred until the user asks.

## Lineage

Flow accumulation over a generated heightfield — hydrology's textbook D8/
priority-flood pipeline turned to plotter ends; sibling of Fold (same fold DNA,
orthogonal treatment: object-in-space vs plan-view consequence). Family:
palimpsest, core-samples, second-reading, fold, field-script.
