// p5 stub for Node.js testing — seeded random + trig/math helpers
// Provides: random(a?, b?, arr?), randomSeed(seed), radians, cos/sin, floor, constrain, pow, min/max
// Constants: HALF_PI, TWO_PI, PI, CLOSE

// Splitmix32 PRNG (deterministic, seeded)
function createRNG(seed) {
  let x = seed >>> 0;
  return function() {
    x |= 0;
    x = (x + 0x6d2b79f5) | 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let currentRng = createRNG(42);
let noiseSeedValue = 0;

function installP5Stub() {
  const stubs = {
    random: function(a, b, arr) {
      if (Array.isArray(a)) {
        // random(arr)
        const idx = Math.floor(currentRng() * a.length);
        return a[idx];
      } else if (a !== undefined && b === undefined) {
        // random(max)
        return currentRng() * a;
      } else if (a !== undefined && b !== undefined) {
        // random(min, max)
        return a + currentRng() * (b - a);
      } else {
        // random()
        return currentRng();
      }
    },
    randomSeed: function(seed) {
      currentRng = createRNG(seed >>> 0);
    },
    noiseSeed: function(seed) {
      noiseSeedValue = seed >>> 0;
    },
    noise: function(x, y, z) {
      // Deterministic hash-based stand-in for p5's Perlin noise.
      // Not spatially coherent, but stable per-input and in [0,1] — sufficient
      // for testing segment counts / gating logic, not visual smoothness.
      x = x || 0; y = y || 0; z = z || 0;
      let h = noiseSeedValue;
      h = Math.imul(h ^ Math.floor(x * 73856093), 2654435761);
      h = Math.imul(h ^ Math.floor(y * 19349663) ^ (x * 1000 | 0), 2246822519);
      h = Math.imul(h ^ Math.floor(z * 83492791) ^ (y * 1000 | 0), 3266489917);
      h = (h ^ (h >>> 13)) >>> 0;
      return (h % 1000000) / 1000000;
    },
    radians: function(degrees) {
      return degrees * (Math.PI / 180);
    },
    degrees: function(radians) {
      return radians * (180 / Math.PI);
    },
    cos: Math.cos,
    sin: Math.sin,
    tan: Math.tan,
    sqrt: Math.sqrt,
    abs: Math.abs,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    constrain: function(val, min, max) {
      return Math.max(min, Math.min(max, val));
    },
    pow: Math.pow,
    min: Math.min,
    max: Math.max,
    dist: function(x1, y1, x2, y2) {
      return Math.sqrt((x2-x1)*(x2-x1) + (y2-y1)*(y2-y1));
    },
    atan2: Math.atan2,
    PI: Math.PI,
    HALF_PI: Math.PI / 2,
    TWO_PI: Math.PI * 2,
    CLOSE: 'CLOSE'
  };

  return stubs;
}

module.exports = { installP5Stub, createRNG };
