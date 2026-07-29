/**
 * The complete color palette. Five colors, nothing else.
 *
 * Every pixel drawn in this project comes from this file. The art direction
 * spec is strict about it: no gradients, no extra hues, no glossy anything.
 * If you need a new shade, dither two of these together instead of inventing
 * a sixth color.
 *
 * @see instruction.md - "Color Palette"
 */
export const PALETTE = {
  /** Warm parchment background. The paper the whole world is printed on. */
  bg: '#D7D1C3',
  /** Highlights, windows, road markings, UI accents. */
  light: '#B8B4A7',
  /** Building faces, buttons, road details. */
  mid: '#7A7772',
  /** Shadows, roofs, road borders, UI borders. */
  dark: '#44413F',
  /** Outlines, text, deep shadows, sprite borders. */
  black: '#262626',
};

/**
 * Ordered darkest -> lightest. Handy when you want to step a value one shade
 * darker for a shadow, or one lighter for a highlight, without hardcoding.
 */
export const RAMP = [PALETTE.black, PALETTE.dark, PALETTE.mid, PALETTE.light, PALETTE.bg];

/**
 * Nudges a palette color along {@link RAMP}.
 *
 * @param {string} color - a hex value that exists in RAMP
 * @param {number} delta - positive goes lighter, negative goes darker
 * @returns {string} the shifted color, clamped at both ends of the ramp
 */
export function shade(color, delta) {
  const i = RAMP.indexOf(color);
  if (i === -1) return color;
  return RAMP[Math.max(0, Math.min(RAMP.length - 1, i + delta))];
}
