/**
 * Painters for the static world: roads, cast shadows, buildings and hazards.
 *
 * Nothing here animates. The whole terrain is rendered once into an offscreen
 * canvas and only repainted when the grid or the hour changes, which is what
 * lets the animated layer stay cheap enough to run at 60fps.
 *
 * The three passes must run in this order, and {@link CanvasWorld} depends on
 * it: roads, then {@link drawShadowPass}, then buildings. Laying the shadows
 * down before the buildings means a shadow that falls on another building is
 * simply covered when that building is painted a moment later - no clipping,
 * no masking, no second buffer. Run the shadow pass last instead and every
 * rooftop picks up a smear.
 *
 * @see instruction.md - "Roads", "Buildings", "Building Texture Rules"
 */
import { PALETTE, CURRENT_STAGE } from '../core/palette.js';
import { TILE } from '../core/tiles.js';
import { isLit, shadowOffset } from '../core/daycycle.js';
import { px, dither, hash2, TILE_PX } from './art.js';

/**
 * Bit flags describing a tile's surroundings.
 *
 * N/E/S/W say which sides face open ground. CROSS is derived rather than
 * observed: it marks a tile that is a genuine street junction.
 */
export const OPEN = { N: 1, E: 2, S: 4, W: 8, CROSS: 16 };

/**
 * Builds the surroundings mask for a cell.
 *
 * The CROSS bit needs the diagonals, which is why it is computed here where the
 * grid is in hand rather than in the painter. A tile counts as a junction when
 * at least three sides are open *and* at least two diagonals are solid - the
 * second condition is what stops every tile in an open courtyard qualifying.
 * Judging by the orthogonals alone, a plaza is nothing but crossroads, which is
 * exactly how the first version carpeted the map in dots.
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

  let arms = 0;
  for (let bit = 1; bit <= 8; bit <<= 1) if (mask & bit) arms++;

  let corners = 0;
  if (!open(row - 1, col - 1)) corners++;
  if (!open(row - 1, col + 1)) corners++;
  if (!open(row + 1, col - 1)) corners++;
  if (!open(row + 1, col + 1)) corners++;

  if (arms >= 3 && corners >= 2) mask |= OPEN.CROSS;
  return mask;
}

/**
 * The small marker at a street junction.
 *
 * Painted in the same tone as the lane dashes, at the same weight, because it
 * is the same kind of thing: a road marking. An earlier version drew a large
 * black-ringed disc and it read as an obstacle sitting in the road rather than
 * paint on it - at 16px anything with its own outline becomes an object.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - tile origin
 * @param {number} y - tile origin
 */
export function drawCrossroadDot(ctx, x, y) {
  const cx = x + TILE_PX / 2 - 1;
  const cy = y + TILE_PX / 2 - 1;

  px(ctx, cx, cy - 1, 2, 4, PALETTE.bg);
  px(ctx, cx - 1, cy, 4, 2, PALETTE.bg);
}

/**
 * Paints a road tile.
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
  const lit = isLit(CURRENT_STAGE);

  px(ctx, x, y, s, s, PALETTE.light);

  // Two specks of grit, so a long straight road is not a dead flat slab. Any
  // more and the road starts competing with the search overlay for attention.
  if (hash2(col, row, 1) > 0.72) px(ctx, x + 4, y + 11, 1, 1, PALETTE.bg);
  if (hash2(col, row, 2) > 0.82) px(ctx, x + 11, y + 5, 1, 1, PALETTE.bg);

  const vertical = (mask & OPEN.N) !== 0 || (mask & OPEN.S) !== 0;
  const horizontal = (mask & OPEN.E) !== 0 || (mask & OPEN.W) !== 0;

  if (mask & OPEN.CROSS) {
    drawCrossroadDot(ctx, x, y);
  } else if (vertical && horizontal) {
    // Open ground rather than a junction - no lane markings belong here.
    dither(ctx, x + 4, y + 4, s - 8, s - 8, PALETTE.mid, 0.2);
  } else if (vertical) {
    px(ctx, x + s / 2 - 1, y + 2, 2, 5, PALETTE.bg);
    px(ctx, x + s / 2 - 1, y + 9, 2, 5, PALETTE.bg);
  } else if (horizontal) {
    px(ctx, x + 2, y + s / 2 - 1, 5, 2, PALETTE.bg);
    px(ctx, x + 9, y + s / 2 - 1, 5, 2, PALETTE.bg);
  }

  // A kerb wherever the road meets a building. After dark it goes darker
  // instead of lighter - at night the kerb is the shadow line, not a highlight.
  const kerb = lit ? PALETTE.dark : PALETTE.mid;
  if (!(mask & OPEN.N)) px(ctx, x, y, s, 1, kerb);
  if (!(mask & OPEN.S)) px(ctx, x, y + s - 1, s, 1, kerb);
  if (!(mask & OPEN.W)) px(ctx, x, y, 1, s, kerb);
  if (!(mask & OPEN.E)) px(ctx, x + s - 1, y, 1, s, kerb);
}

/**
 * Lays down every building's cast shadow.
 *
 * Each building is offset by {@link shadowOffset}, which scales with its
 * height, so a tower throws a visibly longer shadow than a shop. Shadows are
 * emitted as horizontal runs per row rather than per tile - a single building
 * is usually one or two fills this way instead of a dozen.
 *
 * Call between the road pass and the building pass. See the file header for
 * why that ordering removes the need to clip.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../core/grid.js').Grid} grid
 * @param {import('../core/daycycle.js').Stage} stage
 */
