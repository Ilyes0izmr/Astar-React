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
import { PALETTE, CURRENT_STAGE, BUILDING_HUES } from '../core/palette.js';
import { TILE, isSolid, isWater } from '../core/tiles.js';
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
  // Water and mountain count as closed, not open. A road along the riverbank
  // needs a kerb on the water side exactly as it does against a building, and
  // without this the CROSS test fires against the river and scatters junction
  // dots down the whole waterfront.
  const open = (r, c) => {
    if (r < 0 || r >= height || c < 0 || c >= width) return false;
    const tile = tiles[r * width + c];
    return !isSolid(tile) && !isWater(tile);
  };

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
 * Which broad kind of terrain a tile is.
 *
 * Three families, because three things need outlining against each other: the
 * sea, the range, and everything you can walk on. Grouping by family rather
 * than by tile id is what lets foam appear only where water actually meets a
 * shore, instead of along every seam between two water tiles.
 *
 * @param {number} tile
 * @returns {number} 0 land, 1 water, 2 mountain
 */
function family(tile) {
  if (tile === TILE.WATER) return 1;
  if (tile === TILE.MOUNTAIN) return 2;
  return 0;
}

/**
 * The sides of a tile that face a different kind of terrain.
 *
 * Off-grid counts as different, so the map edge always takes an outline rather
 * than bleeding into the backdrop.
 *
 * @param {import('../core/grid.js').Grid} grid
 * @param {number} row
 * @param {number} col
 * @returns {number} a bitmask of {@link OPEN} N/E/S/W flags
 */
export function terrainEdges(grid, row, col) {
  const { width, height, tiles } = grid;
  const mine = family(tiles[row * width + col]);
  const differs = (r, c) => {
    if (r < 0 || r >= height || c < 0 || c >= width) return true;
    return family(tiles[r * width + c]) !== mine;
  };

  let mask = 0;
  if (differs(row - 1, col)) mask |= OPEN.N;
  if (differs(row, col + 1)) mask |= OPEN.E;
  if (differs(row + 1, col)) mask |= OPEN.S;
  if (differs(row, col - 1)) mask |= OPEN.W;
  return mask;
}

/**
 * Open water.
 *
 * The body is flat and dark with a couple of faint ripple dashes; what makes it
 * read as sea is the foam. Every side facing something that is not water gets a
 * bright rim with a few brighter speckles, which is the outlined-blob look the
 * reference tiles use. Foam only on those sides - running it between two water
 * tiles would draw a grid across the whole bay.
 *
 * The moving glints on top are {@link import('./seascape.js').drawWaterShimmer}'s
 * job; this is the still layer that gets cached with the rest of the terrain.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../core/grid.js').Grid} grid
 * @param {number} cell - flat index
 * @param {number} x - tile origin
 * @param {number} y
 */
export function drawWater(ctx, grid, cell, x, y) {
  const s = TILE_PX;
  const col = cell % grid.width;
  const row = Math.floor(cell / grid.width);

  const nature = PALETTE.terrain;
  const body = nature?.water ?? PALETTE.dark;
  const ripple = nature?.foam ?? PALETTE.mid;

  px(ctx, x, y, s, s, body);
  dither(ctx, x, y, s, s, ripple, nature ? 0.1 : 0.18);

  if (hash2(col, row, 61) > 0.55) px(ctx, x + 3, y + 5, 5, 1, ripple);
  if (hash2(col, row, 62) > 0.68) px(ctx, x + 8, y + 11, 4, 1, ripple);

  const edges = terrainEdges(grid, row, col);
  if (!edges) return;

  const foam = nature?.foam ?? PALETTE.light;
  if (edges & OPEN.N) {
    px(ctx, x, y, s, 2, foam);
    if (hash2(col, row, 71) > 0.4) px(ctx, x + 4, y + 2, 3, 1, PALETTE.bg);
  }
  if (edges & OPEN.S) {
    px(ctx, x, y + s - 2, s, 2, foam);
    if (hash2(col, row, 72) > 0.4) px(ctx, x + 8, y + s - 3, 3, 1, PALETTE.bg);
  }
  if (edges & OPEN.W) {
    px(ctx, x, y, 2, s, foam);
    if (hash2(col, row, 73) > 0.5) px(ctx, x + 2, y + 6, 1, 3, PALETTE.bg);
  }
  if (edges & OPEN.E) {
    px(ctx, x + s - 2, y, 2, s, foam);
    if (hash2(col, row, 74) > 0.5) px(ctx, x + s - 3, y + 4, 1, 3, PALETTE.bg);
  }
}

