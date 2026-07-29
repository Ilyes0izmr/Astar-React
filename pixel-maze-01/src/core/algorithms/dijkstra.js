/**
 * Dijkstra's algorithm.
 *
 * Expands the cheapest-so-far cell every time, with no guess about where the
 * goal is. That blindness is why it fans out evenly in all directions and why
 * it always finds the cheapest route: it cannot be lured down a wrong corridor
 * by a bad estimate, because it makes no estimate at all.
 *
 * Against A* on the same map it settles for exploring noticeably more of the
 * city to reach the same answer - which is the whole argument for a heuristic.
 *
 * Complexity: O(E log V) with a binary heap. Always optimal.
 */
import { bestFirstSearch } from './bestFirst.js';

/**
 * @param {import('../grid.js').Grid} grid
 * @param {{start?: number, goal?: number}} [options]
 * @returns {import('./common.js').SearchResult}
 */
export function dijkstra(grid, options = {}) {
  return bestFirstSearch(grid, {
    id: 'dijkstra',
    // A zero heuristic is exactly what makes this Dijkstra rather than A*.
    heuristic: () => 0,
    ...options,
  });
}
