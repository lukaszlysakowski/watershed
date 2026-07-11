// Task 2 verification: fold-field terrain + noise detail + grid sampling
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
vm.runInContext('globalThis.state = state; globalThis.ui = ui; globalThis.CS = CS; globalThis.PAD = PAD; globalThis.foldZ = foldZ; globalThis.terrainZ = terrainZ; renderAll = function () {};', sandbox);

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log(`  ok  ${name}`); }
    else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

// Continuity: no jumps at 0.5-unit steps
for (const seed of [100, 101, 102]) {
    vm.runInContext(`state.masterSeed = ${seed}; regenerate(false);`, sandbox);
    const maxAmp = vm.runInContext('Math.max(...state.folds.map(f => f.amp))', sandbox);
    let maxJump = 0;
    for (let x = -900; x <= 900; x += 150) {
        for (let y = -900; y <= 900; y += 150) {
            const z1 = vm.runInContext(`terrainZ(${x}, ${y})`, sandbox);
            const z2 = vm.runInContext(`terrainZ(${x + 0.5}, ${y})`, sandbox);
            maxJump = Math.max(maxJump, Math.abs(z2 - z1));
        }
    }
    check(`seed ${seed}: continuity (max jump ${maxJump.toFixed(3)} < ${maxAmp.toFixed(0)})`, maxJump < maxAmp);
}

// Superposition of foldZ
const superErr = vm.runInContext(`
    (function () {
        const f1 = { kind: 'sine', theta: 0.5, amp: 80, freq: 0.008, phase: 0.3 };
        const f2 = { kind: 'sharp', theta: 2.5, amp: 120, c: 50, w: 180 };
        let e = 0;
        for (let x = -200; x <= 200; x += 50)
            for (let y = -200; y <= 200; y += 50)
                e = Math.max(e, Math.abs(foldZ([f1], x, y) + foldZ([f2], x, y) - foldZ([f1, f2], x, y)));
        return e;
    })()
`, sandbox);
check('foldZ superposition', superErr < 1e-9, `${superErr}`);

// Character control
vm.runInContext('ui.character = 0; state.masterSeed = 42; regenerate(false);', sandbox);
check('Soft: no sharp folds', vm.runInContext("state.folds.filter(f => f.kind === 'sharp').length", sandbox) === 0);
vm.runInContext('ui.character = 2; state.masterSeed = 42; regenerate(false);', sandbox);
check('Sharp: >=1 sharp fold', vm.runInContext("state.folds.filter(f => f.kind === 'sharp').length", sandbox) >= 1);
vm.runInContext('ui.character = 1; ui.folds = 2; state.masterSeed = 42; regenerate(false);', sandbox);
check('folds=3 control', sandbox.state.folds.length === 3);

// Grid shape
vm.runInContext('ui.folds = 0; ui.detail = 0; state.masterSeed = 7; regenerate(false);', sandbox);
check('grid N=320', sandbox.state.grid.N === 320 && sandbox.state.terr.length === 320 * 320);
check('cell size', Math.abs(sandbox.state.grid.cell - (2170 - 174) / 320) < 1e-9);

// Determinism
vm.runInContext('state.masterSeed = 777; regenerate(false); globalThis.__t1 = state.terr[12345]; globalThis.__f1 = JSON.stringify(state.folds);', sandbox);
vm.runInContext('state.masterSeed = 777; regenerate(false); globalThis.__t2 = state.terr[12345]; globalThis.__f2 = JSON.stringify(state.folds);', sandbox);
check('determinism: terr + folds', sandbox.__t1 === sandbox.__t2 && sandbox.__f1 === sandbox.__f2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
