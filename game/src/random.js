// Sky Courier — small deterministic random helpers.
// The world is built from a seed so a screenshot scene (or a replay) is the
// same every run: `mulberry32` is the PRNG, `hashSeed` turns a seed number
// into a stream, and the terrain height function is analytic (no noise
// tables), so the physics and the mesh always agree.

/** Deterministic PRNG: returns a function yielding [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn any seed value into a 32-bit integer. */
export function hashSeed(seed) {
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Smoothstep helper used by the terrain falloff. */
export function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Linear interpolation. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Clamp a value into [min, max]. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
