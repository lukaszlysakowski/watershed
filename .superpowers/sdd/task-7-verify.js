// Task 7 verification: full-pipeline control effects (integration check)
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

function run(setup) {
    vm.runInContext(`
        ui.folds = 0; ui.character = 1; ui.rough = 1; ui.density = 2;
        ui.detail = 0; ui.contours = 1; ui.basins = 1; ui.wobble = 0;
        ${setup}
        regenerate(false);
        globalThis.__snap = {
            streams: state.streams.length,
            verts: state.streams.reduce((a, s) => a + s.pts.length, 0),
            contours: state.contours.length,
            divide: state.divide.length
        };
    `, sandbox);
    return sandbox.__snap;
}

const base = run('state.masterSeed = 4242;');
check('base: all layers populated', base.streams > 0 && base.contours > 0 && base.divide > 0);
check('base: dense default yields >2000 stream vertices', base.verts > 2000, `${base.verts}`);

const sparse = run('state.masterSeed = 4242; ui.density = 0;');
const flood = run('state.masterSeed = 4242; ui.density = 3;');
check('density monotone: sparse < base < flood', sparse.verts < base.verts && base.verts < flood.verts,
    `${sparse.verts} / ${base.verts} / ${flood.verts}`);

const rough0 = run('state.masterSeed = 4242; ui.rough = 0;');
const rough2 = run('state.masterSeed = 4242; ui.rough = 2;');
check('roughness changes geometry', rough0.verts !== rough2.verts);

const noApp = run('state.masterSeed = 4242; ui.contours = 0; ui.basins = 0;');
check('pure structure: no apparatus', noApp.contours === 0 && noApp.divide === 0 && noApp.streams > 0);

// full determinism across whole pipeline
vm.runInContext('state.masterSeed = 4242; ui.density = 2; ui.contours = 1; ui.basins = 1; regenerate(false); globalThis.__w1 = JSON.stringify({ s: state.streams, d: state.divide, c: state.contours });', sandbox);
vm.runInContext('state.masterSeed = 4242; regenerate(false); globalThis.__w2 = JSON.stringify({ s: state.streams, d: state.divide, c: state.contours });', sandbox);
check('full-pipeline determinism', sandbox.__w1 === sandbox.__w2);

// three fresh seeds survive the pipeline
let ok = 0;
for (const seed of [11, 222, 3333]) {
    const s = run(`state.masterSeed = ${seed};`);
    if (s.streams > 0 && s.verts > 200) ok++;
}
check('3 fresh seeds all viable', ok === 3, `${ok}/3`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
