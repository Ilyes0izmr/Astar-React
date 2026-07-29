import PropTypes from 'prop-types';
import { ALGORITHM_BY_ID } from '../core/algorithms/index.js';
import Hearts from './Hearts.jsx';
import { runOutcome } from './download.js';

/** One key/value line of the sheet. */
const Row = ({ label, children }) => (
  <div className="infoback__row">
    <span className="infoback__k">{label}</span>
    <span className="infoback__v">{children}</span>
  </div>
);

Row.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node,
};

/**
 * The back face of the board.
 *
 * Flipping the board over is what lets the front of it stay a map. None of
 * these numbers are new - they are the same run the flag and the sidebar
 * describe - but a stats sheet wants room and a column of aligned values, and
 * taking that room from the city is the trade this avoids.
 *
 * @see instruction.md - "HUD Layout"
 *
 * @component
 * @param {Object} props
 * @param {string} props.algorithm - algorithm id
 * @param {Object} props.stats - playback stats
 * @param {string} props.seedCode - the five-character city code
 * @param {() => void} props.onClose - flips the board back
 */
const InfoBack = ({ algorithm, stats, seedCode, onClose }) => {
  const entry = ALGORITHM_BY_ID[algorithm];
  const outcome = runOutcome(stats);
  const maxEnergy = stats.maxEnergy ?? 0;

  return (
    <div className="infoback">
      <div className="infoback__title">RUN SHEET</div>

      <Row label="ALGORITHM">{entry?.label ?? algorithm}</Row>
      <Row label="OUTCOME">{outcome ? outcome.text : 'NOT SOLVED'}</Row>
      <Row label="STEPS">{stats.steps ?? 0}</Row>
      <Row label="VISITED">{stats.visited ?? 0}</Row>
      <Row label="COST">{stats.found ? stats.cost : '-'}</Row>
      <Row label="PATH">{stats.found ? `${stats.pathLength} TILES` : '-'}</Row>

      {/* The bar is absent rather than empty before a run, because ten hollow
          hearts read as "you have no energy" instead of "nothing has happened
          yet". */}
      {maxEnergy > 0 && (
        <Row label="ENERGY">
          <Hearts value={stats.energy ?? 0} max={maxEnergy} />
        </Row>
      )}

      <Row label="SEED">{seedCode}</Row>

      <button type="button" className="btn btn--wide" onClick={onClose}>
        CLOSE
      </button>
    </div>
  );
};

InfoBack.propTypes = {
  algorithm: PropTypes.string.isRequired,
  stats: PropTypes.object.isRequired,
  seedCode: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default InfoBack;
