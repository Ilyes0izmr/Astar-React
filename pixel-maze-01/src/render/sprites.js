/**
 * Everything that moves or reacts: markers, the vehicle, and the overlays that
 * visualize the search.
 *
 * These repaint every frame, so they draw straight onto the scene canvas rather
 * than into a cached layer.
 *
 * @see instruction.md - "Path Visualization", "Vehicle Design", "Start Marker"
 */
import { PALETTE } from '../core/palette.js';
import { px, dither, TILE_PX } from './art.js';

/** Facing directions for the vehicle. */
export const DIR = { N: 0, E: 1, S: 2, W: 3 };

/**
 * Works out which way a vehicle is pointing when it moves between two cells.
 *
 * @param {import('../core/grid.js').Grid} grid
 * @param {number} from - flat index
 * @param {number} to - flat index
 * @returns {number} a {@link DIR} value
 */
export function directionBetween(grid, from, to) {
  const w = grid.width;
  const dr = Math.floor(to / w) - Math.floor(from / w);
  if (dr < 0) return DIR.N;
  if (dr > 0) return DIR.S;
  return (to % w) - (from % w) > 0 ? DIR.E : DIR.W;
}

/**
 * Shades a tile the search has already settled.
 *
 * Dithered rather than solid: the road texture stays visible underneath, so a
 * large explored region reads as "been here" instead of erasing the map.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} [density=0.4]
 */
export function drawExplored(ctx, x, y, density = 0.3) {
  dither(ctx, x, y, TILE_PX, TILE_PX, PALETTE.mid, density);
}

/**
 * Draws a frontier tile - a cell queued but not yet expanded.
 *
 * The pulse is driven by the caller so every frontier tile breathes in sync,
 * which reads as one advancing wave rather than a field of flickering squares.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} pulse - 0..1, typically a sine of elapsed time
 */
export function drawFrontier(ctx, x, y, pulse) {
  const s = TILE_PX;
  dither(ctx, x, y, s, s, PALETTE.dark, 0.25 + pulse * 0.35);
  px(ctx, x + 1, y + 1, s - 2, 1, PALETTE.dark);
  px(ctx, x + 1, y + s - 2, s - 2, 1, PALETTE.dark);
  px(ctx, x + 1, y + 1, 1, s - 2, PALETTE.dark);
  px(ctx, x + s - 2, y + 1, 1, s - 2, PALETTE.dark);
}

/**
 * Draws a tile of the final path as a dark corridor.
 *
 * The `mask` argument carries which sides continue along the path, so the
 * corridor connects into a single unbroken ribbon rather than a row of
 * disconnected squares.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} mask - bitmask of {@link import('./terrain.js').OPEN} flags
 *   for the neighbours that are also on the path
 */
export function drawPathTile(ctx, x, y, mask) {
  const s = TILE_PX;
  const inset = 3;

  px(ctx, x + inset, y + inset, s - inset * 2, s - inset * 2, PALETTE.dark);

  // Stubs reaching into whichever neighbours continue the path.
  if (mask & 1) px(ctx, x + inset, y, s - inset * 2, inset, PALETTE.dark);
  if (mask & 2) px(ctx, x + s - inset, y + inset, inset, s - inset * 2, PALETTE.dark);
  if (mask & 4) px(ctx, x + inset, y + s - inset, s - inset * 2, inset, PALETTE.dark);
  if (mask & 8) px(ctx, x, y + inset, inset, s - inset * 2, PALETTE.dark);

  // A light seam down the middle so the ribbon has some form to it.
  px(ctx, x + s / 2 - 1, y + s / 2 - 1, 2, 2, PALETTE.light);
}

/**
 * A pale slab laid under a marker before it is drawn.
 *
 * Markers land on whatever is underneath them, and by the end of a run that is
 * usually the dark path corridor plus a layer of explored shading. Without a
 * backing plate the flag and the chest disappear into it - which is the worst
 * possible outcome for the two tiles the player most needs to find.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 */
function markerPad(ctx, x, y) {
  px(ctx, x + 1, y + 1, TILE_PX - 2, TILE_PX - 2, PALETTE.bg);
}

/**
 * The start marker: a small pixel flag on a pole.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} [pulse=0] - 0..1, drives a one-pixel breathing motion
 */