/**
 * Beach.
 *
 * Light sand with scattered grain, and a damp band wherever it meets the water
 * so the shoreline has a direction to it rather than being a hard seam between
 * two flat fills.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../core/grid.js').Grid} grid
 * @param {number} cell
 * @param {number} x
 * @param {number} y
 */
export function drawSand(ctx, grid, cell, x, y) {
  const s = TILE_PX;
  const col = cell % grid.width;
  const row = Math.floor(cell / grid.width);

  const sand = PALETTE.terrain?.sand ?? PALETTE.light;
  px(ctx, x, y, s, s, sand);
  dither(ctx, x, y, s, s, PALETTE.bg, 0.3);

  for (let i = 0; i < 3; i++) {
    const h = hash2(col, row, 80 + i);
    if (h < 0.55) continue;
    px(ctx, x + ((h * 211) % (s - 2) | 0), y + ((h * 577) % (s - 2) | 0), 1, 1, PALETTE.mid);
  }

  const { width, height, tiles } = grid;
  const wet = (r, c) =>
    r >= 0 && r < height && c >= 0 && c < width && tiles[r * width + c] === TILE.WATER;

  if (wet(row + 1, col)) px(ctx, x, y + s - 2, s, 2, PALETTE.mid);
  if (wet(row - 1, col)) px(ctx, x, y, s, 2, PALETTE.mid);
  if (wet(row, col - 1)) px(ctx, x, y, 2, s, PALETTE.mid);
  if (wet(row, col + 1)) px(ctx, x + s - 2, y, 2, s, PALETTE.mid);
}

/**
 * The range along the north edge.
 *
 * Built the way pixel mountains are conventionally built, in four passes:
 * silhouette, then ridges, then light and shadow from the sun's direction, then
 * snow on the tops. Doing it in that order matters - shading before the ridges
 * exist gives a lumpy blob, and capping before the shading makes the snow look
 * pasted on rather than lying on rock.
 *
 * Everything is keyed off {@link hash2} with the tile's own coordinates, so a
 * peak keeps its shape between repaints instead of reshuffling every time the
 * hour changes.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../core/grid.js').Grid} grid
 * @param {number} cell
 * @param {number} x
 * @param {number} y
 */
