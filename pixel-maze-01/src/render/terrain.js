/**
 * Painters for the static world: roads, buildings, hazards and rooftop clutter.
 *
 * Nothing here animates. The whole terrain is rendered once into an offscreen
 * canvas and only repainted when the grid itself changes, which is what lets
 * the animated layer stay cheap enough to run at 60fps.
 *
 * @see instruction.md - "Roads", "Buildings", "Building Texture Rules"
 */
import { PALETTE } from '../core/palette.js';
import { TILE } from '../core/tiles.js';
import { px, dither, hash2, TILE_PX } from './art.js';

/** Bit flags describing which sides of a tile face open ground. */
export const OPEN = { N: 1, E: 2, S: 4, W: 8 };

/**
 * Builds the open-side mask for a cell.
 *
 * Both the road and the wall painters key their appearance off this: roads use
 * it to tell a corridor from an intersection, walls use it to decide which
 * edges get the dark outline.
 *
 * @param {import('../core/grid.js').Grid} grid
 * @param {number} row
 * @param {number} col
 * @returns {number} a bitmask of {@link OPEN} flags
 */
export function openMask(grid, row, col) {
  const { width, height, tiles } = grid;
  const open = (r, c) =>
    r >= 0 && r < height && c >= 0 && c < width && tiles[r * width + c] !== TILE.WALL;

  let mask = 0;
  if (open(row - 1, col)) mask |= OPEN.N;
  if (open(row, col + 1)) mask |= OPEN.E;
  if (open(row + 1, col)) mask |= OPEN.S;
  if (open(row, col - 1)) mask |= OPEN.W;
  return mask;
}

/**
 * Paints a road tile: flat surface, grit, and either centre dashes or the
 * darker slab that marks an intersection.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - tile origin in canvas pixels
 * @param {number} y
 * @param {number} col - grid coordinates, used to keep the noise stable
 * @param {number} row
 * @param {number} mask - from {@link openMask}
 */
export function drawRoad(ctx, x, y, col, row, mask) {
  const s = TILE_PX;
  px(ctx, x, y, s, s, PALETTE.light);

  // A couple of specks of grit, so a long straight road is not a dead flat
  // slab. Any more than this and the road starts competing with the search
  // overlay for attention.
  if (hash2(col, row, 1) > 0.72) px(ctx, x + 4, y + 11, 1, 1, PALETTE.bg);
  if (hash2(col, row, 2) > 0.82) px(ctx, x + 11, y + 5, 1, 1, PALETTE.bg);

  const vertical = (mask & OPEN.N) !== 0 || (mask & OPEN.S) !== 0;
  const horizontal = (mask & OPEN.E) !== 0 || (mask & OPEN.W) !== 0;

  if (vertical && horizontal) {
    // Roads crossing: a slightly darker slab, the way the spec describes
    // intersections. Kept light - it is a hint, not a feature.
    dither(ctx, x + 3, y + 3, s - 6, s - 6, PALETTE.mid, 0.25);
  } else if (vertical) {
    px(ctx, x + s / 2 - 1, y + 2, 2, 5, PALETTE.bg);
    px(ctx, x + s / 2 - 1, y + 9, 2, 5, PALETTE.bg);
  } else if (horizontal) {
    px(ctx, x + 2, y + s / 2 - 1, 5, 2, PALETTE.bg);
    px(ctx, x + 9, y + s / 2 - 1, 5, 2, PALETTE.bg);
  }

  // A soft kerb wherever the road meets a building.
  if (!(mask & OPEN.N)) px(ctx, x, y, s, 1, PALETTE.mid);
  if (!(mask & OPEN.S)) px(ctx, x, y + s - 1, s, 1, PALETTE.mid);
  if (!(mask & OPEN.W)) px(ctx, x, y, 1, s, PALETTE.mid);
  if (!(mask & OPEN.E)) px(ctx, x + s - 1, y, 1, s, PALETTE.mid);
}

/**
 * Paints a building tile: brickwork, wear, a dark outline on every side facing
 * a road, and occasionally a piece of rooftop clutter.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} col
 * @param {number} row
 * @param {number} mask - from {@link openMask}
 */
