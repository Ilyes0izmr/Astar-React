/**
 * A* search.
 *
 * Dijkstra plus a hint. Each cell is ranked by `f = g + h`: the cost already
 * paid to reach it, plus a Manhattan estimate of the cost still ahead. The
 * estimate steers the search toward the goal, so A* typically settles a small
 * fraction of the cells Dijkstra does while returning the identical path.
 *
 * That equivalence holds only because the heuristic is admissible - it never
 * claims the remaining trip is more expensive than it really is. See
 * {@link manhattan} for why the scaling matters.
 *
 * Complexity: O(E log V). Optimal, given an admissible heuristic.
 *
 * @see {@link https://www.redblobgames.com/pathfinding/a-star/introduction.html}
 */
import { bestFirstSearch } from './bestFirst.js';
import { manhattan } from './common.js';

/**
 * @param {import('../grid.js').Grid} grid
 * @param {{start?: number, goal?: number}} [options]
 * @returns {import('./common.js').SearchResult}
 */
export function astar(grid, options = {}) {
  const goal = options.goal ?? grid.goal;
  return bestFirstSearch(grid, {
    id: 'astar',
    heuristic: (cell) => manhattan(grid, cell, goal),
    ...options,
  });
}
