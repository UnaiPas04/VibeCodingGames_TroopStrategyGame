// Seeded random numbers (mulberry32). Same seed -> same sequence: reproducible levels and bugs.

/** @param {number} seed */
export function createRng(seed = Date.now()) {
  let state = seed >>> 0;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    seed,
    /** Float in [0, 1). */
    next,
    /** Float in [min, max). */
    range: (/** @type {number} */ min, /** @type {number} */ max) => min + next() * (max - min),
    /** Integer in [min, max] (inclusive). */
    int: (/** @type {number} */ min, /** @type {number} */ max) => min + Math.floor(next() * (max - min + 1)),
    /** @template T @param {T[]} list @returns {T} */
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (/** @type {number} */ p) => next() < p,
    /** New array with the items in random order (Fisher-Yates). @template T @param {readonly T[]} list @returns {T[]} */
    shuffle(list) {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    }
  };
}

/** @typedef {ReturnType<typeof createRng>} Rng */
