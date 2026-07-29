/**
 * The algorithm registry.
 *
 * Everything the UI needs to know about a pathfinder lives here: how to run it,
 * what to call it on a menu card, and the one-line explanation of what makes it
 * different. Adding a sixth algorithm means adding one entry to this list and
 * nothing else - the menu, the HUD and the compare view all read from it.
 */
import { astar } from './astar.js';
import { dijkstra } from './dijkstra.js';
import { bfs } from './bfs.js';
import { dfs } from './dfs.js';
import { greedy } from './greedy.js';

export { simulateEnergy, manhattan, pathCost } from './common.js';

/**
 * @typedef {Object} AlgorithmEntry
 * @property {string} id
 * @property {string} label - short name for cards and the HUD
 * @property {string} tagline - one line, shown under the card
 * @property {string} detail - the trade-off, shown on the selected card
 * @property {boolean} optimal - whether it guarantees a cheapest path
 * @property {(grid: import('../grid.js').Grid, options?: Object) =>
 *   import('./common.js').SearchResult} run
 */

/** @type {AlgorithmEntry[]} */
export const ALGORITHMS = [
  {
    id: 'astar',
    label: 'A*',
    tagline: 'COST + GUESS',
    detail: 'Cheapest path, guided by a distance estimate. Fast and optimal.',
    optimal: true,
    run: astar,
  },
  {
    id: 'bfs',
    label: 'BFS',
    tagline: 'FEWEST TILES',
    detail: 'Expands in rings. Shortest in steps, but blind to terrain cost.',
    optimal: false,
    run: bfs,
  },
  {
    id: 'dfs',
    label: 'DFS',
    tagline: 'DIVE DEEP',
    detail: 'Follows one corridor to the end. Finds a path, rarely a good one.',
    optimal: false,
    run: dfs,
  },
  {
    id: 'dijkstra',
    label: 'DIJKSTRA',
    tagline: 'PURE COST',
    detail: 'Cheapest path with no guessing. Optimal, but explores everything.',
    optimal: true,
    run: dijkstra,
  },
  {
    id: 'greedy',
    label: 'GREEDY',
    tagline: 'CHASE GOAL',
    detail: 'Runs at whatever looks closest. Quick, and easily trapped.',
    optimal: false,
    run: greedy,
  },
];

/** @type {Record<string, AlgorithmEntry>} */
export const ALGORITHM_BY_ID = Object.fromEntries(ALGORITHMS.map((a) => [a.id, a]));

/**
 * Runs one algorithm by id.
 *
 * @param {string} id
 * @param {import('../grid.js').Grid} grid
 * @param {Object} [options] - forwarded to the algorithm ({start, goal})
 * @returns {import('./common.js').SearchResult}
 * @throws {Error} if the id is not registered
 */
export function runAlgorithm(id, grid, options) {
  const entry = ALGORITHM_BY_ID[id];
  if (!entry) throw new Error(`Unknown algorithm: ${id}`);
  return entry.run(grid, options);
}

/**
 * Runs every algorithm on the same city.
 *
 * Used by the compare panel, where seeing all five side by side on one map is
 * the fastest way to understand what separates them.
 *
 * @param {import('../grid.js').Grid} grid
 * @returns {Array<import('./common.js').SearchResult & {label: string}>}
 */
export function runAll(grid) {
  return ALGORITHMS.map((a) => ({ ...a.run(grid), label: a.label }));
}
