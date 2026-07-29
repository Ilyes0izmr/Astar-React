/**
 * The shared engine behind Dijkstra and A*.
 *
 * Both are the same algorithm with different priorities: Dijkstra orders the
 * frontier by cost-so-far, A* by cost-so-far plus an estimate of what remains.
 * Set the heuristic to zero and A* *is* Dijkstra, which is easiest to see when
 * they share one implementation rather than two near-copies.
 *
 * Greedy best-first deliberately does not live here - it skips relaxation
 * entirely, so it gets its own loop.
 */
import { neighbors } from '../grid.js';
import { stepCost } from '../tiles.js';
import { MinHeap } from './heap.js';
import { reconstructPath, pathCost } from './common.js';

/**
 * @param {import('../grid.js').Grid} grid
 * @param {Object} config
 * @param {string} config.id - algorithm id, copied into the result
 * @param {(cell: number) => number} config.heuristic - estimated remaining cost;
 *   must never overestimate, or the result stops being optimal
 * @param {number} [config.start]
 * @param {number} [config.goal]
 * @returns {import('./common.js').SearchResult}
 */
export function bestFirstSearch(grid, { id, heuristic, start, goal }) {
  const from = start ?? grid.start;
  const to = goal ?? grid.goal;

  const size = grid.tiles.length;
  const gScore = new Float64Array(size).fill(Infinity);
  const parent = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const steps = [];
  const buf = [];

  const open = new MinHeap();
  gScore[from] = 0;
  open.push(from, heuristic(from));

  let expanded = 0;
  let found = false;

  while (open.size > 0) {
    const cur = open.pop();

    // Lazy deletion: the heap has no decrease-key, so a cell can sit in it
    // several times with stale priorities. The first pop is the good one;
    // every later pop is a leftover and gets dropped here.
    if (closed[cur]) continue;
    closed[cur] = 1;
    expanded++;

    if (cur === to) {
      steps.push({ cell: cur, frontier: open.snapshot() });
      found = true;
      break;
    }

    const ns = neighbors(grid, cur, buf);
    for (let k = 0; k < ns.length; k++) {
      const n = ns[k];
      if (closed[n]) continue;

      const tentative = gScore[cur] + stepCost(grid.tiles[n]);
      if (tentative < gScore[n]) {
        gScore[n] = tentative;
        parent[n] = cur;
        open.push(n, tentative + heuristic(n));
      }
    }

    steps.push({ cell: cur, frontier: open.snapshot() });
  }

  const path = found ? reconstructPath(parent, from, to) : [];
  return {
    id,
    found,
    path,
    cost: pathCost(grid, path),
    expanded,
    steps,
    optimal: true,
  };
}
