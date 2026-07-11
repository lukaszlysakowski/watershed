// Task 5 verification: basins + red divide
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

vm.runInContext('ui.detail = 0; ui.density = 2; ui.basins = 1; state.masterSeed = 4242; regenerate(false);', sandbox);
const st = sandbox.state;
const N = st.grid.N;

check('divide exists (Major)', st.divide.length > 0, `${st.divide.length}`);
check('keptCount in 2..4', st.keptCount >= 2 && st.keptCount <= 4, `${st.keptCount}`);
check('labels bounded by keptCount', (() => {
    let max = -1;
    for (let i = 0; i < N * N; i++) max = Math.max(max, st.label[i]);
    return max === st.keptCount - 1;
})());

// divide-vs-stream crossing rate (sampled): dual structures — expect near zero
function segInt(p1, p2, p3, p4) {
    const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (Math.abs(d) < 1e-12) return false;
    const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
    const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
    return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
}
let divSegs = [];
for (const pl of st.divide)
    for (let i = 0; i < pl.length - 1; i += 4) divSegs.push([pl[i], pl[i + 1]]);
let strSegs = [];
for (const s of st.streams)
    for (let i = 0; i < s.pts.length - 1; i += 3) strSegs.push([s.pts[i], s.pts[i + 1]]);
let crossings = 0;
const sampleDiv = divSegs.filter((_, i) => i % 3 === 0);
for (const d of sampleDiv)
    for (const s of strSegs)
        if (segInt(d[0], d[1], s[0], s[1])) { crossings++; break; }
const rate = sampleDiv.length ? crossings / sampleDiv.length : 0;
check('divide/stream crossing rate <= 2%', rate <= 0.02, `${(rate * 100).toFixed(2)}% of ${sampleDiv.length}`);

// Off mode
vm.runInContext('ui.basins = 0; regenerate(false);', sandbox);
check('Off: no divide', sandbox.state.divide.length === 0);
vm.runInContext('ui.basins = 2; regenerate(false);', sandbox);
check('All mode runs', Array.isArray(sandbox.state.divide));

// determinism
vm.runInContext('ui.basins = 1; state.masterSeed = 55; regenerate(false); globalThis.__d1 = JSON.stringify(state.divide.slice(0, 2));', sandbox);
vm.runInContext('state.masterSeed = 55; regenerate(false); globalThis.__d2 = JSON.stringify(state.divide.slice(0, 2));', sandbox);
check('determinism: divide', sandbox.__d1 === sandbox.__d2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
