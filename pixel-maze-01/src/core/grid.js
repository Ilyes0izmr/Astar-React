/**
 * The grid data structure every other module agrees on.
 *
 * Tiles live in a flat `Uint8Array` rather than a 2D array of objects. The
 * pathfinders touch this a lot - a 41x41 city is 1681 cells and A* will read
 * neighbors thousands of times per run - and a flat typed array keeps that
 * cache-friendly and allocation-free. Cells are addressed by a single integer
 * index; {@link idx} and {@link rowOf}/{@link colOf} convert.
 */
import { TILE, isWalkable } from './tiles.js';

/**
 * @typedef {Object} Grid
 * @property {number} width
 * @property {number} height
 * @property {Uint8Array} tiles - length width*height, values are {@link TILE} ids
 * @property {number} seed - the seed this grid was generated from
 * @property {number} start - cell index of the start marker, or -1
 * @property {number} goal - cell index of the goal marker, or -1
 */

/**
 * Allocates an all-wall grid. Generators carve into it.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} [seed=0]
 * @returns {Grid}
 */
export function createGrid(width, height, seed = 0) {
  return {
    width,
    height,
    tiles: new Uint8Array(width * height).fill(TILE.WALL),
    seed,
    start: -1,
    goal: -1,
  };
}

/** Structural copy. Editing the clone never touches the original. */
export function cloneGrid(grid) {
  return { ...grid, tiles: Uint8Array.from(grid.tiles) };
}

/** @returns {number} the flat index of (row, col). No bounds checking. */
export const idx = (grid, row, col) => row * grid.width + col;

/** @returns {number} the row of a flat index. */
export const rowOf = (grid, i) => Math.floor(i / grid.width);

/** @returns {number} the column of a flat index. */
export const colOf = (grid, i) => i % grid.width;

/** @returns {boolean} true if (row, col) is on the map. */
export function inBounds(grid, row, col) {
  return row >= 0 && row < grid.height && col >= 0 && col < grid.width;
}

/** @returns {number} the tile id at a flat index. */
export const tileAt = (grid, i) => grid.tiles[i];

/**
 * Writes a tile, keeping the cached start/goal indices honest.
 *
 * Placing a START or GOAL moves the existing one rather than creating a second,
 * and overwriting the tile a marker sat on clears that marker. Doing this here
 * rather than in the editor is what keeps the invariant "at most one of each"
 * from drifting.
 *
 * @param {Grid} grid - mutated in place
 * @param {number} i - flat cell index
 * @param {number} tile - a {@link TILE} id
 */
export function setTile(grid, i, tile) {
  if (grid.start === i && tile !== TILE.START) grid.start = -1;
  if (grid.goal === i && tile !== TILE.GOAL) grid.goal = -1;

  if (tile === TILE.START) {
    if (grid.start >= 0) grid.tiles[grid.start] = TILE.FLOOR;
    if (grid.goal === i) grid.goal = -1;
    grid.start = i;
  } else if (tile === TILE.GOAL) {
    if (grid.goal >= 0) grid.tiles[grid.goal] = TILE.FLOOR;
    if (grid.start === i) grid.start = -1;
    grid.goal = i;
  }

  grid.tiles[i] = tile;
}

/**
 * The four orthogonal neighbors of a cell, walls excluded.
 *
 * Movement is 4-directional on purpose. Roads are one tile wide corridors, so
 * diagonal moves would cut building corners and break the dungeon illusion.
 *
 * @param {Grid} grid
 * @param {number} i - flat cell index
 * @param {number[]} [out=[]] - reused array, cleared and refilled
 * @returns {number[]} flat indices of the walkable neighbors
 */
export function neighbors(grid, i, out = []) {
  out.length = 0;
  const w = grid.width;
  const row = Math.floor(i / w);
  const col = i % w;

  if (row > 0) {
    const n = i - w;
    if (isWalkable(grid.tiles[n])) out.push(n);
  }
  if (col < w - 1) {
    const n = i + 1;
    if (isWalkable(grid.tiles[n])) out.push(n);
  }
  if (row < grid.height - 1) {
    const n = i + w;
    if (isWalkable(grid.tiles[n])) out.push(n);
  }
  if (col > 0) {
    const n = i - 1;
    if (isWalkable(grid.tiles[n])) out.push(n);
  }
  return out;
}

/**
 * Flood fills from a seed cell across walkable tiles.
 *
 * Used by the city generator to throw away pockets it accidentally sealed off,
 * and by the UI to gray out unreachable regions.
 *
 * @param {Grid} grid
 * @param {number} from - flat index to start from
 * @returns {Uint8Array} 1 for reachable cells, 0 otherwise
 */
export function floodFill(grid, from) {
  const seen = new Uint8Array(grid.tiles.length);
  if (from < 0 || !isWalkable(grid.tiles[from])) return seen;

  const queue = [from];
  seen[from] = 1;
  const buf = [];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const ns = neighbors(grid, cur, buf);
    for (let k = 0; k < ns.length; k++) {
      if (!seen[ns[k]]) {
        seen[ns[k]] = 1;
        queue.push(ns[k]);
      }
    }
  }
  return seen;
}

/**
 * Finds the walkable cell furthest (in tile count, ignoring terrain cost) from
 * a given one, plus the set of cells it could reach.
 *
 * Running this twice - once from any cell, once from whatever it returns -
 * approximates the diameter of the road network. That is how the generator
 * picks a start and goal that are genuinely far apart instead of adjacent.
 *
 * @param {Grid} grid
 * @param {number} from
 * @returns {{cell: number, dist: Int32Array}}
 */
export function furthestFrom(grid, from) {
  const dist = new Int32Array(grid.tiles.length).fill(-1);
  if (from < 0) return { cell: -1, dist };

  dist[from] = 0;
  const queue = [from];
  let best = from;
  const buf = [];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    if (dist[cur] > dist[best]) best = cur;
    const ns = neighbors(grid, cur, buf);
    for (let k = 0; k < ns.length; k++) {
      if (dist[ns[k]] === -1) {
        dist[ns[k]] = dist[cur] + 1;
        queue.push(ns[k]);
      }
    }
  }
  return { cell: best, dist };
}
