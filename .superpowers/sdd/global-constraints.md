## Global Constraints

- Canvas `CS = 2170`, `PAD = Math.round(CS * 0.04)` (= 87). Paper `#F7E6D4`, ink `#1A1613` (rgb 26,22,19), red `#A93B2A`. Red appears ONLY in the Divide pass.
- Determinism contract: `Math.random` ONLY at seed choice (`regenerate(true)`) and `randomizeAll`. Everything downstream of `randomSeed(state.masterSeed)` is deterministic. Cell jitter and wobble use seeded hashes/reseeds, never `Math.random`.
- Wobble parity: canvas and SVG both wobble via `wobblePts`, seeded from `pts[0].x * 0.01 + 50`. Default OFF.
- SVG pen passes, exact labels and weights: Border ink 0.9 · Contours ink 0.35 · Streams-fine ink 0.45 · Streams-mid ink 0.7 · Streams-trunk ink 1.0 · Divide red 1.0 · Signature ink. Paths are M/L-only.
- Signature: `Watershed · seed N · <k> basins · <f> folds  YYYY-MM-DD HH:MM`.
- A11y floor: sidebar CSS copied from Fold (`--muted: #969082`, `.ctrl` min-height 24px). Never regress.
- Read-only sources (NEVER modify): `/Users/lukasz/genuary-2026/sketches/fold/*`, `/Users/lukasz/genuary-2026/sketches/second-reading/*`, `/Users/lukasz/genuary-2026/sketches/palimpsest/*`.
- Timeout-resilience protocol (controller + implementers): incremental commits after each step, write `.superpowers/sdd/task-N-report.md` EARLY (create at task start, update as you go), so a session-limit kill loses nothing. Controller: detect limit-killed subagents (tiny result / "session limit"), salvage from git + working tree, CONTROLLER INLINE fallback with ledger attribution, final review by a fresh independent subagent.
- Controller note: after Task 1, add launch config `watershed` (npx serve `/Users/lukasz/genuary-2026/sketches/watershed` --listen 3462, port 3462) to `/Users/lukasz/claude/self-redaction/.claude/launch.json` — controller does this inline; implementers never touch files outside the repo.

---