export function drawShadowPass(ctx, grid, stage) {
  const list = grid.buildings?.list;
  if (!list) return;

  const { width, height, tiles } = grid;

  for (const building of list) {
    // A stand of trees is soft and low, so it barely throws anything. Giving
    // parks the same hard slab as a concrete tower reads as a mistake.
    const isPark = building.type === 'park';
    const offset = shadowOffset(stage, isPark ? 1 : building.height);
    if (offset.x === 0 && offset.y === 0) continue;

    const density = stage.sun.density * (isPark ? 0.6 : 1);
    ctx.fillStyle = PALETTE.dark;

    for (let row = building.r0; row <= building.r1; row++) {
      let runStart = -1;
      for (let col = building.c0; col <= building.c1 + 1; col++) {
        const solid =
          col <= building.c1 && row >= 0 && row < height && tiles[row * width + col] === TILE.WALL;

        if (solid && runStart === -1) {
          runStart = col;
        } else if (!solid && runStart !== -1) {
          dither(
            ctx,
            runStart * TILE_PX + offset.x,
            row * TILE_PX + offset.y,
            (col - runStart) * TILE_PX,
            TILE_PX,
            PALETTE.dark,
            density,
          );
          runStart = -1;
        }
      }
    }
  }
}

/**
 * Paints one tile of a building.
 *
 * The facade is chosen by the building's type, and the window grid is laid out
 * from the tile's position *within the footprint* rather than from the tile
 * itself - otherwise the pattern restarts at every tile boundary and a block
 * reads as a grid of small huts instead of one structure.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../core/grid.js').Grid} grid
 * @param {number} cell - flat index
 * @param {number} x - tile origin
 * @param {number} y
 * @param {number} mask - from {@link openMask}
 * @param {import('../core/buildings.js').Building|null} building
 */
export function drawBuildingTile(ctx, grid, cell, x, y, mask, building) {
  if (!building) {
    drawWall(ctx, x, y, cell % grid.width, Math.floor(cell / grid.width), mask);
    return;
  }

  const col = cell % grid.width;
  const row = Math.floor(cell / grid.width);
  const lx = col - building.c0;
  const ly = row - building.r0;

  if (building.type === 'park') {
    drawPark(ctx, x, y, col, row, mask);
    return;
  }

  px(ctx, x, y, TILE_PX, TILE_PX, PALETTE.mid);

  switch (building.type) {
    case 'office':
      roofOffice(ctx, x, y, lx, ly, building);
      break;
    case 'warehouse':
      roofWarehouse(ctx, x, y, lx, ly, building);
      break;
    case 'tower':
      roofTower(ctx, x, y, lx, ly, building);
      break;
    case 'shop':
      roofShop(ctx, x, y, lx, ly, building);
      break;
    case 'industrial':
      roofIndustrial(ctx, x, y, lx, ly, building);
      break;
    default:
      roofApartment(ctx, x, y, lx, ly, building);
      break;
  }

  extrude(ctx, x, y, mask, building.height);
}