export function drawMountain(ctx, grid, cell, x, y) {
  const s = TILE_PX;
  const col = cell % grid.width;
  const row = Math.floor(cell / grid.width);
  const sun = CURRENT_STAGE.sun;
  const edges = terrainEdges(grid, row, col);

  const rock = PALETTE.terrain?.mountain ?? PALETTE.mid;
  const cap = PALETTE.terrain?.snow ?? PALETTE.bg;
  px(ctx, x, y, s, s, rock);

  // Ridges. Each one starts somewhere along the top of the tile and walks down,
  // wandering a pixel at a time, which is what gives the rock its grain.
  for (let i = 0; i < 3; i++) {
    const seed = hash2(col, row, 90 + i);
    if (seed < 0.25) continue;
    let rx = Math.floor(seed * (s - 2)) + 1;
    for (let ry = 0; ry < s; ry++) {
      px(ctx, x + rx, y + ry, 1, 1, PALETTE.dark);
      const drift = hash2(col * 7 + rx, row * 13 + ry, 91 + i);
      if (drift > 0.72 && rx < s - 2) rx++;
      else if (drift < 0.28 && rx > 1) rx--;
    }
  }

  // Light and shade. The face turned toward the sun catches a highlight, the
  // one turned away falls into shadow; both are read live so the range relights
  // itself when the hour changes.
  const lightBand = 5;
  if (sun.dx < 0) {
    dither(ctx, x, y, lightBand, s, PALETTE.light, 0.55);
    dither(ctx, x + s - lightBand, y, lightBand, s, PALETTE.dark, 0.5);
  } else {
    dither(ctx, x + s - lightBand, y, lightBand, s, PALETTE.light, 0.55);
    dither(ctx, x, y, lightBand, s, PALETTE.dark, 0.5);
  }
  if (sun.dy > 0) dither(ctx, x, y + s - 4, s, 4, PALETTE.dark, 0.4);

  // Snowcaps, only on the tiles that actually form a summit - the top edge of
  // the range. Lower tiles are bare rock, which is what makes the caps read as
  // altitude rather than as a stripe painted across the whole band.
  if (edges & OPEN.N) {
    for (let sx = 0; sx < s; sx++) {
      const depth = 4 + Math.floor(hash2(col * s + sx, row, 95) * 5);
      px(ctx, x + sx, y, 1, depth, cap);
      // A tooth of shadow under the snow line, so the cap sits on the rock
      // instead of being a band ruled across the top of the tile.
      px(ctx, x + sx, y + depth, 1, 1, PALETTE.dark);
    }
  }

  // The foot of the range falls into shade, which is what separates the last row
  // of rock from the city that starts immediately below it.
  if (edges & OPEN.S) {
    dither(ctx, x, y + s - 6, s, 6, PALETTE.black, 0.45);
    px(ctx, x, y + s - 1, s, 1, PALETTE.black);
  }

  if (edges & OPEN.N) px(ctx, x, y, s, 1, PALETTE.black);
  if (edges & OPEN.S) px(ctx, x, y + s - 1, s, 1, PALETTE.black);
  if (edges & OPEN.W) px(ctx, x, y, 1, s, PALETTE.black);
  if (edges & OPEN.E) px(ctx, x + s - 1, y, 1, s, PALETTE.black);
}

/**
 * A road deck carried over the river.
 *
 * The water is drawn underneath first so the deck sits *on* it, then planks laid
 * across the direction of travel and a rail down each side. Planks run
 * perpendicular to the crossing because that is how a bridge is built, and it is
 * also what tells you at a glance which way it carries you.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../core/grid.js').Grid} grid
 * @param {number} cell
 * @param {number} x
 * @param {number} y
 * @param {number} mask - from {@link openMask}
 */
export function drawBridge(ctx, grid, cell, x, y, mask) {
  const s = TILE_PX;
  drawWater(ctx, grid, cell, x, y);

  const vertical = (mask & OPEN.N) !== 0 || (mask & OPEN.S) !== 0;
  const inset = 1;

  if (vertical) {
    px(ctx, x + inset, y, s - inset * 2, s, PALETTE.mid);
    for (let py = 1; py < s; py += 4) px(ctx, x + inset, y + py, s - inset * 2, 1, PALETTE.dark);
    px(ctx, x + inset, y, 1, s, PALETTE.light);
    px(ctx, x + s - inset - 1, y, 1, s, PALETTE.light);
    px(ctx, x, y, 1, s, PALETTE.black);
    px(ctx, x + s - 1, y, 1, s, PALETTE.black);
  } else {
    px(ctx, x, y + inset, s, s - inset * 2, PALETTE.mid);
    for (let pxx = 1; pxx < s; pxx += 4) px(ctx, x + pxx, y + inset, 1, s - inset * 2, PALETTE.dark);
    px(ctx, x, y + inset, s, 1, PALETTE.light);
    px(ctx, x, y + s - inset - 1, s, 1, PALETTE.light);
    px(ctx, x, y, s, 1, PALETTE.black);
    px(ctx, x, y + s - 1, s, 1, PALETTE.black);
  }
}

