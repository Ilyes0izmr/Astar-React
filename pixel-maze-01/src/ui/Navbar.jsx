import PropTypes from 'prop-types';
import Icon from './Icon.jsx';

/**
 * Where the contact buttons point.
 *
 * TODO: swap the `#` placeholders for the real profile URLs. They are gathered
 * into this one list so that is a single edit in a single file, rather than
 * three hrefs buried in the markup.
 */
const CONTACT = [
  { id: 'github', name: 'GITHUB', icon: 'github', href: '#' },
  { id: 'linkedin', name: 'LINKEDIN', icon: 'linkedin', href: '#' },
  { id: 'portfolio', name: 'PORTFOLIO', icon: 'person', href: '#' },
];

/**
 * The toolbar strip across the top of the card.
 *
 * Reading left to right: the run, then the speed it runs at, then how the map is
 * viewed, then the things that leave with you - each group separated by a rule
 * so the bar reads as four short bars rather than one long one. The frame rate
 * sits hard right in its own box: it is the only number here nobody acts on, and
 * mixing it in with the controls makes both harder to find.
 *
 * There is no GENERATE here any more. It lives beside the seed and the size in
 * the sidebar, which is where the decisions that feed it already are - having it
 * in both places meant two buttons that looked different and did the same thing.
 *
 * @see instruction.md - "HUD Layout", "Buttons"
 *
 * @component
 * @param {Object} props
 * @param {() => void} props.onSolve
 * @param {() => void} props.onTogglePlay
 * @param {() => void} props.onReset
 * @param {boolean} props.playing
 * @param {boolean} props.canSolve - both markers are on the map
 * @param {boolean} props.hasResult - a run exists to replay
 * @param {number} props.speedIndex
 * @param {(index: number) => void} props.onSpeedIndex
 * @param {number[]} props.speeds - the slider stops, in steps per second
 * @param {boolean} props.fog
 * @param {(on: boolean) => void} props.onFog
 * @param {boolean} props.grab - the pointer drags the map instead of painting
 * @param {(on: boolean) => void} props.onGrab
 * @param {() => void} props.onCompare
 * @param {() => void} props.onDownload
 * @param {boolean} props.flipped - the board is showing its back face
 * @param {() => void} props.onToggleFlip
 * @param {() => void} props.onMenu
 * @param {number} [props.fps]
 */
const Navbar = ({
  onSolve,
  onTogglePlay,
  onReset,
  playing,
  canSolve,
  hasResult,
  speedIndex,
  onSpeedIndex,
  speeds,
  fog,
  onFog,
  grab,
  onGrab,
  onCompare,
  onDownload,
  flipped,
  onToggleFlip,
  colored,
  onToggleColor,
  onMenu,
}) => (
  <div className="navbar">
    <div className="navbar__group">
      {/* Solve, pause and reset are the same size and shape on purpose: they are
          one transport cluster, and making the primary one larger split it into
          a button and two afterthoughts. Colour carries the emphasis instead. */}
      <button
        type="button"
        className="btn btn--primary"
        onClick={onSolve}
        disabled={!canSolve}
        data-tip={canSolve ? 'Run the search' : 'Place a start and a goal first'}
      >
        <Icon name="play" />
        SOLVE
      </button>

      <button
        type="button"
        className="btn"
        onClick={onTogglePlay}
        disabled={!hasResult}
        data-tip={playing ? 'Pause the replay' : 'Resume the replay'}
      >
        <Icon name={playing ? 'pause' : 'play'} />
        {playing ? 'PAUSE' : 'PLAY'}
      </button>

      <button
        type="button"
        className="btn"
        onClick={onReset}
        disabled={!hasResult}
        data-tip="Rewind to the first step"
      >
        <Icon name="reset" />
        RESET
      </button>
    </div>

    <span className="navbar__div" />

    <div className="navbar__group">
      <span className="navbar__label">
        <Icon name="speed" size={14} />
        SPEED
      </span>
      <input
        className="slider"
        type="range"
        min={0}
        max={speeds.length - 1}
        step={1}
        value={speedIndex}
        onChange={(event) => onSpeedIndex(Number(event.target.value))}
        aria-label="Search speed"
        aria-valuetext={`${speeds[speedIndex]} steps per second`}
      />
      <span className="navbar__value">{speeds[speedIndex]}/S</span>
    </div>

    <span className="navbar__div" />

    <div className="navbar__group">
      <button
        type="button"
        className={`btn btn--round ${grab ? 'btn--on' : ''}`}
        onClick={() => onGrab(!grab)}
        aria-pressed={grab}
        data-tip="Grab and drag the map"
      >
        <Icon name="grab" />
      </button>

      <button
        type="button"
        className={`btn btn--round ${fog ? 'btn--on' : ''}`}
        onClick={() => onFog(!fog)}
        aria-pressed={fog}
        data-tip="Fog of war on the minimap"
      >
        <Icon name={fog ? 'fogOff' : 'fog'} />
      </button>

      <button
        type="button"
        className={`btn btn--round ${colored ? 'btn--on' : ''}`}
        onClick={onToggleColor}
        aria-pressed={colored}
        data-tip={colored ? 'Switch to Retro mode' : 'Switch to Color mode'}
      >
        <Icon name={colored ? 'rainbow' : 'crt'} />
      </button>

      <button
        type="button"
        className="btn btn--round"
        onClick={onCompare}
        disabled={!canSolve}
        data-tip="Run all five algorithms on this city"
      >
        <Icon name="compare" />
      </button>
    </div>

    <span className="navbar__div" />

    <div className="navbar__group">
      <button type="button" className="btn" onClick={onDownload} data-tip="Save a PNG of the board">
        <Icon name="download" />
        SAVE
      </button>

      <button
        type="button"
        className={`btn ${flipped ? 'btn--on' : ''}`}
        onClick={onToggleFlip}
        aria-pressed={flipped}
        data-tip="Turn the board over for the run sheet"
      >
        <Icon name="flip" />
        {/* The label names what the press will show, not what is on screen. */}
        {flipped ? 'BOARD' : 'FLIP'}
      </button>
    </div>

    <span className="navbar__div" />

    <div className="navbar__group">
      {CONTACT.map((link) => (
        <a
          key={link.id}
          className="btn btn--round"
          href={link.href}
          target="_blank"
          rel="noreferrer"
          data-tip={link.name}
        >
          <Icon name={link.icon} />
        </a>
      ))}
    </div>

    <span className="navbar__spacer" />

    <button type="button" className="btn btn--cut" onClick={onMenu} data-tip="Back to the menu">
      <Icon name="menu" />
      MENU
    </button>
  </div>
);

Navbar.propTypes = {
  onSolve: PropTypes.func.isRequired,
  onTogglePlay: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  playing: PropTypes.bool.isRequired,
  canSolve: PropTypes.bool.isRequired,
  hasResult: PropTypes.bool.isRequired,
  speedIndex: PropTypes.number.isRequired,
  onSpeedIndex: PropTypes.func.isRequired,
  speeds: PropTypes.arrayOf(PropTypes.number).isRequired,
  fog: PropTypes.bool.isRequired,
  onFog: PropTypes.func.isRequired,
  grab: PropTypes.bool.isRequired,
  onGrab: PropTypes.func.isRequired,
  onCompare: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
  flipped: PropTypes.bool.isRequired,
  onToggleFlip: PropTypes.func.isRequired,
  colored: PropTypes.bool.isRequired,
  onToggleColor: PropTypes.func.isRequired,
  onMenu: PropTypes.func.isRequired,
};

export default Navbar;
