/**
 * Building identity.
 *
 * A city block is not a pile of independent wall tiles - it is one structure
 * that happens to span several of them. This module finds those structures by
 * flood-filling connected walls, then gives each one a type and a height.
 *
 * That grouping is what makes the skyline read. When every tile picked its own
 * appearance the result was visual static: brick next to concrete next to brick
 * inside what should obviously be a single warehouse. Deciding once per
 * *building* and letting its tiles inherit is the entire difference between a
 * city and a texture.
 *
 * Height feeds the shadow pass. A row of blocks that all cast the same shadow
 * reads flat however carefully each one is shaded, so height varies per
 * building and the shadows vary with it.
 *
 * @see instruction.md - "Building Shapes", "Building Appearance"
 */
import { TILE } from './tiles.js';
import { createRng } from './rng.js';

/**
 * The building vocabulary.
 *
 * Each entry says how its facade is drawn and roughly how tall it stands. The
 * painter keys off `id`; everything else here is what the generator uses to
 * decide which type suits a given footprint.
 *
 * @typedef {Object} BuildingType
 * @property {string} id
 * @property {[number, number]} floors - inclusive height range
 * @property {number} weight - relative frequency
 * @property {(w: number, h: number) => boolean} fits - footprint test
 */

/** @type {BuildingType[]} */
export const BUILDING_TYPES = [
  {
    // Brick residential. The default, and the most common thing in the city.
    id: 'apartment',
    floors: [2, 4],
    weight: 30,
    fits: () => true,
  },
  {
    // Regular window grid, flat concrete. Reads corporate.
    id: 'office',
    floors: [3, 5],
    weight: 18,
    fits: (w, h) => w >= 2 && h >= 2,
  },
  {
    // Long, low, corrugated roof, almost no windows.
    id: 'warehouse',
    floors: [1, 2],
    weight: 14,
    fits: (w, h) => w >= 3 || h >= 3,
  },
  {
    // Narrow and tall. Throws the longest shadow in the city.
    id: 'tower',
    floors: [4, 5],
    weight: 10,
    fits: (w, h) => w <= 2 || h <= 2,
  },
  {
    // Ground-floor retail: awning, big front window, sign board.
    id: 'shop',
    floors: [1, 2],
    weight: 14,
    fits: (w, h) => w <= 3 && h <= 3,
  },
  {
    // Pipes, vents and tanks on the roof.
    id: 'industrial',
    floors: [2, 3],
    weight: 8,
    fits: (w, h) => w >= 2 && h >= 2,
  },
  {
    // Not a building at all - a stand of trees inside the block. Impassable
    // like the rest, but it breaks up the masonry and gives the eye somewhere
    // to rest, which is what the reference art uses parks for.
    id: 'park',
    floors: [1, 1],
    weight: 12,
    fits: () => true,
  },
];

/** @type {Record<string, BuildingType>} */
export const BUILDING_BY_ID = Object.fromEntries(BUILDING_TYPES.map((t) => [t.id, t]));

/**
 * @typedef {Object} Building
 * @property {number} id
 * @property {string} type - a {@link BUILDING_TYPES} id
 * @property {number} height - floors, 1..5
 * @property {number[]} tiles - flat cell indices
 * @property {number} r0
 * @property {number} c0
 * @property {number} r1
 * @property {number} c1
 * @property {number} seed - per-building noise seed, for facade detail
 */

/**
 * @typedef {Object} BuildingIndex
 * @property {Int32Array} ownerOf - building id per cell, -1 for open ground
 * @property {Building[]} list - indexed by building id
 */

/**
 * Groups the grid's walls into buildings and characterises each one.
 *
 * Deterministic for a given grid: the type and height come from the grid's own
 * seed mixed with the building's position, so regenerating or repainting never
 * reshuffles the skyline.
 *
 * @param {import('./grid.js').Grid} grid
 * @returns {BuildingIndex}
 */
