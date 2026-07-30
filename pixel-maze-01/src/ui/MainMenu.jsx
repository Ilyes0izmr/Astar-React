import PropTypes from 'prop-types';
import { ALGORITHMS, ALGORITHM_BY_ID } from '../core/algorithms/index.js';
import Icon from './Icon.jsx';

/**
 * The title screen.
 *
 * One full-screen menu: pick an algorithm, optionally type a seed code, and
 * generate a city. The selected card takes a dark border, a darker fill and
 * lifts two pixels; hovering any card lifts it the same amount.
 *
 * @see instruction.md - "Main Menu"
 *
 * @component
 */
const MainMenu = ({ algorithm, onAlgorithm, seedText, onSeedText, onGenerate }) => {
  const selected = ALGORITHM_BY_ID[algorithm];

  return (
    <div className="menu">
      <div>
        <h1 className="menu__title">RETRO CITY PATHFINDER</h1>
        <p className="menu__subtitle">A MINIATURE DUNGEON CITY, FIVE WAYS TO CROSS IT</p>
      </div>

      <div className="menu__cards">
        {ALGORITHMS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`card--algo ${entry.id === algorithm ? 'card--on' : ''}`}
            onClick={() => onAlgorithm(entry.id)}
            aria-pressed={entry.id === algorithm}
          >
            <span className="card__label">{entry.label}</span>
            <span className="card__tagline">{entry.tagline}</span>
          </button>
        ))}
      </div>

      {/* Reserved height, so selecting a card does not shuffle the layout. */}
      <p className="menu__detail">{selected?.detail}</p>

      <div className="menu__actions">
        <label className="menu__seed">
          SEED
          <input
            className="input"
            value={seedText}
            maxLength={5}
            placeholder="RANDOM"
            onChange={(event) => onSeedText(event.target.value)}
          />
        </label>

        <button type="button" className="btn btn--primary" onClick={onGenerate}>
          <Icon name="city" />
          GENERATE CITY
        </button>
      </div>

      <p className="menu__subtitle">
        LEAVE THE SEED BLANK FOR A NEW CITY - OR TYPE ONE TO REPLAY IT EXACTLY
      </p>
    </div>
  );
};

MainMenu.propTypes = {
  algorithm: PropTypes.string.isRequired,
  onAlgorithm: PropTypes.func.isRequired,
  seedText: PropTypes.string.isRequired,
  onSeedText: PropTypes.func.isRequired,
  onGenerate: PropTypes.func.isRequired,
};

export default MainMenu;
