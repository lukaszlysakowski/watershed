# Task 1 Report — Scaffold: Page, Sidebar Shell, Seed Plumbing

## Status Tracking

- [x] Step 1: Copy vendored assets
- [x] Step 2: Adapt index.html
- [x] Step 3: Write index.js skeleton
- [x] Step 4: Write verify script
- [x] Step 5: Run verify
- [x] Step 6: Commit

## Progress

### Step 1: Copy vendored assets
**Status:** DONE
- Copied p5.min.js from /Users/lukasz/genuary-2026/sketches/fold/
- Copied p5-stub.js from /Users/lukasz/genuary-2026/sketches/second-reading/.superpowers/sdd/
- Copied index.html from /Users/lukasz/genuary-2026/sketches/fold/
- Commit: f8ee5dc

### Step 2: Adapt index.html
**Status:** DONE
- Changed title from "Fold" to "Watershed"
- Changed sidebar-title (h1) from "Fold" to "Watershed"
- Removed sidebar-sub subtitle line
- Removed all pre-built Fold control sections (kept #controls div empty)
- Kept style block byte-for-byte as required (a11y floor preserved)
- Renamed canvas container ID from "canvas-container" to "canvas-holder"
- Renamed button IDs to match brief requirements:
  - randomizeBtn → btn-random
  - refreshBtn → btn-refresh
  - svgBtn → btn-svg
  - pngBtn → btn-png
  - png4xBtn → btn-png4
- Verified required element IDs exist: canvas-holder, controls, btn-random, btn-refresh, btn-svg, btn-png, btn-png4
- CSS class names used (from Fold's CSS):
  - `.ctrl` for control row div
  - `.ctrl-name` for label span
  - `.ctrl-val` for value button
- Included in first commit: f8ee5dc

### Step 3: Write index.js skeleton
**Status:** DONE
- All constants defined: CS (2170), PAD (87), PAPER, INK, INK_RGB, RED, TBASE
- CONTROL_DEFS array with 8 controls matching requirements
- ui and state objects initialized with correct defaults
- Pipeline hooks declared (no-op functions): rollTerrain, buildGrid, runHydrology, buildStreams, buildBasins, buildDivide, buildContours
- regenerate(newSeed) function implemented with proper seed handling
- jitterHash(idx, salt) deterministic hash function (returns [-0.5, 0.5))
- wobblePts(pts) seeded wobble function (default OFF)
- drawPoly(pts) polyline renderer with wobble
- signatureText() format: "Watershed · seed N · <k> basins · <f> folds  YYYY-MM-DD HH:MM"
- renderAll() stub with proper rendering pipeline (contours, streams, divide, border, signature)
- setupControls() builds control panel using .ctrl-name and .ctrl-val class names (Fold's CSS)
- syncControlButtons(), randomizeAll() utility functions
- exportSVG(), exportPNG() stubs (Task 8 will replace)
- setup() and draw() p5 hooks
- mousePressed() regeneration hook
- Commit: b830ace

### Step 4: Write verify script
**Status:** DONE
- Created .superpowers/sdd/task-1-verify.js with 6 test checks
- Included in commit: b830ace

### Step 5: Run verify
**Status:** DONE
Output:
```
  ok  CS is 2170
  ok  PAD is 87
  ok  ui defaults
  ok  regenerate(false) keeps seed
  ok  jitterHash deterministic
  ok  signature format

6 passed, 0 failed
```

### Step 6: Commit
**Status:** DONE
- Commit 1 (f8ee5dc): Copy vendored assets
- Commit 2 (b830ace): Write index.js skeleton and verify script

## CSS Class Names Used

From inspection of Fold's index.html CSS:
- **Control row:** `.ctrl` (applied to div, matches Fold's `.ctrl` button styling via flex)
- **Label:** `.ctrl-name` (not `.lab` as default suggested in brief; uses Fold's actual CSS)
- **Value button:** `.ctrl-val` (not `.val` as default suggested in brief; uses Fold's actual CSS)

Note: The setupControls() function was adapted to use `.ctrl-name` and `.ctrl-val` to match Fold's CSS, following the brief's instruction "CSS wins; JS adapts".

## Final Results

**Status:** DONE

All steps completed successfully. Verify script passes all 6 checks.

Key deliverables:
- index.html: Watershed-titled, empty #controls panel, correct element IDs
- index.js: Complete skeleton with constants, state, pipeline stubs, and all required functions
- p5-stub.js and p5.min.js: Copied from source projects
- task-1-verify.js: Verify script with passing tests

Next task: Task 2 will implement rollTerrain() pipeline hook.

## Fix: canvas-container id restored (CSS wins over brief's canvas-holder id)

**Issue:** The copied CSS in index.html targeted `#canvas-container`, but the container div was renamed to `canvas-holder` in Step 2, causing CSS rules for canvas scaling and background to never apply. This resulted in the 2170px canvas overflowing the viewport.

**Resolution:**
1. Changed container div ID from `canvas-holder` to `canvas-container` (index.html line 232)
2. Changed p5 parent call from `c.parent('canvas-holder')` to `c.parent('canvas-container')` (index.js line 179)
3. Verify output:
```
  ok  CS is 2170
  ok  PAD is 87
  ok  ui defaults
  ok  regenerate(false) keeps seed
  ok  jitterHash deterministic
  ok  signature format

6 passed, 0 failed
```

The CSS now applies correctly and the canvas scales within the viewport as intended.