/**
 * Harbour decking.
 *
 * Same idea as a bridge but rougher and narrower - board gaps instead of a
 * railed deck, and a dark stud at each corner reading as the post underneath.
 * No lane markings: a jetty is not a road.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../core/grid.js').Grid} grid
 * @param {number} cell
 * @param {number} x
 * @param {number} y
 */
export function drawPier(ctx, grid, cell, x, y) {
  const s = TILE_PX;
  drawWater(ctx, grid, cell, x, y);

  px(ctx, x + 1, y + 1, s - 2, s - 2, PALETTE.mid);
  for (let py = 2; py < s - 2; py += 3) px(ctx, x + 1, y + py, s - 2, 1, PALETTE.dark);

  px(ctx, x + 1, y + 1, s - 2, 1, PALETTE.light);
  px(ctx, x + 1, y + 1, 1, 1, PALETTE.black);
  px(ctx, x + s - 2, y + 1, 1, 1, PALETTE.black);
  px(ctx, x + 1, y + s - 2, 2, 2, PALETTE.black);
  px(ctx, x + s - 3, y + s - 2, 2, 2, PALETTE.black);
}

/**
 * Railway tracks - two parallel rails with cross ties.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - tile origin
 * @param {number} y - tile origin
 */
export function drawRailway(ctx, x, y) {
  // Gravel bed
  px(ctx, x, y, TILE_PX, TILE_PX, PALETTE.mid);
  // Cross ties (sleepers) - 3 evenly spaced
  for (let i = 2; i < TILE_PX - 2; i += 5) {
    px(ctx, x + i, y + 2, 2, TILE_PX - 4, PALETTE.dark);
  }
  // Two rails
  px(ctx, x, y + 4, TILE_PX, 2, PALETTE.light);
  px(ctx, x, y + TILE_PX - 6, TILE_PX, 2, PALETTE.light);
  // Rail highlight
  px(ctx, x, y + 4, TILE_PX, 1, PALETTE.bg);
  px(ctx, x, y + TILE_PX - 6, TILE_PX, 1, PALETTE.bg);
}

/**
 * Station platform - a raised area between the tracks and the city.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - tile origin
 * @param {number} y - tile origin
 */
