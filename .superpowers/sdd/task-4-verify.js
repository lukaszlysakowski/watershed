// Task 4 verification: streams exist, classes assigned, points in bounds, deterministic
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

vm.runInContext('ui.detail = 0; ui.density = 2; state.masterSeed = 4242; regenerate(false);', sandbox);
const st = sandbox.state;
const N = st.grid.N, cell = st.grid.cell, PAD = sandbox.PAD, CS = sandbox.CS;

check('streams exist', st.streams.length > 0, `${st.streams.length}`);
check('all runs have >=2 pts', st.streams.every(s => s.pts.length >= 2));
check('classes in {0,1,2}', st.streams.every(s => s.cls === 0 || s.cls === 1 || s.cls === 2));
check('all three classes present', new Set(st.streams.map(s => s.cls)).size === 3);

// all points inside drawable region (+1 cell tolerance for jitter)
const inPage = st.streams.every(s => s.pts.every(p =>
    p.x > PAD - cell && p.x < CS - PAD + cell && p.y > PAD - cell && p.y < CS - PAD + cell));
check('points within drawable region', inPage);

// no duplicated channel drawing: total interior vertices bounded by channel cell count + junction re-touches
let chan = 0;
for (let i = 0; i < N * N; i++) if (st.accum[i] >= st.threshold) chan++;
let verts = 0;
for (const s of st.streams) verts += s.pts.length;
check('vertex count ~ channel cells (no braided duplicates)',
    verts <= chan + 2 * st.streams.length, `verts ${verts}, channels ${chan}, runs ${st.streams.length}`);

// density: Flood yields more stream vertices than Sparse
vm.runInContext('ui.density = 0; regenerate(false); globalThis.__vS = state.streams.reduce((a, s) => a + s.pts.length, 0);', sandbox);
vm.runInContext('ui.density = 3; regenerate(false); globalThis.__vF = state.streams.reduce((a, s) => a + s.pts.length, 0);', sandbox);
check('Flood > Sparse vertices', sandbox.__vF > sandbox.__vS, `${sandbox.__vF} vs ${sandbox.__vS}`);

// determinism
vm.runInContext('ui.density = 2; state.masterSeed = 31; regenerate(false); globalThis.__s1 = JSON.stringify(state.streams.slice(0, 5));', sandbox);
vm.runInContext('state.masterSeed = 31; regenerate(false); globalThis.__s2 = JSON.stringify(state.streams.slice(0, 5));', sandbox);
check('determinism: streams', sandbox.__s1 === sandbox.__s2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
