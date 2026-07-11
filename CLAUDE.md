# Watershed — Generative Plotter Art

## Project
A p5.js maker: a fold-field terrain drained by flow accumulation. "The same fold, rained on." Fold's sine + sharp-crease math is reused as relief (plus seeded value-noise detail); water is routed by the textbook hydrology pipeline (priority-flood → D8 → accumulation) and drawn as dendritic pen-weighted stream trees over whisper contours. ONE red line = the divide (basin boundary). Public repo: https://github.com/lukaszlysakowski/watershed — live maker: https://lukaszlysakowski.github.io/watershed/

## The hydrology pipeline (the load-bearing part)
- `rollTerrain` → `buildGrid` (N² samples of `terrainZ = foldZ + noise`) → `runHydrology` → `buildStreams` → `buildBasins` → `buildDivide` → `buildContours` → `renderAll`. Ordering is the state contract: each builder reads `state.*` populated by the prior step.
- **priorityFlood** (Barnes 2014): min-heap raises pits to spill+EPS so every cell drains to the border. Deterministic pops (heap tie-breaks by insertion sequence).
- **computeD8**: steepest-descent of 8 neighbors, √2 diagonal correction; `dir<0` ⟺ border outlet (guaranteed after flood).
- **computeAccum**: descending-elevation order, one linear pass; mass-conserving (Σ outlet accum = N²).
- **Streams**: channel = accum ≥ threshold (Density control); heads have no upstream channel neighbor; trace downstream, STOP one cell past an already-drawn channel (junction merge — tributaries coincide, never braid); split into 3 weight classes at 8·T / 40·T.
- **Divide**: union-find basins (merge adjacent border outlets), keep k largest (k rolled 2–4); boundary between kept labels → `chainSegments` → Chaikin×2. Dual to the streams: crossing rate measured ≤2% (jitter + corner-cut grazing only).
- **Contours**: marching squares on the FILLED field (not raw terrain, so they never contradict the streams), 4/7 levels between the 5th–95th percentiles.

## Determinism contract
`Math.random` ONLY at seed choice + `randomizeAll`. Everything downstream of `randomSeed(state.masterSeed)` is pure. `jitterHash(idx,salt)` is pure (idx+salt+masterSeed). `makeNoise2D` is self-contained seeded value noise (masterSeed+7919) so canvas and Node harness agree exactly. Wobble parity: `wobblePts` reseeds from `pts[0].x*0.01+50` and feeds BOTH `drawPoly` and `polyToPath`.

## Aesthetic note
Steep smooth fold faces produce dense parallel D8 "rain curtains" — the 8-direction quantization made visible. It reads as strata/circuit-board texture and is intentional/documented; dendritic branching emerges in rougher ground. The noise-to-fold ratio (Roughness control) is the knob if you want more meander.

## Data-model gotchas
- `state.terr` = raw sampled terrain; `state.filled` = pit-filled (contours + hydrology use this, never mutate it — sorts operate on `Float64Array.from(f)` copies).
- Grid is row-major `idx = y*N + x`; sample at page point `PAD+(x+0.5)*cell`, world coords subtract CS/2.
- Container div id is `canvas-container` (Fold's CSS targets it; do NOT rename to canvas-holder).

## Lineage
- Sibling of [fold](https://github.com/lukaszlysakowski/fold) — same fold DNA, orthogonal treatment: Fold shows the sheet as an object in space, Watershed shows what water does to the same math from above.
- Flow accumulation / priority-flood / D8 = the textbook computational-hydrology pipeline, turned to plotter ends.
- Siblings: [palimpsest](https://github.com/lukaszlysakowski/palimpsest) (CSS/a11y source), [core-samples](https://github.com/lukaszlysakowski/core-samples), [second-reading](https://github.com/lukaszlysakowski/second-reading), [field-script](https://github.com/lukaszlysakowski/field-script)
- Design history + per-task review trail: `docs/superpowers/` and `.superpowers/sdd/progress.md`

## Architecture
- `index.html` / `index.js` — single maker, no build step, p5 vendored; static serve (launch config `watershed`, npx serve port 3462)

## Palette & A11y
Square 2170×2170. Paper #F7E6D4, ink #1A1613, divide red #A93B2A (only red on the page). Sidebar CSS from Fold/Palimpsest (WCAG-tuned: --muted #969082, .ctrl min-height 24px) — Lighthouse a11y 100; don't regress.

## Controls
Terrain (Folds / Character Soft–Mixed–Sharp / Roughness) · Water (Density Sparse–Medium–Dense–Flood / Detail grid 320–400–480) · Apparatus (Contours Off–Whisper–Light / Basins Off–Major–All) · Style (Wobble, default Off) · randomize / refresh / svg / png / png 4x · click canvas = new seed. randomize rerolls the aesthetic controls only (leaves Detail + Wobble). SVG pen passes: Border / Contours / Streams-fine / Streams-mid / Streams-trunk / Divide (red) / Signature.
