/**
 * Pieces every pathfinder shares: the heuristic, path reconstruction, and the
 * result envelope the visualizer consumes.
 */
import { MIN_STEP_COST, stepCost, energyDelta } from '../tiles.js';

/**
 * @typedef {Object} SearchStep
 * @property {number} cell - the cell expanded on this step
 * @property {number[]} frontier - cells queued *after* the expansion
 */

/**
 * @typedef {Object} SearchResult
 * @property {string} id - algorithm id
 * @property {boolean} found - whether the goal was reached
 * @property {number[]} path - flat cell indices, start to goal inclusive; empty if not found
 * @property {number} cost - summed {@link stepCost} over the path, excluding the start tile
 * @property {number} expanded - nodes pulled off the frontier
 * @property {SearchStep[]} steps - the expansion trace, for animation
 * @property {boolean} optimal - whether this algorithm guarantees a cheapest path
 */

/**
 * Manhattan distance, scaled by the cheapest possible move.
 *
 * Movement is 4-directional and no edge costs less than {@link MIN_STEP_COST},
 * so this never overestimates the true remaining cost. That is exactly the
 * admissibility condition A* needs to stay optimal - the moment someone adds a
 * cheaper tile or diagonal movement, this has to change with it.
 *
 * @param {import('../grid.js').Grid} grid
 * @param {number} a - flat index
 * @param {number} b - flat index
 * @returns {number}
 */
export function manhattan(grid, a, b) {
  const w = grid.width;
  const dr = Math.abs(Math.floor(a / w) - Math.floor(b / w));
  const dc = Math.abs((a % w) - (b % w));
  return (dr + dc) * MIN_STEP_COST;
}

/**
 * Walks the parent chain backwards from the goal.
 *
 * @param {Int32Array} parent - parent[i] is the cell we reached i from, or -1
 * @param {number} start
 * @param {number} goal
 * @returns {number[]} the path start-to-goal, or [] if the chain is broken
 */
export function reconstructPath(parent, start, goal) {
  const path = [];
  let cur = goal;
  // The bound is a safety net: a malformed parent array would otherwise spin
  // forever here.
  for (let guard = 0; guard <= parent.length; guard++) {
    path.push(cur);
    if (cur === start) {
      path.reverse();
      return path;
    }
    cur = parent[cur];
    if (cur === -1 || cur === undefined) break;
  }
  return [];
}

/**
 * Total movement cost of a path.
 *
 * The start tile is excluded - you do not pay to stand where you already are.
 *
 * @param {import('../grid.js').Grid} grid
 * @param {number[]} path
 * @returns {number}
 */
export function pathCost(grid, path) {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += stepCost(grid.tiles[path[i]]);
  return total;
}

/**
 * Replays a path through the energy rules to see whether the vehicle survives.
 *
 * This runs *after* the search, not during it. The algorithms optimize movement
 * cost; energy is a separate resource, so an optimal path can still strand you.
 * Surfacing that is the point - it is the case worth watching.
 *
 * @param {import('../grid.js').Grid} grid
 * @param {number[]} path
 * @param {number} startEnergy
 * @param {number} [maxEnergy=startEnergy] - cap, so coins cannot overfill the bar
 * @returns {{levels: number[], survived: boolean, stalledAt: number}}
 *   `levels[i]` is the energy on arriving at `path[i]`; `stalledAt` is the index
 *   where it ran out, or -1.
 */
export function simulateEnergy(grid, path, startEnergy, maxEnergy = startEnergy) {
  const levels = [];
  let energy = startEnergy;
  let stalledAt = -1;

  for (let i = 0; i < path.length; i++) {
    // The start tile is where the vehicle already is, so its terrain is free.
    if (i > 0) energy = Math.min(maxEnergy, energy + energyDelta(grid.tiles[path[i]]));
    levels.push(energy);
    if (energy <= 0 && stalledAt === -1 && i < path.length - 1) {
      stalledAt = i;
      break;
    }
  }

  return { levels, survived: stalledAt === -1, stalledAt };
}
