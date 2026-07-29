/**
 * Low-level pixel drawing helpers.
 *
 * Everything in this project is drawn with `fillRect` on integer coordinates.
 * There are no images, no paths, no curves and no anti-aliasing anywhere - if
 * you find yourself reaching for `arc()` or a fractional coordinate, the result
 * will blur the moment the canvas is scaled up and it will look wrong next to
 * everything else.
 *
 * The world is drawn once at {@link TILE_PX} pixels per tile and then blitted
 * to the screen at an integer zoom with smoothing off. That is what keeps the
 * pixels square and identical in size across the whole scene.
 *
 * @see instruction.md - "Asset Rules", "Outline Rendering"
 */
import { PALETTE } from '../core/palette.js';

/** Internal resolution of one map tile, in pixels. */
export const TILE_PX = 16;

/**
 * Fills an axis-aligned rectangle, snapped to whole pixels.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {string} color
 */
export function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x | 0, y | 0, Math.max(1, w | 0), Math.max(1, h | 0));
}

/**
 * A one-pixel rectangle outline. Used for the dark border every object carries.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {string} color
 */
export function outline(ctx, x, y, w, h, color) {
  px(ctx, x, y, w, 1, color);
  px(ctx, x, y + h - 1, w, 1, color);
  px(ctx, x, y, 1, h, color);
  px(ctx, x + w - 1, y, 1, h, color);
}

/**
 * A 4x4 ordered dither matrix.
 *
 * The palette is five fixed colors, so the only way to get an intermediate tone
 * is to interleave two of them. This is how the explored-tile overlay reads as
 * "half shaded" without introducing a sixth color or any transparency.
 *
 * @see instruction.md - "Color Palette"
 */
const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** @type {Map<string, CanvasPattern>} */
const patternCache = new Map();

/**
 * A repeating 4x4 dither tile, as a canvas pattern.
 *
 * Filling pixel by pixel is not an option here: shading every explored tile of
 * a 25x25 city that way is ~160,000 `fillRect` calls per frame and the replay
 * drops to single-digit fps. A pattern turns each tile into one fill.
 *
 * Patterns anchor to the canvas origin, which is the same absolute alignment
 * the per-pixel version used - so a shaded region still reads as one continuous
 * surface rather than a grid of independently dithered squares.
 *
 * Density is quantized to the 17 levels the 4x4 matrix can actually express,
 * which also keeps the cache small when a pulsing value sweeps through it.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} color
 * @param {number} density - 0..1
 * @returns {CanvasPattern|string} a pattern, or the color itself when solid
 */
export function ditherPattern(ctx, color, density) {
  const level = Math.max(0, Math.min(16, Math.round(density * 16)));
  if (level >= 16) return color;

  const key = `${color}:${level}`;
  const cached = patternCache.get(key);
  if (cached) return cached;

  const tile = document.createElement('canvas');
  tile.width = 4;
  tile.height = 4;
  const tctx = tile.getContext('2d');
  tctx.fillStyle = color;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      if (BAYER_4[y][x] < level) tctx.fillRect(x, y, 1, 1);
    }
  }

  const pattern = ctx.createPattern(tile, 'repeat');
  patternCache.set(key, pattern);
  return pattern;
}

/**
 * Fills a rectangle with a dithered wash of `color`.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {string} color
 * @param {number} density - 0 draws nothing, 1 fills solid
 */
export function dither(ctx, x, y, w, h, color, density) {
  if (density <= 0) return;
  ctx.fillStyle = ditherPattern(ctx, color, density);
  ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

/**
 * A cheap deterministic hash, used to give each tile stable variation.
 *
 * Calling this instead of a live RNG matters: the terrain is repainted whenever
 * the grid changes, and a live RNG would reshuffle every rooftop and speck of
 * road grit on each repaint. Keyed off the tile's own coordinates, the noise
 * stays put.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} [salt=0] - vary to get an independent value for the same tile
 * @returns {number} a float in [0, 1)
 */
export function hash2(x, y, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Draws the corner-bracket selection cursor.
 *
 * Corners only, never a filled square - the reference art uses this exact shape
 * and a solid highlight would hide the tile underneath.
 *
 *     |‾   ‾|
 *     |_   _|
 *
 * @see instruction.md - "Selection Cursor"
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - tile origin
 * @param {number} y - tile origin
 * @param {string} [color=PALETTE.black]
 * @param {number} [len=5] - bracket arm length
 */
export function drawBrackets(ctx, x, y, color = PALETTE.black, len = 5) {
  const s = TILE_PX;
  const corners = [
    [0, 0, 1, 1],
    [s - 1, 0, -1, 1],
    [0, s - 1, 1, -1],
    [s - 1, s - 1, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    for (let i = 0; i < len; i++) {
      px(ctx, x + cx + dx * i, y + cy, 1, 1, color);
      px(ctx, x + cx, y + cy + dy * i, 1, 1, color);
    }
  }
}
