// Task 6 verification: whisper contours via marching squares
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

vm.runInContext('ui.detail = 0; ui.contours = 1; state.masterSeed = 4242; regenerate(false);', sandbox);
const st = sandbox.state;
const N = st.grid.N, cell = st.grid.cell, PAD = sandbox.PAD, CS = sandbox.CS;

check('Whisper: contours exist', st.contours.length > 0, `${st.contours.length}`);

// each chain is closed, or both endpoints lie near the grid edge
const edgeTol = 1.6 * cell;
let bad = 0;
for (const pl of st.contours) {
    const a = pl[0], b = pl[pl.length - 1];
    const closed = Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
    const nearEdge = p =>
        p.x < PAD + edgeTol || p.y < PAD + edgeTol ||
        p.x > CS - PAD - edgeTol || p.y > CS - PAD - edgeTol;
    if (!closed && !(nearEdge(a) && nearEdge(b))) bad++;
}
check('chains closed or edge-terminated', bad === 0, `${bad} of ${st.contours.length}`);

vm.runInContext('ui.contours = 0; regenerate(false);', sandbox);
check('Off: none', sandbox.state.contours.length === 0);
vm.runInContext('ui.contours = 2; regenerate(false);', sandbox);
check('Light: contours exist', sandbox.state.contours.length > 0);

vm.runInContext('ui.contours = 1; state.masterSeed = 88; regenerate(false); globalThis.__c1 = JSON.stringify(state.contours.slice(0, 3));', sandbox);
vm.runInContext('state.masterSeed = 88; regenerate(false); globalThis.__c2 = JSON.stringify(state.contours.slice(0, 3));', sandbox);
check('determinism: contours', sandbox.__c1 === sandbox.__c2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
