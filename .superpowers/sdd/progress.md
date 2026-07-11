# Watershed — SDD Progress Ledger

## Timeout-resilience protocol (binding)
- Implementers: commit incrementally after each step; create task-N-report.md at task START and update as you go.
- Controller: a tiny result or "session limit" text = limit-killed subagent. Do NOT re-dispatch until reset; salvage from git + working tree first.
- Fallback: CONTROLLER INLINE with explicit ledger attribution.
- Final review: fresh independent subagent (most capable model), zero deference to any inline work.

## Task log
Task 1: complete (commits f8ee5dc..6b4b788, review clean after canvas-container id fix; container id is canvas-container NOT canvas-holder — CSS wins)
Task 2: complete (commit d008e88, verify 10/10, spec clean). Important finding (verify+report untracked due to nested sdd .gitignore '*') fixed CONTROLLER INLINE in 4d4500a+52d7900. Minors for final review: (a) terrainZ/rollTerrain declaration order swapped vs brief (inert, hoisted); (b) task-2-report prose says "2-5" where code/spec say 2-4.
Task 3: complete (commits 6e5dcc5..dc34bf6, verify 6/6, review clean; verbatim byte-match confirmed)
Task 4: complete (commits ef47c7a..5611dd7, verify 8/8, review clean; junction-stop + class-split verified)
Task 5: complete (commits d4913de..f1f4df5, verify 7/7, review clean; crossing rate 0.00%)
Task 6: complete (commit 848d6da, verify 5/5, review clean; byte-identical transcription)
Task 7: complete (commit e8c92b6, verify 7/7, review clean; no defects; TBASE calibration confirmed)
Task 7: complete (commits e8c92b6..7d9480b, verify 7/7, review clean; index.js untouched, no defects found; Minor: report header said In Progress while Results said PASS)
Task 8: complete (commit fbba36a, verify 15/15, review clean; byte-identical; Minor note: empty passes omit their SVG group entirely)
Task 9: complete (commits e896321..ba51e65, soak 2/2 — 5 seeds N=400, 8-19k verts, ~1.7s each, review clean)