/**
 * The parapet and the sliver of wall a top-down camera can actually see.
 *
 * Looking straight down, a building is a roof with a rim around it. The only
 * wall visible is a thin band on the sides facing away from the light, and how
 * thick that band is doing the work of telling you how tall the building is.
 *
 * An earlier version drew window grids here as though the camera were at street
 * level. From directly overhead there are no windows to see - that mismatch is
 * what made the blocks read as elevations pasted onto a plan.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} mask
 * @param {number} height - floors, 1..5
 */
function extrude(ctx, x, y, mask, height) {
  const s = TILE_PX;
  const sun = CURRENT_STAGE.sun;
  const wall = Math.min(5, 1 + height);

  // The visible wall falls on the sides the light is travelling towards, which
  // is the same direction the cast shadow goes.
  if (sun.dy > 0 && mask & OPEN.S) px(ctx, x, y + s - wall, s, wall, PALETTE.dark);
  if (sun.dy < 0 && mask & OPEN.N) px(ctx, x, y, s, wall, PALETTE.dark);
  if (sun.dx > 0 && mask & OPEN.E) px(ctx, x + s - wall, y, wall, s, PALETTE.dark);
  if (sun.dx < 0 && mask & OPEN.W) px(ctx, x, y, wall, s, PALETTE.dark);

  // Parapet: a lit rim just inside the roof edge, all the way round.
  if (mask & OPEN.N) px(ctx, x, y + 1, s, 1, PALETTE.light);
  if (mask & OPEN.S) px(ctx, x, y + s - 2, s, 1, PALETTE.light);
  if (mask & OPEN.W) px(ctx, x + 1, y, 1, s, PALETTE.light);
  if (mask & OPEN.E) px(ctx, x + s - 2, y, 1, s, PALETTE.light);

  if (mask & OPEN.N) px(ctx, x, y, s, 1, PALETTE.black);
  if (mask & OPEN.S) px(ctx, x, y + s - 1, s, 1, PALETTE.black);
  if (mask & OPEN.W) px(ctx, x, y, 1, s, PALETTE.black);
  if (mask & OPEN.E) px(ctx, x + s - 1, y, 1, s, PALETTE.black);
}

/**
 * A piece of rooftop equipment, outlined and with a lit top face.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - top-left of the unit
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {string} [top] - face tone, defaults to the light tone
 */
function unit(ctx, x, y, w, h, top = PALETTE.light) {
  px(ctx, x, y, w, h, PALETTE.black);
  px(ctx, x + 1, y + 1, w - 2, h - 2, top);
  px(ctx, x + 1, y + h - 2, w - 2, 1, PALETTE.mid);
}

/**
 * Whether a rooftop light is on.
 *
 * Decided from the building's own seed rather than a live random, so a roof
 * does not flicker every time the terrain is repainted.
 */
function roofLight(building, wx, wy) {
  if (!isLit(CURRENT_STAGE) || !PALETTE.glow) return null;
  return hash2(wx + building.c0 * 31, wy + building.r0 * 17, building.seed & 0xffff) <
    CURRENT_STAGE.lit
    ? PALETTE.glow
    : null;
}

/** Tar roof: stair box, a water tank, a vent or two. The city's default. */
function roofApartment(ctx, x, y, lx, ly, building) {
  const s = TILE_PX;
  dither(ctx, x, y, s, s, PALETTE.dark, 0.25);

  const roll = hash2(lx + building.c0, ly + building.r0, building.seed & 0x7fff);
  if (roll > 0.72) {
    unit(ctx, x + 4, y + 4, 8, 7); // stair head
  } else if (roll > 0.5) {
    unit(ctx, x + 5, y + 3, 6, 6); // water tank
    px(ctx, x + 6, y + 9, 4, 3, PALETTE.black);
  } else if (roll > 0.32) {
    unit(ctx, x + 3, y + 6, 4, 4);
    unit(ctx, x + 9, y + 8, 4, 4);
  }

  const lamp = roofLight(building, lx, ly);
  if (lamp) px(ctx, x + 13, y + 2, 2, 2, lamp);
}

