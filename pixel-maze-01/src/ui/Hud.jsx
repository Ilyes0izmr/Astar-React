import PropTypes from 'prop-types';
import { runOutcome } from './download.js';

/**
 * The status flag that floats over the board.
 *
 * Everything this panel used to carry - the counters, the energy bar, the frame
 * rate - now lives in the navbar and the sidebar, where it can be read without
 * covering the map. What is left is the single line worth seeing without
 * looking away from the city, plus the seed: the strip sits inside the frame a
 * snapshot captures, so a shared picture always says which city it is.
 *
 * @see instruction.md - "HUD Layout"
 *
 * @component
 * @param {Object} props
 * @param {Object} props.stats - playback stats
 * @param {string} props.seedCode - the five-character city code
 */
const Hud = ({ stats, seedCode }) => {
  const status = runOutcome(stats);

  return (
    <div className="hud">
      {status && (
        <span className={`hud__flag ${status.bad ? 'hud__flag--bad' : ''}`}>{status.text}</span>
      )}
      <span className="hud__seed">{seedCode}</span>
    </div>
  );
};

Hud.propTypes = {
  stats: PropTypes.object.isRequired,
  seedCode: PropTypes.string.isRequired,
};

export default Hud;
