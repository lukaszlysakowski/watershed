### Task 8: Export — SVG pen passes + PNG

**Files:**
- Modify: `index.js` (replace `exportSVG`/`exportPNG` stubs; add `polyToPath`, `svgPass`, `buildSVG`)
- Test: `.superpowers/sdd/task-8-verify.js`

**Interfaces:**
- Consumes: `state.streams/divide/contours`, `wobblePts`, `signatureText`.
- Produces: `buildSVG() → string` (7 passes: Border, Contours, Streams-fine, Streams-mid, Streams-trunk, Divide, Signature; M/L-only paths; red only in Divide); `exportSVG()` downloads it; `exportPNG(scale)` re-renders at pixelDensity and saves (`scale` 1 or 4).

- [ ] **Step 1: Implement**

```javascript
function polyToPath(pts) {
    const w = wobblePts(pts);
    let d = `M ${w[0].x.toFixed(2)} ${w[0].y.toFixed(2)}`;
    for (let i = 1; i < w.length; i++) d += ` L ${w[i].x.toFixed(2)} ${w[i].y.toFixed(2)}`;
    return d;
}

function svgPass(label, color, weight, paths) {
    if (!paths.length) return '';
    let s = `  <g id="${label}" inkscape:groupmode="layer" inkscape:label="${label}" ` +
        `stroke="${color}" stroke-width="${weight}" fill="none" ` +
        `stroke-linecap="round" stroke-linejoin="round">\n`;
    for (const d of paths) s += `    <path d="${d}"/>\n`;
    s += '  </g>\n';
    return s;
}

function buildSVG() {
    const contourPaths = state.contours.map(polyToPath);
    const finePaths = [], midPaths = [], trunkPaths = [];
    for (const s of state.streams) {
        [finePaths, midPaths, trunkPaths][s.cls].push(polyToPath(s.pts));
    }
    const dividePaths = state.divide.map(polyToPath);
    const borderPath = `M ${PAD} ${PAD} L ${CS - PAD} ${PAD} L ${CS - PAD} ${CS - PAD} ` +
        `L ${PAD} ${CS - PAD} L ${PAD} ${PAD}`;
    let s = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        `<svg xmlns="http://www.w3.org/2000/svg" ` +
        `xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" ` +
        `width="${CS}" height="${CS}" viewBox="0 0 ${CS} ${CS}">\n`;
    s += `  <rect width="${CS}" height="${CS}" fill="${PAPER}"/>\n`;
    s += svgPass('Border', INK, 0.9, [borderPath]);
    s += svgPass('Contours', INK, 0.35, contourPaths);
    s += svgPass('Streams-fine', INK, 0.45, finePaths);
    s += svgPass('Streams-mid', INK, 0.7, midPaths);
    s += svgPass('Streams-trunk', INK, 1.0, trunkPaths);
    s += svgPass('Divide', RED, 1.0, dividePaths);
    s += `  <g id="Signature" inkscape:groupmode="layer" inkscape:label="Signature">\n` +
        `    <text x="${PAD}" y="${CS - PAD + 44}" font-family="monospace" font-size="26" ` +
        `fill="${INK}">${signatureText()}</text>\n  </g>\n`;
    s += '</svg>\n';
    return s;
}

function exportSVG() {
    const blob = new Blob([buildSVG()], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `watershed-seed${state.masterSeed}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
}

function exportPNG(scale) {
    pixelDensity(scale);
    renderAll();
    saveCanvas(`watershed-seed${state.masterSeed}-${scale}x`, 'png');
    pixelDensity(1);
    renderAll();
}
```

- [ ] **Step 2: Write verify script**

`.superpowers/sdd/task-8-verify.js` (boilerplate, then):

```javascript
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
```

- [ ] **Step 3: Run verify**

Run: `node .superpowers/sdd/task-8-verify.js`
Expected: `15 passed, 0 failed`

Note: the p5-stub must expose `randomSeed/random` used by `wobblePts` — it already does (Task 1 boilerplate). If `saveCanvas`/`pixelDensity` are missing from the stub, add no-ops to the SANDBOX in the verify script, not to the stub file.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Task 8: SVG pen passes + PNG/PNG-4x export"
```

---

