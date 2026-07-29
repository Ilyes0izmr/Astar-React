/**
 * Procedural city generation.
 *
 * The city is laid out the way the art spec describes it: a lattice of one-tile
 * roads with solid building blocks in between, which reads as a dungeon of
 * corridors and rooms. On top of that skeleton the generator closes a few
 * streets, opens a few courtyards, and scatters hazards, so no two seeds play
 * the same.
 *
 *     ################
 *     ### ### ### ###
 *     ### ### ### ###
 *     ----+----------
 *     ### ### ### ###
 *     ################
 *
 * The one hard guarantee: whatever comes out is fully connected and has a
 * reachable start and goal. Everything the generator sealed off by accident is
 * filled back in with buildings, so the player never sees an island.
 *
 * @see instruction.md - "City Style"
 */
import { TILE } from './tiles.js';
import { createGrid, idx, setTile, neighbors, floodFill, furthestFrom } from './grid.js';
import { createRng, randomSeed } from './rng.js';

/**
 * @typedef {Object} CityOptions
 * @property {number} [width=25]
 * @property {number} [height=25]
 * @property {number} [blockSize=3] - building block edge, in tiles. Roads sit
 *   every blockSize+1 tiles.
 * @property {number} [closedStreets=0.28] - chance a street segment is walled off
 * @property {number} [courtyards=0.18] - chance a building block is an open room
 * @property {number} [hazards=0.1] - fraction of road tiles carrying rubble or spikes
 * @property {number} [coins=0.05] - fraction of road tiles carrying a coin
 * @property {number} [seed] - defaults to a fresh random seed
 */

/** @type {Required<Omit<CityOptions, 'seed'>>} */
export const DEFAULT_CITY = {
  width: 25,
  height: 25,
  blockSize: 3,
  closedStreets: 0.28,
  courtyards: 0.18,
  hazards: 0.1,
  coins: 0.05,
};

/**
 * Generates a complete, solvable city.
 *
 * @param {CityOptions} [options]
 * @returns {import('./grid.js').Grid}
 */
export function generateCity(options = {}) {
  const opts = { ...DEFAULT_CITY, ...options };
  const seed = options.seed ?? randomSeed();
  const rng = createRng(seed);

  const { width, height, blockSize } = opts;
  const period = blockSize + 1;
  const grid = createGrid(width, height, seed);

  carveRoadLattice(grid, period);
  openCourtyards(grid, period, blockSize, rng, opts.courtyards);
  closeStreets(grid, period, rng, opts.closedStreets);
  keepLargestRegion(grid);
  placeMarkers(grid);
  scatterHazards(grid, rng, opts.hazards, opts.coins);

  return grid;
}

/**
 * Carves the road grid: every `period`-th row and column becomes open corridor,
 * plus a ring road around the outside so the border is never a dead wall.
 *
 * @param {import('./grid.js').Grid} grid - mutated
 * @param {number} period
 */
function carveRoadLattice(grid, period) {
  const { width, height } = grid;

  for (let r = 0; r < height; r++) {
    const isRoadRow = r % period === 0 || r === height - 1;
    for (let c = 0; c < width; c++) {
      const isRoadCol = c % period === 0 || c === width - 1;
      if (isRoadRow || isRoadCol) grid.tiles[idx(grid, r, c)] = TILE.FLOOR;
    }
  }
}

/**
 * Turns some building blocks into open courtyards - the "rooms" of the dungeon.
 *
 * @param {import('./grid.js').Grid} grid - mutated
 * @param {number} period
 * @param {number} blockSize
 * @param {ReturnType<typeof createRng>} rng
 * @param {number} chance
 */
function openCourtyards(grid, period, blockSize, rng, chance) {
  const { width, height } = grid;

  for (let r0 = 1; r0 + blockSize <= height; r0 += period) {
    for (let c0 = 1; c0 + blockSize <= width; c0 += period) {
      if (!rng.chance(chance)) continue;

      // Rooms are rarely the full block - shaving a row or column off gives the
      // L-shapes and half-blocks the spec asks for instead of uniform squares.
      const h = rng.int(Math.max(1, blockSize - 1), blockSize);
      const w = rng.int(Math.max(1, blockSize - 1), blockSize);
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          grid.tiles[idx(grid, r, c)] = TILE.FLOOR;
        }
      }
    }
  }
}

