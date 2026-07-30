/**
 * Procedural generation of the whole map: landscape first, then the city
 * inside it.
 *
 * The city itself is laid out the way the art spec describes it - a lattice of
 * one-tile roads with solid blocks between them, which reads as a dungeon of
 * corridors and rooms. What surrounds it comes from {@link ./landscape.js}:
 * mountains north, sea south, and a river between the two.
 *
 *     ^^^^^^^^^^^^^^^^^^^^^^^^^^      mountains
 *     ####  ####  ~  ####  ####
 *     ----  ----  =  ----  ----       bridges where streets meet the river
 *     ####  ####  ~   ####  ###
 *     ..........~~~............       beach
 *     ~~~~~~~~~~~~~~~~~~~~~~~~~~      sea
 *     ==_==_==_=~~~~~~~~~~~~~~~~      harbour, south-west
 *
 * The one hard guarantee: whatever comes out is fully connected and has a
 * reachable start and goal. Everything sealed off by accident is filled back in
 * with buildings, so the player never sees an island.
 *
 * @see instruction.md - "City Style"
 */
import { TILE } from './tiles.js';
import { createGrid, idx, setTile, neighbors, floodFill, furthestFrom } from './grid.js';
import { createRng, randomSeed } from './rng.js';
import { analyzeBuildings } from './buildings.js';
import { carveFrame, carveRiver, buildBridges, buildPort, openShoreline, carveStation, placeLighthouse } from './landscape.js';

/**
 * @typedef {Object} CityOptions
 * @property {number} [width=29]
 * @property {number} [height=29]
 * @property {number} [blockSize=3] - building block edge, in tiles. Roads sit
 *   every blockSize+1 tiles.
 * @property {number} [closedStreets=0.24] - chance a street segment is walled off
 * @property {number} [courtyards=0.16] - chance a building block is an open room
 * @property {number} [hazards=0.09] - fraction of road tiles carrying rubble or spikes
 * @property {number} [coins=0.05] - fraction of road tiles carrying a coin
 * @property {number} [seed] - defaults to a fresh random seed
 */

/**
 * @type {Required<Omit<CityOptions, 'seed'>>}
 *
 * The map is deliberately large and taller than it is wide. The frame costs
 * about nine rows off the top and bottom - three of mountains, two of beach,
 * four of sea - so a square map would leave a squashed, wide city with little
 * room for a search to get lost in. Extra height buys that room back.
 */
export const DEFAULT_CITY = {
  width: 35,
  height: 41,
  blockSize: 3,
  closedStreets: 0.24,
  courtyards: 0.16,
  hazards: 0.09,
  coins: 0.05,
};

/** Selectable map sizes, smallest first. Each is taller than wide, see above. */
export const MAP_SIZES = [
  { id: 'small', label: 'SMALL', width: 27, height: 31 },
  { id: 'medium', label: 'MEDIUM', width: 35, height: 41 },
  { id: 'large', label: 'LARGE', width: 43, height: 51 },
  { id: 'huge', label: 'HUGE', width: 51, height: 61 },
  { id: 'mega', label: 'MEGA', width: 61, height: 71 },
];

/**
 * Generates a complete, solvable map.
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

  const frame = carveFrame(grid, rng);
  grid.frame = frame;
  carveStation(grid, frame);

  carveRoadLattice(grid, period, frame);
  openCourtyards(grid, period, blockSize, rng, opts.courtyards, frame);
  closeStreets(grid, period, rng, opts.closedStreets, frame);

  const river = carveRiver(grid, frame, rng);
  buildBridges(grid, frame, river, period);
  buildPort(grid, frame, rng);
  placeLighthouse(grid, frame);
  openShoreline(grid, frame, period);

  const region = keepLargestRegion(grid);
  placeMarkers(grid, region);
  scatterHazards(grid, rng, opts.hazards, opts.coins);
  refreshBuildings(grid);
  plantGreenBelt(grid, frame);

  return grid;
}

/**
 * Recomputes the building index after the walls change.
 *
 * The editor has to call this - painting a wall can merge two buildings into
 * one or split one in half, and a stale index would leave the painter drawing a
 * warehouse roof across what is now two separate blocks.
 *
 * @param {import('./grid.js').Grid} grid - mutated
 * @returns {import('./grid.js').Grid} the same grid, for chaining
 */
export function refreshBuildings(grid) {
  grid.buildings = analyzeBuildings(grid);
  return grid;
}

/**
 * Turns the blocks nearest the mountains into parkland.
 *
 * Real cities thin out into green before they hit a range rather than stopping
 * at a hard line of masonry, and the reference art makes a lot of that
 * transition. This runs after the building index is built, so it only has to
 * retype the blocks rather than change any geometry.
 *
 * @param {import('./grid.js').Grid} grid - mutated
 * @param {import('./landscape.js').Frame} frame
 */
