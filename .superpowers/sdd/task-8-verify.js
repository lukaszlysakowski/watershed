// Task 8 verification: SVG pen passes + PNG export
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

// Task 8 tests
vm.runInContext('ui.detail = 0; ui.density = 2; ui.contours = 1; ui.basins = 1; ui.wobble = 0; state.masterSeed = 4242; regenerate(false);', sandbox);
const svg = vm.runInContext('buildSVG()', sandbox);

const labels = ['Border', 'Contours', 'Streams-fine', 'Streams-mid', 'Streams-trunk', 'Divide', 'Signature'];
for (const l of labels) {
    check(`pass present: ${l}`, svg.includes(`inkscape:label="${l}"`));
}
check('exactly 7 layer groups', (svg.match(/inkscape:groupmode="layer"/g) || []).length === 7);

// red only in the Divide pass
const groups = svg.split('<g ').slice(1);
let redOK = true;
for (const g of groups) {
    if (g.includes('#A93B2A') && !g.startsWith('id="Divide"')) redOK = false;
}
check('red only in Divide', redOK);

// M/L-only path data
const ds = [...svg.matchAll(/ d="([^"]+)"/g)].map(m => m[1]);
check('paths exist', ds.length > 10, `${ds.length}`);
check('M/L-only paths', ds.every(d => /^M( -?\d+(\.\d+)?){2}( L( -?\d+(\.\d+)?){2})+$/.test(d.replace(/ +/g, ' '))));

check('viewBox correct', svg.includes('viewBox="0 0 2170 2170"'));
check('signature in svg', /Watershed · seed 4242 · \d+ basins/.test(svg));

// wobble parity: wobble ON changes both canvas geometry source and svg identically per call
vm.runInContext('ui.wobble = 1;', sandbox);
const w1 = vm.runInContext('buildSVG()', sandbox);
const w2 = vm.runInContext('buildSVG()', sandbox);
check('wobble deterministic across builds', w1 === w2);
check('wobble changes geometry', w1 !== svg);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