export function analyzeBuildings(grid) {
  const { width, height, tiles } = grid;
  const ownerOf = new Int32Array(tiles.length).fill(-1);
  /** @type {Building[]} */
  const list = [];

  for (let start = 0; start < tiles.length; start++) {
    if (tiles[start] !== TILE.WALL || ownerOf[start] !== -1) continue;

    const id = list.length;
    const cells = [start];
    ownerOf[start] = id;

    let r0 = Math.floor(start / width);
    let r1 = r0;
    let c0 = start % width;
    let c1 = c0;

    // Flood fill across orthogonally touching walls. Diagonal contact does not
    // join two buildings - a corner kiss is two neighbours, not one structure.
    for (let head = 0; head < cells.length; head++) {
      const cur = cells[head];
      const row = Math.floor(cur / width);
      const col = cur % width;

      if (row < r0) r0 = row;
      if (row > r1) r1 = row;
      if (col < c0) c0 = col;
      if (col > c1) c1 = col;

      const push = (n) => {
        if (tiles[n] === TILE.WALL && ownerOf[n] === -1) {
          ownerOf[n] = id;
          cells.push(n);
        }
      };
      if (row > 0) push(cur - width);
      if (row < height - 1) push(cur + width);
      if (col > 0) push(cur - 1);
      if (col < width - 1) push(cur + 1);
    }

    const seed = (grid.seed ^ (r0 * 73856093) ^ (c0 * 19349663) ^ (cells.length * 83492791)) >>> 0;
    const rng = createRng(seed);
    const w = c1 - c0 + 1;
    const h = r1 - r0 + 1;
    const type = pickType(rng, w, h);

    list.push({
      id,
      type: type.id,
      height: rng.int(type.floors[0], type.floors[1]),
      tiles: cells,
      r0,
      c0,
      r1,
      c1,
      seed,
    });
  }

  return { ownerOf, list };
}

/**
 * Weighted pick among the types whose footprint test the building passes.
 *
 * @param {ReturnType<typeof createRng>} rng
 * @param {number} w - footprint width in tiles
 * @param {number} h - footprint height in tiles
 * @returns {BuildingType}
 */
function pickType(rng, w, h) {
  const eligible = BUILDING_TYPES.filter((t) => t.fits(w, h));
  const total = eligible.reduce((sum, t) => sum + t.weight, 0);
  let roll = rng.next() * total;
  for (const type of eligible) {
    roll -= type.weight;
    if (roll <= 0) return type;
  }
  return eligible[eligible.length - 1];
}

/**
 * Where a tile sits inside its building.
 *
 * The facade painters need this to know which tiles carry the top edge, which
 * carry the base shadow, and how to lay a window grid across a footprint
 * without restarting it on every tile.
 *
 * @param {import('./grid.js').Grid} grid
 * @param {Building} building
 * @param {number} cell - flat index
 * @returns {{lx: number, ly: number, w: number, h: number, isTop: boolean,
 *            isBottom: boolean, isLeft: boolean, isRight: boolean}}
 */
export function localPosition(grid, building, cell) {
  const row = Math.floor(cell / grid.width);
  const col = cell % grid.width;
  const idxOf = (r, c) => r * grid.width + c;
  const solid = (r, c) =>
    r >= building.r0 - 1 &&
    r <= building.r1 + 1 &&
    c >= building.c0 - 1 &&
    c <= building.c1 + 1 &&
    r >= 0 &&
    r < grid.height &&
    c >= 0 &&
    c < grid.width &&
    grid.tiles[idxOf(r, c)] === TILE.WALL;

  return {
    lx: col - building.c0,
    ly: row - building.r0,
    w: building.c1 - building.c0 + 1,
    h: building.r1 - building.r0 + 1,
    isTop: !solid(row - 1, col),
    isBottom: !solid(row + 1, col),
    isLeft: !solid(row, col - 1),
    isRight: !solid(row, col + 1),
  };
}
