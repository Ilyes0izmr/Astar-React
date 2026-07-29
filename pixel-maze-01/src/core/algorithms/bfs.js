/**
 * Breadth-first search.
 *
 * Expands in rings of equal step count, so the first time it touches the goal
 * it has found a path with the *fewest tiles*. Note that is not the same as the
 * cheapest path: BFS is blind to terrain, so it will happily route straight
 * through a field of spikes to save one tile. Watching it lose to Dijkstra on a
 * hazard-heavy map is the clearest demonstration of why edge weights matter.
 *
 * Complexity: O(V + E). Optimal only when every edge costs the same.
 */
import { neighbors } from '../grid.js';
import { reconstructPath, pathCost } from './common.js';

/**
 * @param {import('../grid.js').Grid} grid
 * @param {{start?: number, goal?: number}} [options]
 * @returns {import('./common.js').SearchResult}
 */
export function bfs(grid, options = {}) {
  const start = options.start ?? grid.start;
  const goal = options.goal ?? grid.goal;

  const parent = new Int32Array(grid.tiles.length).fill(-1);
  const seen = new Uint8Array(grid.tiles.length);
  const steps = [];
  const buf = [];

  const queue = [start];
  seen[start] = 1;
  let expanded = 0;
  let found = false;

  // `head` walks forward instead of shift()ing, which would be O(n) per pop.
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    expanded++;

    if (cur === goal) {
      steps.push({ cell: cur, frontier: queue.slice(head + 1) });
      found = true;
      break;
    }

    const ns = neighbors(grid, cur, buf);
    for (let k = 0; k < ns.length; k++) {
      const n = ns[k];
      // Marking on enqueue, not on expansion, is what keeps each cell out of
      // the queue more than once.
      if (seen[n]) continue;
      seen[n] = 1;
      parent[n] = cur;
      queue.push(n);
    }

    steps.push({ cell: cur, frontier: queue.slice(head + 1) });
  }

  const path = found ? reconstructPath(parent, start, goal) : [];
  return {
    id: 'bfs',
    found,
    path,
    cost: pathCost(grid, path),
    expanded,
    steps,
    optimal: false,
  };
}
