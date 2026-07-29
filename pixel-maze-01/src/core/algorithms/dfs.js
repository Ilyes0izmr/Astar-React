/**
 * Depth-first search.
 *
 * Follows one corridor as far as it goes before backing up. It is the fastest
 * to *find something* and the worst at finding something good - expect long,
 * looping paths that wander the whole map. It is here as the honest baseline:
 * it guarantees only that a path exists, never that it is short or cheap.
 *
 * Implemented iteratively with an explicit stack. The original code recursed,
 * which on a large city risks blowing the JavaScript call stack; this cannot.
 *
 * Complexity: O(V + E). Never optimal.
 */
import { neighbors } from '../grid.js';
import { reconstructPath, pathCost } from './common.js';

/**
 * @param {import('../grid.js').Grid} grid
 * @param {{start?: number, goal?: number}} [options]
 * @returns {import('./common.js').SearchResult}
 */
export function dfs(grid, options = {}) {
  const start = options.start ?? grid.start;
  const goal = options.goal ?? grid.goal;

  const parent = new Int32Array(grid.tiles.length).fill(-1);
  const visited = new Uint8Array(grid.tiles.length);
  const steps = [];
  const buf = [];

  const stack = [start];
  let expanded = 0;
  let found = false;

  while (stack.length > 0) {
    const cur = stack.pop();
    // A cell can be pushed several times before it is popped, so the visited
    // check belongs here rather than at push time.
    if (visited[cur]) continue;
    visited[cur] = 1;
    expanded++;

    if (cur === goal) {
      steps.push({ cell: cur, frontier: stack.slice() });
      found = true;
      break;
    }

    const ns = neighbors(grid, cur, buf);
    // Reversed so the first neighbor (north) is popped first, matching the
    // neighbor order the other algorithms explore in.
    for (let k = ns.length - 1; k >= 0; k--) {
      const n = ns[k];
      if (visited[n]) continue;
      parent[n] = cur;
      stack.push(n);
    }

    steps.push({ cell: cur, frontier: stack.slice() });
  }

  const path = found ? reconstructPath(parent, start, goal) : [];
  return {
    id: 'dfs',
    found,
    path,
    cost: pathCost(grid, path),
    expanded,
    steps,
    optimal: false,
  };
}
