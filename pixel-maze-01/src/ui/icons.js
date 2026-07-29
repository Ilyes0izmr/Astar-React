/**
 * Procedural pixel icons.
 *
 * No icon font, no SVG set, no image files - each entry is a function that
 * draws rectangles into a 16x16 canvas, using the same palette and the same
 * grid as a map tile.
 *
 * The terrain icons deliberately call the *world* painters rather than
 * reimplementing the artwork. A toolbar swatch is therefore not an
 * approximation of the tile it paints; it is that tile, rendered by the same
 * code. Change how spikes look and the swatch follows automatically.
 *
 * @see instruction.md - "Icons"
 */
import { PALETTE } from '../core/palette.js';
import { TILE } from '../core/tiles.js';
import { px } from '../render/art.js';
import { drawRoad, drawWall, drawHazard, OPEN } from '../render/terrain.js';
import { drawStartFlag, drawGoalChest, drawVehicle, DIR } from '../render/sprites.js';

/** A tile open on all four sides, so terrain icons render as a crossroads. */
const CROSS_ROADS = OPEN.N | OPEN.E | OPEN.S | OPEN.W;

/** @type {Record<string, (ctx: CanvasRenderingContext2D) => void>} */
export const ICONS = {
  road: (ctx) => drawRoad(ctx, 0, 0, 3, 3, CROSS_ROADS),

  wall: (ctx) => {
    drawRoad(ctx, 0, 0, 5, 2, CROSS_ROADS);
    drawWall(ctx, 0, 0, 5, 2, CROSS_ROADS);
  },

  coin: (ctx) => {
    drawRoad(ctx, 0, 0, 1, 1, CROSS_ROADS);
    drawHazard(ctx, 0, 0, TILE.COIN);
  },

  rubble: (ctx) => {
    drawRoad(ctx, 0, 0, 2, 6, CROSS_ROADS);
    drawHazard(ctx, 0, 0, TILE.RUBBLE);
  },

  spike: (ctx) => {
    drawRoad(ctx, 0, 0, 4, 4, CROSS_ROADS);
    drawHazard(ctx, 0, 0, TILE.SPIKE);
  },

  start: (ctx) => {
    drawRoad(ctx, 0, 0, 7, 7, CROSS_ROADS);
    drawStartFlag(ctx, 0, 0, 0);
  },

  goal: (ctx) => {
    drawRoad(ctx, 0, 0, 8, 8, CROSS_ROADS);
    drawGoalChest(ctx, 0, 0, 0);
  },

  car: (ctx) => drawVehicle(ctx, 0, 0, DIR.S, 0),

  /** A stack of blocks, for "generate a new city". */
  city: (ctx) => {
    px(ctx, 1, 6, 5, 9, PALETTE.black);
    px(ctx, 2, 7, 3, 7, PALETTE.mid);
    px(ctx, 3, 9, 1, 1, PALETTE.light);
    px(ctx, 6, 2, 6, 13, PALETTE.black);
    px(ctx, 7, 3, 4, 11, PALETTE.mid);
    px(ctx, 8, 5, 2, 2, PALETTE.light);
    px(ctx, 8, 9, 2, 2, PALETTE.light);
    px(ctx, 12, 8, 4, 7, PALETTE.black);
    px(ctx, 13, 9, 2, 5, PALETTE.mid);
  },

  /** Solid right-pointing triangle. */
  play: (ctx) => {
    for (let i = 0; i < 6; i++) px(ctx, 4 + i, 3 + i, 1, 12 - i * 2, PALETTE.black);
  },

  /** Two bars. */
  pause: (ctx) => {
    px(ctx, 4, 3, 3, 10, PALETTE.black);
    px(ctx, 9, 3, 3, 10, PALETTE.black);
  },

  /** A square arrow looping back on itself. */
  reset: (ctx) => {
    px(ctx, 3, 3, 10, 2, PALETTE.black);
    px(ctx, 3, 3, 2, 10, PALETTE.black);
    px(ctx, 3, 11, 8, 2, PALETTE.black);
    px(ctx, 11, 5, 2, 4, PALETTE.black);
    px(ctx, 9, 8, 6, 2, PALETTE.black);
    px(ctx, 11, 6, 2, 2, PALETTE.black);
  },

  /** A cog: square body with four teeth. */
  gear: (ctx) => {
    px(ctx, 4, 4, 8, 8, PALETTE.black);
    px(ctx, 6, 6, 4, 4, PALETTE.bg);
    px(ctx, 6, 1, 4, 3, PALETTE.black);
    px(ctx, 6, 12, 4, 3, PALETTE.black);
    px(ctx, 1, 6, 3, 4, PALETTE.black);
    px(ctx, 12, 6, 3, 4, PALETTE.black);
  },

  /** A needle in a ring. */
  compass: (ctx) => {
    px(ctx, 3, 3, 10, 10, PALETTE.black);
    px(ctx, 4, 4, 8, 8, PALETTE.bg);
    px(ctx, 7, 5, 2, 4, PALETTE.dark);
    px(ctx, 7, 9, 2, 2, PALETTE.mid);
  },

  /** A full heart. */
  heart: (ctx) => {
    px(ctx, 3, 3, 4, 2, PALETTE.black);
    px(ctx, 9, 3, 4, 2, PALETTE.black);
    px(ctx, 2, 5, 12, 3, PALETTE.black);
    px(ctx, 3, 8, 10, 2, PALETTE.black);
    px(ctx, 5, 10, 6, 2, PALETTE.black);
    px(ctx, 7, 12, 2, 2, PALETTE.black);
    px(ctx, 4, 5, 2, 2, PALETTE.bg); // glint
  },

  /** An empty heart - outline only, so the bar reads at a glance. */
  heartEmpty: (ctx) => {
    px(ctx, 3, 3, 4, 2, PALETTE.mid);
    px(ctx, 9, 3, 4, 2, PALETTE.mid);
    px(ctx, 2, 5, 12, 3, PALETTE.mid);
    px(ctx, 3, 8, 10, 2, PALETTE.mid);
    px(ctx, 5, 10, 6, 2, PALETTE.mid);
    px(ctx, 7, 12, 2, 2, PALETTE.mid);
    px(ctx, 4, 6, 8, 3, PALETTE.bg);
    px(ctx, 5, 9, 6, 2, PALETTE.bg);
    px(ctx, 7, 11, 2, 1, PALETTE.bg);
  },
};

/** @type {string[]} every registered icon name. */
export const ICON_NAMES = Object.keys(ICONS);
