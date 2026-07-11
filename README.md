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

Note: **randomize** rerolls the aesthetic controls (terrain, water, apparatus) with a new
seed; Detail (grid resolution) and Wobble are deliberately left as you set them.