export function drawStation(ctx, x, y) {
  // Platform surface
  px(ctx, x, y, TILE_PX, TILE_PX, PALETTE.light);
  // Platform edge (top)
  px(ctx, x, y, TILE_PX, 2, PALETTE.dark);
  // Platform texture - subtle dots
  for (let i = 3; i < TILE_PX - 2; i += 4) {
    px(ctx, x + i, y + 4, 1, 1, PALETTE.mid);
    px(ctx, x + i + 2, y + 8, 1, 1, PALETTE.mid);
    px(ctx, x + i, y + 12, 1, 1, PALETTE.mid);
  }
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

  const surface = PALETTE.terrain?.road ?? PALETTE.light;
  const mark = PALETTE.terrain?.mark ?? PALETTE.bg;
  px(ctx, x, y, s, s, surface);

  // Two specks of grit, so a long straight road is not a dead flat slab. Any
  // more and the road starts competing with the search overlay for attention.
  if (hash2(col, row, 1) > 0.72) px(ctx, x + 4, y + 11, 1, 1, mark);
  if (hash2(col, row, 2) > 0.82) px(ctx, x + 11, y + 5, 1, 1, mark);

  const vertical = (mask & OPEN.N) !== 0 || (mask & OPEN.S) !== 0;
  const horizontal = (mask & OPEN.E) !== 0 || (mask & OPEN.W) !== 0;

  if (mask & OPEN.CROSS) {
    drawCrossroadDot(ctx, x, y);
  } else if (vertical && horizontal) {
    // Open ground rather than a junction - no lane markings belong here.
    dither(ctx, x + 4, y + 4, s - 8, s - 8, PALETTE.mid, 0.2);
  } else if (vertical) {
    px(ctx, x + s / 2 - 1, y + 2, 2, 5, mark);
    px(ctx, x + s / 2 - 1, y + 9, 2, 5, mark);
  } else if (horizontal) {
    px(ctx, x + 2, y + s / 2 - 1, 5, 2, mark);
    px(ctx, x + 9, y + s / 2 - 1, 5, 2, mark);
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

  // Under a colour filter each structure takes its own accent, keyed off the
  // building's seed so the whole footprint agrees and the choice survives a
  // repaint. With no filter the list is empty and every roof stays the palette's
  // own mid tone, exactly as before.
  const face = BUILDING_HUES.length
    ? BUILDING_HUES[building.seed % BUILDING_HUES.length]
    : PALETTE.mid;
  px(ctx, x, y, TILE_PX, TILE_PX, face);

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
  if (SETTLED_SNOW) settleSnow(ctx, x, y, col, row, mask);
}

/**
 * Whether snow is lying on the world.
 *
 * A module flag rather than a parameter because it has to reach the roof
 * painters, the shoreline and the range, and threading it through every one of
 * them would mean changing a dozen signatures for a boolean that is the same
 * everywhere. {@link setSettledSnow} is called once when the weather changes.
 */
let SETTLED_SNOW = false;

/**
 * Turns settled snow on or off, and reports whether anything changed.
 *
 * The caller uses the return value to decide whether to repaint the terrain
 * cache, which is expensive - switching between two non-snow modes must not
 * trigger one.
 *
 * @param {boolean} on
 * @returns {boolean} true if the value actually moved
 */
export function setSettledSnow(on) {
  if (SETTLED_SNOW === on) return false;
  SETTLED_SNOW = on;
  return true;
}

/**
 * Lays snow along the lit edges of a roof.
 *
 * Only the top and the sun-facing sides collect, and the depth wanders with the
 * tile hash, so a block gets an uneven cap rather than a drawn-on white border.
 * Snow that settled evenly on every edge would read as an outline, which is
 * exactly what the roofs already have.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} col
 * @param {number} row
 * @param {number} mask - from {@link openMask}
 */
function settleSnow(ctx, x, y, col, row, mask) {
  const s = TILE_PX;
  const snow = PALETTE.bg;

  if (mask & OPEN.N) {
    for (let sx = 0; sx < s; sx++) {
      px(ctx, x + sx, y, 1, 2 + Math.floor(hash2(col * s + sx, row, 131) * 3), snow);
    }
  }
  if (mask & OPEN.W) {
    for (let sy = 0; sy < s; sy++) {
      px(ctx, x, y + sy, 1 + Math.floor(hash2(col, row * s + sy, 132) * 2), 1, snow);
    }
  }
  if (mask & OPEN.E) {
    for (let sy = 0; sy < s; sy++) {
      const d = 1 + Math.floor(hash2(col, row * s + sy, 133) * 2);
      px(ctx, x + s - d, y + sy, d, 1, snow);
    }
  }

  // A drift or two out on the open roof, so the middle is not bare.
  if (hash2(col, row, 134) > 0.6) px(ctx, x + 5, y + 6, 4, 2, snow);
  if (hash2(col, row, 135) > 0.78) px(ctx, x + 9, y + 10, 3, 2, snow);
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

  const grass = PALETTE.terrain?.parkDark ?? PALETTE.dark;
  const leaf = PALETTE.terrain?.park ?? PALETTE.mid;
  const leafLit = PALETTE.terrain?.park ? PALETTE.terrain.mark : PALETTE.light;

  px(ctx, x, y, s, s, grass);
  dither(ctx, x, y, s, s, leaf, 0.45);

  const canopy = (cxp, cyp, r) => {
    px(ctx, cxp - r, cyp - r + 1, r * 2, r * 2 - 1, PALETTE.black);
    px(ctx, cxp - r + 1, cyp - r, r * 2 - 2, r * 2 + 1, PALETTE.black);
    px(ctx, cxp - r + 1, cyp - r + 1, r * 2 - 2, r * 2 - 2, leaf);
    px(ctx, cxp - r + 1, cyp - r + 1, r - 1, r - 1, leafLit);
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
