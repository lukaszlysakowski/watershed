# Task 3: Hydrology Core — Priority-Flood, D8, Accumulation

## Status: COMPLETE

### Checklist
- [x] Step 1: Implement hydrology functions in index.js
- [x] Step 2: Write verify script (task-3-verify.js)
- [x] Step 3: Run verify (expect 6 passed, 0 failed)
- [x] Step 4: Commit

### Implementation Notes

#### Direction tables (DX, DY, DDIST)
- 8-neighbor offsets: diagonal first (0-3 diagonals, 4-7 cardinal)
- DX: [-1, 0, 1, -1, 1, -1, 0, 1]
- DY: [-1, -1, -1, 0, 0, 1, 1, 1]
- DDIST: [√2, 1, √2, 1, 1, √2, 1, √2]

#### MinHeap
- Binary min-heap with (key, sequence) ordering for determinism
- Guarantees reproducible pops even with tied keys
- Properties: k (keys), s (sequence numbers), v (values)

#### priorityFlood(terr, N)
- Barnes 2014 algorithm: raise pits to spill level
- Boundary cells seeded first, expanded inward
- EPS = max(terrain_range) * 1e-6 ensures monotonic increase
- Returns Float64Array filled

#### computeD8(filled, N)
- D8 steepest descent: each cell flows to lowest neighbor
- Outlets only on border (interior cells always have valid downstream)
- Returns Int32Array dir (cell index or -1 for outlets)

#### computeAccum(filled, dir, N)
- Flow accumulation: each cell contributes 1 to downstream
- Sort by descending elevation for proper topological order
- Returns Float64Array accum

### Test Results (2026-07-11 14:32 UTC)

```
$ node .superpowers/sdd/task-3-verify.js
  ok  interior cells all drain
  ok  strict descent along dir
  ok  no flow cycles (sampled)
  ok  mass conservation
  ok  Sparse threshold > Flood threshold
  ok  determinism: accum

6 passed, 0 failed
```

**Result:** ✓ All tests passed. Runtime: ~2.4s at N=320.

### Commits
- **6e5dcc5** (main) Task 3: hydrology core — priority-flood, D8, accumulation
  - index.js: DX/DY/DDIST tables, MinHeap class, priorityFlood/computeD8/computeAccum, runHydrology()
  - task-3-verify.js: 6 tests covering drainage, flow descent, cycles, conservation, density scaling, determinism
  - task-3-report.md: this report

### Final Status
✓ All 6 verification tests passed
✓ Code committed and tracked
✓ Ready for next task (Stream extraction, buildStreams)