/** Big HVAC plant laid out in a grid, plus skylights. */
function roofOffice(ctx, x, y, lx, ly, building) {
  const s = TILE_PX;
  px(ctx, x, y, s, s, PALETTE.mid);
  dither(ctx, x, y, s, s, PALETTE.light, 0.12);

  if ((lx + ly) % 2 === 0) {
    // Skylight: a glazed panel, which is the one thing on a roof that lights up.
    const lamp = roofLight(building, lx, ly);
    px(ctx, x + 3, y + 3, 10, 10, PALETTE.black);
    px(ctx, x + 4, y + 4, 8, 8, lamp ?? PALETTE.light);
    px(ctx, x + 8, y + 4, 1, 8, PALETTE.mid);
    px(ctx, x + 4, y + 8, 8, 1, PALETTE.mid);
  } else {
    unit(ctx, x + 2, y + 3, 6, 5);
    unit(ctx, x + 9, y + 8, 5, 5);
  }
}

/** Corrugated sheeting with long ridge lines and roof-mounted extractors. */
function roofWarehouse(ctx, x, y, lx, ly, building) {
  const s = TILE_PX;
  px(ctx, x, y, s, s, PALETTE.mid);

  // Ridges run the length of the building, so they key off the footprint
  // rather than the tile - otherwise the sheeting restarts at every seam.
  for (let mx = (lx % 2) * 2; mx < s; mx += 4) px(ctx, x + mx, y, 1, s, PALETTE.dark);

  if (hash2(lx + building.c0, ly + building.r0, building.seed & 0xff) > 0.62) {
    unit(ctx, x + 4, y + 5, 8, 6);
    px(ctx, x + 6, y + 7, 4, 2, PALETTE.dark);
  }
}

/** Small footprint, heavy plant, and a roof light that reads from the ground. */
function roofTower(ctx, x, y, lx, ly, building) {
  const s = TILE_PX;
  px(ctx, x, y, s, s, PALETTE.mid);
  dither(ctx, x, y, s, s, PALETTE.dark, 0.3);

  unit(ctx, x + 3, y + 3, 10, 9, PALETTE.mid);
  px(ctx, x + 5, y + 5, 6, 2, PALETTE.dark);
  px(ctx, x + 5, y + 8, 6, 2, PALETTE.dark);

  const lamp = roofLight(building, lx, ly);
  if (lamp) {
    px(ctx, x + 7, y + 1, 2, 2, lamp);
  } else {
    px(ctx, x + 7, y + 1, 2, 2, PALETTE.bg);
  }
}

/** Low roof over a shopfront: signage board and a small service unit. */
function roofShop(ctx, x, y, lx, ly, building) {
  const s = TILE_PX;
  px(ctx, x, y, s, s, PALETTE.mid);

  // Sign board, angled to the street.
  px(ctx, x + 2, y + 4, s - 4, 5, PALETTE.black);
  px(ctx, x + 3, y + 5, s - 6, 3, roofLight(building, lx, ly) ?? PALETTE.bg);
  px(ctx, x + 4, y + 6, 2, 1, PALETTE.dark);
  px(ctx, x + 8, y + 6, 4, 1, PALETTE.dark);

  unit(ctx, x + 10, y + 11, 4, 4);
}

/** Tanks, ducting and a stack. */
function roofIndustrial(ctx, x, y, lx, ly, building) {
  const s = TILE_PX;
  px(ctx, x, y, s, s, PALETTE.mid);

  const roll = hash2(lx + building.c0, ly + building.r0, building.seed & 0x7fff);
  if (roll > 0.66) {
    unit(ctx, x + 3, y + 3, 10, 10, PALETTE.light);
    px(ctx, x + 5, y + 5, 6, 6, PALETTE.mid);
  } else if (roll > 0.33) {
    // Ducting running across the roof, and a stack casting a hard dot.
    px(ctx, x + 1, y + 6, s - 2, 4, PALETTE.black);
    px(ctx, x + 2, y + 7, s - 4, 2, PALETTE.light);
    unit(ctx, x + 9, y + 1, 5, 5);
  } else {
    px(ctx, x, y + 3, s, 2, PALETTE.dark);
    px(ctx, x, y + 10, s, 2, PALETTE.dark);
    unit(ctx, x + 5, y + 5, 6, 5);
  }
}

/**
 * A stand of trees inside a block.
 *
 * Impassable like everything else in a block, but visually it is the opposite
 * of masonry: no windows, no cap, no hard top edge. The reference art uses
 * parks exactly this way, as somewhere for the eye to rest between the dense
 * grids of brick.
 */
