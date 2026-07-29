import PropTypes from 'prop-types';
import { TILE, TILE_NAME } from '../core/tiles.js';
import PixelIcon from './PixelIcon.jsx';
import Hearts from './Hearts.jsx';
import DayScrubber from './DayScrubber.jsx';
import { runOutcome } from './download.js';

/**
 * The brushes, in the order they stack.
 *
 * Each carries the icon that draws it, and those icons call the world painters
 * rather than approximating them - so a row is a preview of the actual tile it
 * will paint, and stays one when the artwork changes.
 */
const BRUSHES = [
  { tile: TILE.FLOOR, icon: 'road' },
  { tile: TILE.WALL, icon: 'wall' },
  { tile: TILE.COIN, icon: 'coin' },
  { tile: TILE.RUBBLE, icon: 'rubble' },
  { tile: TILE.SPIKE, icon: 'spike' },
  { tile: TILE.START, icon: 'start' },
  { tile: TILE.GOAL, icon: 'goal' },
];

/**
 * The options column beside the board.
 *
 * Four stacked sections, each one a complete answer to a question about the
 * city: what am I painting, which city is this, what hour is it, how is the run
 * going. Full-width rows rather than a grid of swatches because the label is
 * the fastest way to tell rubble from spikes, and there is a column of room
 * here that the old bottom bar never had.
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
 * @param {number} props.stageIndex - selected time of day
 * @param {(index: number) => void} props.onStageIndex
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
  stageIndex,
  onStageIndex,
  energy = 0,
  maxEnergy = 0,
  stats,
}) => {
  const outcome = runOutcome(stats);

  return (
    <aside className="sidebar">
      <section className="sidebar__section">
        <h2 className="sidebar__title">TERRAIN</h2>
        <div className="sidebar__stack">
          {BRUSHES.map(({ tile, icon }) => (
            <button
              key={tile}
              type="button"
              className={`btn btn--tag ${brush === tile ? 'btn--on' : ''}`}
              // Clicking the active brush turns the editor off, so the pointer
              // stops painting the moment you are done with it.
              onClick={() => onBrush(brush === tile ? null : tile)}
              aria-pressed={brush === tile}
            >
              <PixelIcon name={icon} />
              {TILE_NAME[tile]}
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

          <button type="button" className="btn btn--wide" onClick={onGenerate}>
            {/* An empty box means a random city, and the die says so before the
                button is pressed rather than after. */}
            <PixelIcon name={seedText.trim() ? 'city' : 'dice'} />
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
  stageIndex: PropTypes.number.isRequired,
  onStageIndex: PropTypes.func.isRequired,
  energy: PropTypes.number,
  maxEnergy: PropTypes.number,
  stats: PropTypes.object.isRequired,
};

export default Sidebar;