function plantGreenBelt(grid, frame) {
  const belt = frame.r0 + 2;
  for (const building of grid.buildings.list) {
    if (building.r0 <= belt) building.type = 'park';
  }
}

/**
 * Carves the road grid inside the frame: every `period`-th row and column
 * becomes open corridor, plus a ring road around the interior.
 *
 * @param {import('./grid.js').Grid} grid - mutated
 * @param {number} period
 * @param {import('./landscape.js').Frame} frame
 */
function carveRoadLattice(grid, period, frame) {
  for (let r = frame.r0; r <= frame.r1; r++) {
    const isRoadRow = (r - frame.r0) % period === 0 || r === frame.r1;
    for (let c = frame.c0; c <= frame.c1; c++) {
      const isRoadCol = (c - frame.c0) % period === 0 || c === frame.c1;
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
 * @param {import('./landscape.js').Frame} frame
 */
function openCourtyards(grid, period, blockSize, rng, chance, frame) {
  for (let r0 = frame.r0 + 1; r0 + blockSize <= frame.r1; r0 += period) {
    for (let c0 = frame.c0 + 1; c0 + blockSize <= frame.c1; c0 += period) {
      if (!rng.chance(chance)) continue;

      // Rooms are rarely the full block - shaving a row or column off gives the
      // L-shapes and half-blocks the spec asks for instead of uniform squares.
      const h = rng.int(Math.max(1, blockSize - 1), blockSize);
      const w = rng.int(Math.max(1, blockSize - 1), blockSize);
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) grid.tiles[idx(grid, r, c)] = TILE.FLOOR;
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
 * @param {import('./landscape.js').Frame} frame
 */
function closeStreets(grid, period, rng, chance, frame) {
  for (let r = frame.r0; r <= frame.r1; r += period) {
    for (let c0 = frame.c0; c0 + period <= frame.c1; c0 += period) {
      if (!rng.chance(chance)) continue;
      grid.tiles[idx(grid, r, rng.int(c0 + 1, c0 + period - 1))] = TILE.WALL;
    }
  }

  for (let c = frame.c0; c <= frame.c1; c += period) {
    for (let r0 = frame.r0; r0 + period <= frame.r1; r0 += period) {
      if (!rng.chance(chance)) continue;
      grid.tiles[idx(grid, rng.int(r0 + 1, r0 + period - 1), c)] = TILE.WALL;
    }
  }
}

/**
 * Fills in every reachable region except the biggest one.
 *
 * Closing streets and cutting a river can strand a courtyard or a whole bank.
 * Rather than detect and avoid that while carving, we let it happen and
 * bulldoze the leftovers, which is both simpler and makes the guarantee
 * absolute.
 *
 * Only *city* tiles get bulldozed. Sand, piers and bridges are left alone even
 * when they end up unreachable - filling a stranded beach with masonry would
 * look far stranger than a beach nobody visits.
 *
 * @param {import('./grid.js').Grid} grid - mutated
 * @returns {number[]} the cells of the surviving region
 */
function keepLargestRegion(grid) {
  const seen = new Uint8Array(grid.tiles.length);
  let best = null;
  const buf = [];

  for (let i = 0; i < grid.tiles.length; i++) {
    if (seen[i] || !isCityFloor(grid.tiles[i])) continue;

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

  if (!best) return [];

  const keep = new Uint8Array(grid.tiles.length);
  for (const i of best) keep[i] = 1;
  for (let i = 0; i < grid.tiles.length; i++) {
    if (!keep[i] && isCityFloor(grid.tiles[i])) grid.tiles[i] = TILE.WALL;
  }
  return best;
}

/** Road surface the generator is free to bulldoze. */
function isCityFloor(tile) {
  return tile === TILE.FLOOR || tile === TILE.COIN || tile === TILE.RUBBLE || tile === TILE.SPIKE;
}

/**
 * Drops the start and goal at opposite ends of the road network.
 *
 * Two breadth-first sweeps approximate the network's diameter: the cell
 * furthest from an arbitrary one, then the cell furthest from *that*. It is the
 * standard tree-diameter trick and it gives a far more interesting run than
 * picking two random tiles, which land close together more often than you would
 * expect.
 *
 * Seeding from the surviving region rather than the first walkable tile matters
 * now that there is scenery: the first walkable tile on the map is usually a
 * corner of beach, and a marker placed from there can land somewhere the city
 * cannot reach.
 *
 * @param {import('./grid.js').Grid} grid - mutated
 * @param {number[]} region - from {@link keepLargestRegion}
 */
function placeMarkers(grid, region) {
  if (region.length === 0) return;

  const { cell: a } = furthestFrom(grid, region[0]);
  const { cell: b } = furthestFrom(grid, a);

  setTile(grid, a, TILE.START);
  setTile(grid, b, TILE.GOAL);
}

/**
 * Sprinkles rubble, spikes and coins across the roads.
 *
 * Hazards never land on the start or goal, and never on scenery - they are
 * passable, so they cannot break connectivity.
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
