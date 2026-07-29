import PropTypes from 'prop-types';
import { ALGORITHM_BY_ID } from '../core/algorithms/index.js';
import { PHASE } from '../core/playback.js';
import Hearts from './Hearts.jsx';

/**
 * The status bar.
 *
 * Deliberately sparse - algorithm, two counters, the energy bar and a frame
 * rate. The spec asks for minimal information that stays readable, so anything
 * that would only matter to someone debugging the search stays out.
 *
 * @see instruction.md - "HUD Layout"
 *
 * @component
 */
const Hud = ({ algorithm, stats, seedCode }) => {
  const entry = ALGORITHM_BY_ID[algorithm];
  const status = describe(stats);

  return (
    <div className="panel hud">
      <span className="hud__stat">
        ALGORITHM: <b>{entry?.label ?? '-'}</b>
      </span>
      <span className="hud__stat">
        STEPS: <b>{stats.steps ?? 0}</b>
      </span>
      <span className="hud__stat">
        VISITED: <b>{stats.visited ?? 0}</b>
      </span>
      <span className="hud__stat">
        COST: <b>{stats.found ? stats.cost : '-'}</b>
      </span>

      {stats.maxEnergy > 0 && <Hearts value={stats.energy ?? 0} max={stats.maxEnergy} />}

      {status && <span className={`hud__flag ${status.bad ? 'hud__flag--bad' : ''}`}>{status.text}</span>}

      <span className="hud__spacer" />

      <span className="hud__stat">
        SEED: <b>{seedCode}</b>
      </span>
      <span className="hud__stat">
        FPS: <b>{stats.fps ?? 0}</b>
      </span>
    </div>
  );
};

/**
 * Turns the playback state into the one short message worth showing.
 *
 * Order matters here: a search that found nothing is more important than an
 * energy warning about a path that does not exist.
 *
 * @returns {{text: string, bad: boolean}|null}
 */
function describe(stats) {
  if (!stats.phase) return null;
  if (stats.phase === PHASE.SEARCH) return { text: 'SEARCHING', bad: false };
  if (!stats.found) return { text: 'NO PATH', bad: true };
  if (stats.phase !== PHASE.DONE) return { text: 'PATH FOUND', bad: false };
  if (stats.stalled) return { text: 'OUT OF ENERGY', bad: true };
  return { text: `ARRIVED - ${stats.pathLength} TILES`, bad: false };
}

Hud.propTypes = {
  algorithm: PropTypes.string.isRequired,
  stats: PropTypes.object.isRequired,
  seedCode: PropTypes.string.isRequired,
};

export default Hud;
