import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { runAll } from '../core/algorithms/index.js';

/**
 * Runs all five algorithms on the current city and tabulates the outcome.
 *
 * This is the payoff for having them share a result shape: the differences
 * people usually have to take on faith - that A* and Dijkstra return the same
 * cost while A* touches a fraction of the map, that greedy is quick and
 * expensive, that DFS is neither - are all right there as numbers on one map.
 *
 * @component
 */
const Compare = ({ grid, gridVersion, onClose }) => {
  // The searches are fast, but this still recomputes only when the map changes.
  // Tiles mutate in place, so the version counter is the dependency that
  // actually moves - `grid` alone would keep its identity through an edit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => runAll(grid), [grid, gridVersion]);

  const bestCost = Math.min(...rows.filter((r) => r.found).map((r) => r.cost));
  const leastVisited = Math.min(...rows.filter((r) => r.found).map((r) => r.expanded));

  return (
    <div className="compare">
      <div className="compare__inner panel">
        <div className="panel__title">ALL ALGORITHMS, ONE CITY</div>

        <table className="table">
          <thead>
            <tr>
              <th>ALGO</th>
              <th>COST</th>
              <th>TILES</th>
              <th>EXPANDED</th>
              <th>RESULT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-best={row.found && row.cost === bestCost ? '1' : '0'}>
                <td>{row.label}</td>
                <td>{row.found ? row.cost : '-'}</td>
                <td>{row.found ? row.path.length : '-'}</td>
                <td data-dim={row.expanded === leastVisited ? '0' : '1'}>{row.expanded}</td>
                <td>{verdict(row, bestCost, leastVisited)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="menu__detail">
          COST IS THE SUM OF TERRAIN WEIGHTS. EXPANDED IS HOW MANY TILES THE SEARCH SETTLED -
          LOWER MEANS LESS WORK FOR THE SAME ANSWER.
        </p>

        <button type="button" className="btn btn--wide" onClick={onClose}>
          CLOSE
        </button>
      </div>
    </div>
  );
};

/** A one-word summary of how a run went, relative to the best on this map. */
function verdict(row, bestCost, leastVisited) {
  if (!row.found) return 'FAILED';
  if (row.cost === bestCost && row.expanded === leastVisited) return 'BEST';
  if (row.cost === bestCost) return 'OPTIMAL';
  const over = Math.round(((row.cost - bestCost) / bestCost) * 100);
  return `+${over}% COST`;
}

Compare.propTypes = {
  grid: PropTypes.object.isRequired,
  gridVersion: PropTypes.number.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default Compare;