/**
 * Walls off individual street segments so the lattice stops being a boring
 * uniform mesh. Only mid-block tiles are eligible; intersections stay open so
 * the road network keeps its shape.
 *
 * Connectivity is not checked here - {@link keepLargestRegion} cleans up after.
 *
 * @param {import('./grid.js').Grid} grid - mutated
 * @param {number} period
 * @param {ReturnType<typeof createRng>} rng
 * @param {number} chance
 */
function closeStreets(grid, period, rng, chance) {
  const { width, height } = grid;

  // Horizontal segments: along each road row, between consecutive intersections.
  for (let r = 0; r < height; r += period) {
    for (let c0 = 0; c0 + period < width; c0 += period) {
      if (!rng.chance(chance)) continue;
      const c = rng.int(c0 + 1, c0 + period - 1);
      grid.tiles[idx(grid, r, c)] = TILE.WALL;
    }
  }

  // Vertical segments: the same, down each road column.
  for (let c = 0; c < width; c += period) {
    for (let r0 = 0; r0 + period < height; r0 += period) {
      if (!rng.chance(chance)) continue;
      const r = rng.int(r0 + 1, r0 + period - 1);
      grid.tiles[idx(grid, r, c)] = TILE.WALL;
    }
  }
}

/**
 * Fills in every walkable region except the biggest one.
 *
 * Closing streets can strand a courtyard or a cul-de-sac behind a wall. Rather
 * than detect and avoid that during carving, we let it happen and bulldoze the
 * leftovers - which is both simpler and guarantees the invariant absolutely.
 *
 * @param {import('./grid.js').Grid} grid - mutated
 */
function keepLargestRegion(grid) {
  const seen = new Uint8Array(grid.tiles.length);
  let best = null;
  const buf = [];

  for (let i = 0; i < grid.tiles.length; i++) {
    if (seen[i] || grid.tiles[i] === TILE.WALL) continue;

    const region = [i];
    seen[i] = 1;
    for (let head = 0; head < region.length; head++) {
      const ns = neighbors(grid, region[head], buf);
      for (let k = 0; k < ns.length; k++) {
        if (!seen[ns[k]]) {
          seen[ns[k]] = 1;
          region.push(ns[k]);
        }
      }
    }
    if (!best || region.length > best.length) best = region;
  }

  if (!best) return;

  const keep = new Uint8Array(grid.tiles.length);
  for (const i of best) keep[i] = 1;
  for (let i = 0; i < grid.tiles.length; i++) {
    if (!keep[i]) grid.tiles[i] = TILE.WALL;
  }
}

/**
 * Drops the start and goal at opposite ends of the road network.
 *
 * Two breadth-first sweeps approximate the network's diameter: the cell
 * furthest from an arbitrary corner, then the cell furthest from *that*. It is
 * the standard tree-diameter trick and it gives a far more interesting run than
 * picking two random tiles, which land close together more often than you would
 * expect.
 *
 * @param {import('./grid.js').Grid} grid - mutated
 */
function placeMarkers(grid) {
  const firstOpen = grid.tiles.findIndex((t) => t !== TILE.WALL);
  if (firstOpen === -1) return;

  const { cell: a } = furthestFrom(grid, firstOpen);
  const { cell: b } = furthestFrom(grid, a);

  setTile(grid, a, TILE.START);
  setTile(grid, b, TILE.GOAL);
}

/**
 * Sprinkles rubble, spikes and coins across the roads.
 *
 * Hazards never land on the start or goal, and never on a tile whose removal
 * would matter - they are passable, so they cannot break connectivity.
 *
 * @param {import('./grid.js').Grid} grid - mutated
 * @param {ReturnType<typeof createRng>} rng
 * @param {number} hazardRate
 * @param {number} coinRate
 */
function scatterHazards(grid, rng, hazardRate, coinRate) {
  for (let i = 0; i < grid.tiles.length; i++) {
    if (grid.tiles[i] !== TILE.FLOOR) continue;

    const roll = rng.next();
    if (roll < coinRate) {
      grid.tiles[i] = TILE.COIN;
    } else if (roll < coinRate + hazardRate) {
      grid.tiles[i] = rng.chance(0.6) ? TILE.RUBBLE : TILE.SPIKE;
    }
  }
}

/**
 * Reports whether a goal is currently reachable from a start.
 *
 * The editor calls this after every brush stroke so the HUD can warn the moment
 * a player walls the goal in, rather than waiting for a run to fail.
 *
 * @param {import('./grid.js').Grid} grid
 * @returns {boolean}
 */
export function isSolvable(grid) {
  if (grid.start < 0 || grid.goal < 0) return false;
  return floodFill(grid, grid.start)[grid.goal] === 1;
}
