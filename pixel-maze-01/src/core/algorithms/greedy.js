/**
 * Greedy best-first search.
 *
 * Ranks the frontier purely by the heuristic - whatever *looks* closest to the
 * goal gets expanded next, and the cost already spent getting there is ignored
 * completely. That makes it the fastest of the five on open maps and the most
 * easily fooled: a wall between it and the goal sends it charging into the dead
 * end, because every tile in there scores well right up until it stops.
 *
 * Unlike A* and Dijkstra there is no relaxation step. The first route greedy
 * finds to a cell is the route it keeps, which is precisely why the path it
 * returns can cost far more than the optimum.
 *
 * Complexity: O(E log V). Never optimal.
 */
import { neighbors } from '../grid.js';
import { MinHeap } from './heap.js';
import { manhattan, reconstructPath, pathCost } from './common.js';

/**
 * @param {import('../grid.js').Grid} grid
 * @param {{start?: number, goal?: number}} [options]
 * @returns {import('./common.js').SearchResult}
 */
export function greedy(grid, options = {}) {
  const start = options.start ?? grid.start;
  const goal = options.goal ?? grid.goal;

  const parent = new Int32Array(grid.tiles.length).fill(-1);
  const seen = new Uint8Array(grid.tiles.length);
  const steps = [];
  const buf = [];

  const open = new MinHeap();
  open.push(start, manhattan(grid, start, goal));
  seen[start] = 1;

  let expanded = 0;
  let found = false;

  while (open.size > 0) {
    const cur = open.pop();
    expanded++;

    if (cur === goal) {
      steps.push({ cell: cur, frontier: open.snapshot() });
      found = true;
      break;
    }

    const ns = neighbors(grid, cur, buf);
    for (let k = 0; k < ns.length; k++) {
      const n = ns[k];
      // Marked on enqueue and never revisited - this is the "no second chances"
      // behaviour that costs greedy its optimality.
      if (seen[n]) continue;
      seen[n] = 1;
      parent[n] = cur;
      open.push(n, manhattan(grid, n, goal));
    }

    steps.push({ cell: cur, frontier: open.snapshot() });
  }

  const path = found ? reconstructPath(parent, start, goal) : [];
  return {
    id: 'greedy',
    found,
    path,
    cost: pathCost(grid, path),
    expanded,
    steps,
    optimal: false,
  };
}