export function drawStartFlag(ctx, x, y, pulse = 0) {
  const lift = pulse > 0.5 ? 1 : 0;

  markerPad(ctx, x, y);
  px(ctx, x + 4, y + 12, 8, 2, PALETTE.black);
  px(ctx, x + 5, y + 13, 6, 1, PALETTE.dark);
  px(ctx, x + 7, y + 3 - lift, 2, 10 + lift, PALETTE.black);

  // Pennant.
  px(ctx, x + 9, y + 3 - lift, 5, 6, PALETTE.black);
  px(ctx, x + 9, y + 4 - lift, 4, 4, PALETTE.bg);
  px(ctx, x + 10, y + 5 - lift, 2, 2, PALETTE.dark);
}

/**
 * The goal marker: a pixel treasure chest with a small idle bounce.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} [bounce=0] - 0..1
 */
export function drawGoalChest(ctx, x, y, bounce = 0) {
  const lift = bounce > 0.5 ? 1 : 0;
  const top = y + 4 - lift;

  markerPad(ctx, x, y);
  px(ctx, x + 2, top, 12, 10, PALETTE.black);
  px(ctx, x + 3, top + 1, 10, 3, PALETTE.mid); // lid
  px(ctx, x + 3, top + 4, 10, 1, PALETTE.black); // hinge
  px(ctx, x + 3, top + 5, 10, 4, PALETTE.dark); // body
  px(ctx, x + 3, top + 1, 10, 1, PALETTE.light); // lid highlight

  // Lock.
  px(ctx, x + 7, top + 3, 2, 3, PALETTE.black);
  px(ctx, x + 7, top + 4, 2, 1, PALETTE.bg);

  // Shadow, so it sits on the ground rather than floating.
  px(ctx, x + 3, y + 14, 10, 1, PALETTE.mid);
}

/**
 * The vehicle, seen from above.
 *
 * Built from rectangles only - body, cabin, roof, wheels - and outlined in
 * black like everything else. It is drawn twice over, once for each axis,
 * rather than rotated: canvas rotation resamples and would blur the pixels.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - top-left of the tile the vehicle occupies
 * @param {number} y
 * @param {number} dir - a {@link DIR} value
 * @param {number} [phase=0] - 0..1, drives wheel rotation and body bob
 */
export function drawVehicle(ctx, x, y, dir, phase = 0) {
  const bob = phase > 0.5 ? -1 : 0;
  const spin = Math.floor(phase * 4) % 2; // wheels alternate between two frames
  const vertical = dir === DIR.N || dir === DIR.S;

  if (vertical) {
    const bx = x + 3;
    const by = y + 1 + bob;

    // Wheels first, so the body overlaps them.
    for (const wy of [by + 2, by + 9]) {
      px(ctx, bx - 1, wy + spin, 2, 3, PALETTE.black);
      px(ctx, bx + 9, wy + spin, 2, 3, PALETTE.black);
    }

    px(ctx, bx, by, 10, 14, PALETTE.black);
    px(ctx, bx + 1, by + 1, 8, 12, PALETTE.mid);

    const roofY = dir === DIR.N ? by + 5 : by + 4;
    px(ctx, bx + 2, roofY, 6, 5, PALETTE.dark);

    // Windscreen faces the direction of travel.
    const glassY = dir === DIR.N ? by + 2 : by + 10;
    px(ctx, bx + 2, glassY, 6, 2, PALETTE.light);
    // Headlights.
    const lampY = dir === DIR.N ? by + 1 : by + 11;
    px(ctx, bx + 1, lampY, 2, 1, PALETTE.bg);
    px(ctx, bx + 7, lampY, 2, 1, PALETTE.bg);
  } else {
    const bx = x + 1;
    const by = y + 3 + bob;

    for (const wx of [bx + 2, bx + 9]) {
      px(ctx, wx + spin, by - 1, 3, 2, PALETTE.black);
      px(ctx, wx + spin, by + 9, 3, 2, PALETTE.black);
    }

    px(ctx, bx, by, 14, 10, PALETTE.black);
    px(ctx, bx + 1, by + 1, 12, 8, PALETTE.mid);

    const roofX = dir === DIR.W ? bx + 5 : bx + 4;
    px(ctx, roofX, by + 2, 5, 6, PALETTE.dark);

    const glassX = dir === DIR.W ? bx + 2 : bx + 10;
    px(ctx, glassX, by + 2, 2, 6, PALETTE.light);
    const lampX = dir === DIR.W ? bx + 1 : bx + 11;
    px(ctx, lampX, by + 1, 1, 2, PALETTE.bg);
    px(ctx, lampX, by + 7, 1, 2, PALETTE.bg);
  }
}
