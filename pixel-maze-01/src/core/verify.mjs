/**
 * Correctness checks for the search core. Run with `npm run verify`.
 *
 * Everything here is pure logic with no DOM, so it runs straight in Node with
 * no test framework or build step. It is worth having because the properties it
 * asserts are exactly the ones that are easy to break and hard to notice by
 * eye - a path that skips a tile, or an A* that quietly stops being optimal
 * because someone made a tile cheaper than the heuristic assumes.
 *
 * The important checks, in order of what they would catch:
 *
 *   - every generated city is connected and has both markers
 *   - every returned path is contiguous, walkable, and ends where it should
 *   - A* and Dijkstra agree on cost on every map, which is the admissibility
 *     of the heuristic stated as a testable property
 *   - no algorithm ever beats the optimum
 *   - BFS really does minimize tile count
 *   - a sealed goal fails cleanly instead of hanging or returning a broken path
 */
import { generateCity, isSolvable } from './citygen.js';
import { ALGORITHMS, runAll, simulateEnergy } from './algorithms/index.js';
import { TILE, stepCost } from './tiles.js';
import { neighbors } from './grid.js';

let failures = 0;
const check = (name, cond, extra = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${extra}`);
  }
};

// Validate a path is actually walkable and contiguous.
function validate(grid, path) {
  if (path.length === 0) return 'empty';
  if (path[0] !== grid.start) return 'bad start';
  if (path[path.length - 1] !== grid.goal) return 'bad goal';
  const buf = [];
  for (let i = 1; i < path.length; i++) {
    if (grid.tiles[path[i]] === TILE.WALL) return `wall at ${i}`;
    if (!neighbors(grid, path[i - 1], buf).includes(path[i])) return `not adjacent at ${i}`;
  }
  return null;
}

console.log('--- 200 seeded cities ---');
let optimalMismatch = 0;
let expandedAstar = 0;
let expandedDijkstra = 0;

for (let seed = 1; seed <= 200; seed++) {
  const grid = generateCity({ seed, width: 25, height: 25 });
  check(`seed ${seed} solvable`, isSolvable(grid));
  check(`seed ${seed} has markers`, grid.start >= 0 && grid.goal >= 0);
  check(`seed ${seed} start!=goal`, grid.start !== grid.goal);

  const results = runAll(grid);
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));

  for (const r of results) {
    check(`seed ${seed} ${r.id} found`, r.found, `expanded=${r.expanded}`);
    const bad = validate(grid, r.path);
    check(`seed ${seed} ${r.id} path valid`, bad === null, bad || '');
    check(`seed ${seed} ${r.id} has steps`, r.steps.length > 0);
    // Trace must end on the goal.
    check(`seed ${seed} ${r.id} trace ends at goal`, r.steps[r.steps.length - 1].cell === grid.goal);
  }

  // The two optimal algorithms must agree on cost, exactly.
  if (byId.astar.cost !== byId.dijkstra.cost) optimalMismatch++;
  // Non-optimal ones can never beat the optimum.
  check(`seed ${seed} bfs >= optimal`, byId.bfs.cost >= byId.astar.cost);
  check(`seed ${seed} dfs >= optimal`, byId.dfs.cost >= byId.astar.cost);
  check(`seed ${seed} greedy >= optimal`, byId.greedy.cost >= byId.astar.cost);
  // BFS minimizes tile count.
  check(`seed ${seed} bfs shortest in tiles`, byId.bfs.path.length <= byId.astar.path.length);

  expandedAstar += byId.astar.expanded;
  expandedDijkstra += byId.dijkstra.expanded;
}

check('A* and Dijkstra always agree on cost', optimalMismatch === 0, `${optimalMismatch} mismatches`);
console.log(`  A* expanded ${expandedAstar}, Dijkstra expanded ${expandedDijkstra} (A* should be lower)`);
check('A* explores less than Dijkstra', expandedAstar < expandedDijkstra);

console.log('--- unsolvable map ---');
{
  const grid = generateCity({ seed: 7 });
  // Wall the goal in completely.
  const buf = [];
  for (const n of neighbors(grid, grid.goal, buf).slice()) grid.tiles[n] = TILE.WALL;
  check('walled goal is unsolvable', !isSolvable(grid));
  for (const a of ALGORITHMS) {
    const r = a.run(grid);
    check(`${a.id} reports not found`, !r.found);
    check(`${a.id} returns empty path`, r.path.length === 0);
  }
}

console.log('--- energy simulation ---');
{
  const grid = generateCity({ seed: 42 });
  const r = ALGORITHMS[0].run(grid);
  const sim = simulateEnergy(grid, r.path, 10, 10);
  check('energy levels align with path', sim.levels.length <= r.path.length);
  check('energy never exceeds max', sim.levels.every((l) => l <= 10));
  check('first level is start energy', sim.levels[0] === 10);
  const drained = simulateEnergy(grid, r.path, 1, 1);
  check('low energy either stalls or survives coherently',
    drained.survived === (drained.stalledAt === -1));
}

console.log('--- cost model ---');
check('wall impassable', stepCost(TILE.WALL) === Infinity);
check('min cost is 1', Math.min(stepCost(TILE.FLOOR), stepCost(TILE.COIN), stepCost(TILE.START)) === 1);

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
