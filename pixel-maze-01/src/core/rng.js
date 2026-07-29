/**
 * Seeded pseudo-random number generation.
 *
 * Every procedural thing in the project - the city layout, rooftop clutter,
 * facade windows, floor dithering - pulls from a seeded stream rather than
 * Math.random. That buys two things: a city can be regenerated exactly from its
 * seed code, and a building's rooftop stops reshuffling itself on every repaint.
 */

/**
 * mulberry32: a small, fast, good-enough 32-bit generator.
 *
 * @param {number} seed - any 32-bit integer
 * @returns {() => number} a function yielding floats in [0, 1)
 * @see {@link https://github.com/bryc/code/blob/master/jshash/PRNGs.md}
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Wraps a raw generator with the helpers the art and level code actually want.
 *
 * @param {number} seed
 * @returns {{next: () => number, int: (min: number, max: number) => number,
 *            chance: (p: number) => boolean, pick: <T>(arr: T[]) => T,
 *            shuffle: <T>(arr: T[]) => T[]}}
 */
export function createRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    /** Integer in [min, max], inclusive on both ends. */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    /** True with probability p. */
    chance: (p) => next() < p,
    /** One element of arr. */
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** A shuffled copy of arr (Fisher-Yates). */
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

/** Characters used for the short human-typeable seed codes shown in the HUD. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Renders a numeric seed as a five-character code like "K7QW2".
 *
 * @param {number} seed
 * @returns {string}
 */
export function seedToCode(seed) {
  let n = seed >>> 0;
  let out = '';
  for (let i = 0; i < 5; i++) {
    out = ALPHABET[n % ALPHABET.length] + out;
    n = Math.floor(n / ALPHABET.length);
  }
  return out;
}

/**
 * Parses a code produced by {@link seedToCode} back into its seed.
 *
 * @param {string} code
 * @returns {number|null} the seed, or null if the code contains bad characters
 */
export function codeToSeed(code) {
  const clean = String(code).toUpperCase().trim();
  let n = 0;
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i === -1) return null;
    n = n * ALPHABET.length + i;
  }
  return n >>> 0;
}

/** A fresh random seed, for when the player just wants a new city. */
export function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
