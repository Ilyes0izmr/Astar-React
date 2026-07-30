import PropTypes from 'prop-types';
import { TILE } from '../core/tiles.js';
import { MAP_SIZES } from '../core/citygen.js';
import Icon from './Icon.jsx';
import Hearts from './Hearts.jsx';
import DayScrubber from './DayScrubber.jsx';
import WeatherScrubber from './WeatherScrubber.jsx';
import { runOutcome } from './download.js';

/**
 * The brushes, in the order they tile.
 *
 * Twelve now rather than seven: the landscape is editable too, so a river can
 * be dug, a headland raised, or a jetty run out into the bay. They are laid out
 * three to a row as equal squares - a stack of full-width rows worked when there
 * were seven, but at twelve it ran off the bottom of every screen.
 *
 * The labels are shortened deliberately. At a third of the column each cell has
 * room for one word, and "MOUNTAIN" wrapping to two lines would break the grid.
 */
const BRUSHES = [
  { tile: TILE.FLOOR, icon: 'road', label: 'ROAD' },
  { tile: TILE.WALL, icon: 'wall', label: 'WALL' },
  { tile: TILE.COIN, icon: 'coin', label: 'COIN' },
  { tile: TILE.RUBBLE, icon: 'rubble', label: 'RUBBLE' },
  { tile: TILE.SPIKE, icon: 'spike', label: 'SPIKE' },
  { tile: TILE.WATER, icon: 'water', label: 'WATER' },
  { tile: TILE.SAND, icon: 'sand', label: 'SAND' },
  { tile: TILE.MOUNTAIN, icon: 'mountain', label: 'PEAK' },
  { tile: TILE.BRIDGE, icon: 'bridge', label: 'BRIDGE' },
  { tile: TILE.PIER, icon: 'pier', label: 'PIER' },
  { tile: TILE.START, icon: 'start', label: 'START' },
  { tile: TILE.GOAL, icon: 'goal', label: 'GOAL' },
];

/**
 * The options column beside the board.
 *
 * Stacked sections, each one a complete answer to a question about the city:
 * what am I painting, how big is it, which city is this, what hour is it, what
 * is the sky doing, how is the run going.
 *
 * @see instruction.md - "UI Principles", "Buttons"
 *
 * @component
 * @param {Object} props
 * @param {number|null} props.brush - the tile the pointer paints, null when off
 * @param {(tile: number|null) => void} props.onBrush
 * @param {string} props.seedText - contents of the seed field
 * @param {(text: string) => void} props.onSeedText
 * @param {() => void} props.onGenerate
 * @param {string} props.seedCode - the code of the city on screen
 * @param {number} props.sizeIndex - selected entry of MAP_SIZES
 * @param {(index: number) => void} props.onSizeIndex
 * @param {number} props.stageIndex - selected time of day
 * @param {(index: number) => void} props.onStageIndex
 * @param {number} props.weatherIndex - selected weather mode
 * @param {(index: number) => void} props.onWeatherIndex
 * @param {number} [props.energy] - hearts remaining
 * @param {number} [props.maxEnergy] - heart capacity
 * @param {Object} props.stats - playback stats
 */
const Sidebar = ({
  brush,
  onBrush,
  seedText,
  onSeedText,
  onGenerate,
  seedCode,
  sizeIndex,
  onSizeIndex,
  stageIndex,
  onStageIndex,
  weatherIndex,
  onWeatherIndex,
  energy = 0,
  maxEnergy = 0,
  stats,
}) => {
  const outcome = runOutcome(stats);
  const size = MAP_SIZES[sizeIndex] ?? MAP_SIZES[0];

  return (
    <aside className="sidebar">
      <section className="sidebar__section">
        <h2 className="sidebar__title">TERRAIN</h2>
        <div className="sidebar__grid">
          {BRUSHES.map(({ tile, icon, label }) => (
            <button
              key={tile}
              type="button"
              className={`brush ${brush === tile ? 'brush--on' : ''}`}
              // Clicking the active brush turns the editor off, so the pointer
              // stops painting the moment you are done with it.
              onClick={() => onBrush(brush === tile ? null : tile)}
              aria-pressed={brush === tile}
              data-tip={`Paint ${label.toLowerCase()}`}
            >
              <Icon name={icon} size={16} />
              <span className="brush__label">{label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="sidebar__section">
        <h2 className="sidebar__title">SIZE</h2>
        <div className="size-presets">
          {MAP_SIZES.map((entry, i) => (
            <button
              key={entry.id}
              type="button"
              className={`size-preset ${sizeIndex === i ? 'size-preset--on' : ''}`}
              onClick={() => onSizeIndex(i)}
              data-tip={`${entry.width} × ${entry.height}`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </section>

      <section className="sidebar__section">
        <h2 className="sidebar__title">WORLD</h2>
        <div className="sidebar__stack">
          <input
            className="input input--wide"
            value={seedText}
            maxLength={5}
            placeholder="RANDOM"
            // Stored uppercase so the field reads back exactly as the code it
            // will be parsed as, rather than relying on the CSS to fake it.
            onChange={(event) => onSeedText(event.target.value.toUpperCase())}
            // The global Enter shortcut skips text fields, which would otherwise
            // leave the most obvious key in this box doing nothing.
            onKeyDown={(event) => {
              if (event.key === 'Enter') onGenerate();
            }}
            aria-label="City seed"
          />

          <button
            type="button"
            className="btn btn--primary btn--wide"
            onClick={onGenerate}
            data-tip="Build a new city at this size"
          >
            {/* An empty box means a random city, and the die says so before the
                button is pressed rather than after. */}
            <Icon name={seedText.trim() ? 'city' : 'dice'} />
            GENERATE
          </button>

          <p className="sidebar__seed">
            SEED <b>{seedCode}</b>
          </p>
        </div>
      </section>

      <section className="sidebar__section">
        <h2 className="sidebar__title">TIME</h2>
        <DayScrubber index={stageIndex} onIndex={onStageIndex} />
      </section>

      <section className="sidebar__section">
        <h2 className="sidebar__title">WEATHER</h2>
        <WeatherScrubber index={weatherIndex} onIndex={onWeatherIndex} />
      </section>

      <section className="sidebar__section">
        <h2 className="sidebar__title">STATUS</h2>
        <div className="sidebar__stack">
          {maxEnergy > 0 && <Hearts value={energy} max={maxEnergy} />}
          <span className={`sidebar__flag ${outcome?.bad ? 'sidebar__flag--bad' : ''}`}>
            {outcome ? outcome.text : 'READY'}
          </span>
        </div>
      </section>
    </aside>
  );
};

Sidebar.propTypes = {
  brush: PropTypes.number,
  onBrush: PropTypes.func.isRequired,
  seedText: PropTypes.string.isRequired,
  onSeedText: PropTypes.func.isRequired,
  onGenerate: PropTypes.func.isRequired,
  seedCode: PropTypes.string.isRequired,
  sizeIndex: PropTypes.number.isRequired,
  onSizeIndex: PropTypes.func.isRequired,
  stageIndex: PropTypes.number.isRequired,
  onStageIndex: PropTypes.func.isRequired,
  weatherIndex: PropTypes.number.isRequired,
  onWeatherIndex: PropTypes.func.isRequired,
  energy: PropTypes.number,
  maxEnergy: PropTypes.number,
  stats: PropTypes.object.isRequired,
};

export default Sidebar;