function drawPark(ctx, x, y, col, row, mask) {
  const s = TILE_PX;

  px(ctx, x, y, s, s, PALETTE.dark);
  dither(ctx, x, y, s, s, PALETTE.mid, 0.45);

  const canopy = (cxp, cyp, r) => {
    px(ctx, cxp - r, cyp - r + 1, r * 2, r * 2 - 1, PALETTE.black);
    px(ctx, cxp - r + 1, cyp - r, r * 2 - 2, r * 2 + 1, PALETTE.black);
    px(ctx, cxp - r + 1, cyp - r + 1, r * 2 - 2, r * 2 - 2, PALETTE.mid);
    px(ctx, cxp - r + 1, cyp - r + 1, r - 1, r - 1, PALETTE.light);
  };

  canopy(x + 5, y + 5, 3);
  if (hash2(col, row, 55) > 0.4) canopy(x + 11, y + 10, 3);
  if (hash2(col, row, 56) > 0.7) canopy(x + 4, y + 12, 2);

  // Only the outline, never the cap - a park has no roofline to catch the sun.
  if (mask & OPEN.N) px(ctx, x, y, s, 1, PALETTE.black);
  if (mask & OPEN.S) px(ctx, x, y + s - 1, s, 1, PALETTE.black);
  if (mask & OPEN.W) px(ctx, x, y, 1, s, PALETTE.black);
  if (mask & OPEN.E) px(ctx, x + s - 1, y, 1, s, PALETTE.black);
}

/**
 * A plain building tile, with no building record behind it.
 *
 * Still used by the toolbar icons, which draw a wall with no grid around it,
 * and as the fallback when the building index has not been rebuilt yet.
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
  px(ctx, x, y, s, s, PALETTE.mid);

  for (let my = 0; my < s; my += 8) {
    px(ctx, x, y + my, s, 1, PALETTE.dark);
    const offset = my % 16 ? 4 : 0;
    for (let mx = offset; mx < s; mx += 8) px(ctx, x + mx, y + my, 1, 8, PALETTE.dark);
  }

  const wear = hash2(col, row, 41);
  if (wear > 0.86) {
    px(ctx, x + 1 + ((wear * 131) % 7 | 0), y + 2 + ((wear * 419) % 5 | 0), 3, 2, PALETTE.light);
  }

  extrude(ctx, x, y, mask, 3);
}

/**
 * Paints the hazard sitting on a road tile.
 *
 * Coins are deliberately absent: they spin, so they are drawn every frame by
 * {@link import('./effects.js').drawCoin} on the animated layer instead of
 * being baked into the terrain cache.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} tile - a {@link TILE} id
 */
export function drawHazard(ctx, x, y, tile) {
  switch (tile) {
    case TILE.RUBBLE: {
      // Each stone gets a lit top and a dark underside so the pile has a
      // direction to it rather than reading as flat confetti.
      const stone = (sx, sy, w, h) => {
        px(ctx, sx, sy, w, h, PALETTE.black);
        px(ctx, sx + 1, sy + 1, w - 2, h - 2, PALETTE.mid);
        px(ctx, sx + 1, sy + 1, w - 2, 1, PALETTE.light);
      };
      stone(x + 2, y + 7, 6, 5);
      stone(x + 8, y + 4, 6, 5);
      stone(x + 6, y + 11, 5, 4);
      px(ctx, x + 1, y + 14, 14, 1, PALETTE.dark);
      break;
    }

    case TILE.SPIKE: {
      // Base plate first, then the teeth, so each tooth sits on the plate.
      px(ctx, x + 1, y + 10, 14, 4, PALETTE.black);
      px(ctx, x + 2, y + 11, 12, 2, PALETTE.dark);
      for (let i = 0; i < 4; i++) {
        const sx = x + 2 + i * 3;
        px(ctx, sx + 1, y + 3, 1, 8, PALETTE.black);
        px(ctx, sx, y + 6, 3, 5, PALETTE.black);
        px(ctx, sx + 1, y + 7, 1, 3, PALETTE.light);
      }
      px(ctx, x + 1, y + 14, 14, 1, PALETTE.dark);
      break;
    }

    default:
      break;
  }
}
