// Task 3 verification: hydrology core — priority-flood, D8, accumulation
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { installP5Stub } = require('./p5-stub.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'index.js'), 'utf8');
const sandbox = Object.assign({}, installP5Stub(), {
    console,
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch: () => ({ catch: () => {} }),
    confirm: () => false,
    document: { getElementById: () => null, createElement: () => ({ click: () => {} }) },
    Blob: function () {}, URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
    window: {}
});
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox);
// index.js declares state/ui/CS/PAD with const — lexical bindings are NOT sandbox
// properties, so export them explicitly for direct sandbox.X reads below.
vm.runInContext('globalThis.state = state; globalThis.ui = ui; globalThis.CS = CS; globalThis.PAD = PAD; renderAll = function () {};', sandbox);

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log(`  ok  ${name}`); }
    else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

vm.runInContext('ui.detail = 0; state.masterSeed = 4242; regenerate(false);', sandbox);
const N = sandbox.state.grid.N;
const dir = sandbox.state.dir;
const filled = sandbox.state.filled;
const accum = sandbox.state.accum;

// 1. Outlets only on border; interior cells always drain
let badInterior = 0, badOutlet = 0;
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const border = x === 0 || y === 0 || x === N - 1 || y === N - 1;
    if (dir[i] < 0 && !border) badInterior++;
    if (dir[i] >= 0 && !(filled[dir[i]] < filled[i])) badOutlet++;
}
check('interior cells all drain', badInterior === 0, `${badInterior} stranded`);
check('strict descent along dir', badOutlet === 0, `${badOutlet} non-descending`);

// 2. Every cell reaches an outlet without cycling
let cycles = 0;
for (let i = 0; i < N * N; i += 7) {
    let j = i, steps = 0;
    while (dir[j] >= 0 && steps <= N * N) { j = dir[j]; steps++; }
    if (steps > N * N) cycles++;
}
check('no flow cycles (sampled)', cycles === 0, `${cycles}`);

// 3. Mass conservation: rain in = flow out
let out = 0;
for (let i = 0; i < N * N; i++) if (dir[i] < 0) out += accum[i];
check('mass conservation', Math.abs(out - N * N) < 1e-6, `${out} vs ${N * N}`);

// 4. Threshold scales with density control
vm.runInContext('ui.density = 0; regenerate(false); globalThis.__tS = state.threshold;', sandbox);
vm.runInContext('ui.density = 3; regenerate(false); globalThis.__tF = state.threshold;', sandbox);
check('Sparse threshold > Flood threshold', sandbox.__tS > sandbox.__tF, `${sandbox.__tS} vs ${sandbox.__tF}`);

// 5. Determinism
vm.runInContext('ui.density = 2; state.masterSeed = 99; regenerate(false); globalThis.__a1 = state.accum[5000];', sandbox);
vm.runInContext('state.masterSeed = 99; regenerate(false); globalThis.__a2 = state.accum[5000];', sandbox);
check('determinism: accum', sandbox.__a1 === sandbox.__a2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