export function drawWall(ctx, x, y, col, row, mask) {
  const s = TILE_PX;
  const edge = mask !== 0;

  px(ctx, x, y, s, s, PALETTE.mid);

  // Two brick courses per tile, alternating offset. An earlier version drew
  // three and every block turned into visual static - at this scale the
  // masonry only needs to suggest itself, and the spec is explicit that the
  // world should stay calm and readable.
  for (let my = 0; my < s; my += 8) {
    px(ctx, x, y + my, s, 1, PALETTE.dark);
    const offset = my % 16 ? 4 : 0;
    for (let mx = offset; mx < s; mx += 8) px(ctx, x + mx, y + my, 1, 8, PALETTE.dark);
  }

  // A single weathered brick, and only on some tiles.
  const wear = hash2(col, row, 41);
  if (wear > 0.86) px(ctx, x + 1 + ((wear * 131) % 7 | 0), y + 2 + ((wear * 419) % 5 | 0), 3, 2, PALETTE.light);

  // Rooftop clutter goes on interior tiles only. On an edge tile it would sit
  // against the black outline and read as a smudge on the building's silhouette
  // rather than an object on its roof.
  if (!edge && hash2(col, row, 99) > 0.78) drawRooftopProp(ctx, x, y, col, row);

  // The dark outline the whole art style hangs on, plus a shadow just inside
  // it. Only edges that actually face open ground get one, so the inside of a
  // block stays a solid mass.
  if (mask & OPEN.N) {
    px(ctx, x, y, s, 1, PALETTE.black);
    px(ctx, x, y + 1, s, 1, PALETTE.dark);
  }
  if (mask & OPEN.S) {
    px(ctx, x, y + s - 1, s, 1, PALETTE.black);
    px(ctx, x, y + s - 2, s, 1, PALETTE.dark);
  }
  if (mask & OPEN.W) {
    px(ctx, x, y, 1, s, PALETTE.black);
    px(ctx, x + 1, y, 1, s, PALETTE.dark);
  }
  if (mask & OPEN.E) {
    px(ctx, x + s - 1, y, 1, s, PALETTE.black);
    px(ctx, x + s - 2, y, 1, s, PALETTE.dark);
  }
}

/**
 * One small structure on a rooftop - a tank, an air conditioner, a vent or a
 * crate. Picked by tile hash so a given building always wears the same one.
 *
 * @see instruction.md - "Building Appearance"
 */
function drawRooftopProp(ctx, x, y, col, row) {
  const kind = Math.floor(hash2(col, row, 123) * 4);
  const ox = x + 4;
  const oy = y + 4;

  switch (kind) {
    case 0: // Water tank: a light drum with a banded lid.
      px(ctx, ox, oy + 1, 8, 7, PALETTE.black);
      px(ctx, ox + 1, oy + 2, 6, 5, PALETTE.light);
      px(ctx, ox + 1, oy + 4, 6, 1, PALETTE.mid);
      break;
    case 1: // Air conditioner: a box with a grille.
      px(ctx, ox, oy, 8, 8, PALETTE.black);
      px(ctx, ox + 1, oy + 1, 6, 6, PALETTE.light);
      px(ctx, ox + 2, oy + 2, 4, 1, PALETTE.dark);
      px(ctx, ox + 2, oy + 4, 4, 1, PALETTE.dark);
      break;
    case 2: // Vent stack.
      px(ctx, ox + 2, oy, 4, 8, PALETTE.black);
      px(ctx, ox + 3, oy + 1, 2, 6, PALETTE.light);
      break;
    default: // Storage crate.
      px(ctx, ox + 1, oy + 1, 7, 7, PALETTE.black);
      px(ctx, ox + 2, oy + 2, 5, 5, PALETTE.mid);
      px(ctx, ox + 2, oy + 4, 5, 1, PALETTE.light);
      break;
  }
}

/**
 * Paints the pickup or hazard sitting on a road tile.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} tile - a {@link TILE} id
 */
export function drawHazard(ctx, x, y, tile) {
  switch (tile) {
    case TILE.COIN:
      // A ring, so it reads as a coin rather than a solid blob.
      px(ctx, x + 5, y + 4, 6, 8, PALETTE.black);
      px(ctx, x + 6, y + 5, 4, 6, PALETTE.bg);
      px(ctx, x + 7, y + 7, 2, 2, PALETTE.dark);
      break;

    case TILE.RUBBLE:
      // Loose stones. Slow to cross.
      px(ctx, x + 3, y + 8, 4, 3, PALETTE.black);
      px(ctx, x + 4, y + 9, 2, 1, PALETTE.mid);
      px(ctx, x + 8, y + 5, 5, 4, PALETTE.black);
      px(ctx, x + 9, y + 6, 3, 2, PALETTE.mid);
      px(ctx, x + 6, y + 12, 3, 2, PALETTE.black);
      break;

    case TILE.SPIKE:
      // Four teeth in a row. Expensive and it drains the bar.
      for (let i = 0; i < 4; i++) {
        const sx = x + 2 + i * 3;
        px(ctx, sx + 1, y + 5, 1, 6, PALETTE.black);
        px(ctx, sx, y + 8, 3, 3, PALETTE.black);
        px(ctx, sx + 1, y + 9, 1, 1, PALETTE.light);
      }
      px(ctx, x + 1, y + 11, 14, 1, PALETTE.dark);
      break;

    default:
      break;
  }
}
