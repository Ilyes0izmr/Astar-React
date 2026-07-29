import PropTypes from 'prop-types';
import PixelIcon from './PixelIcon.jsx';

/**
 * Where the contact buttons point.
 *
 * TODO: swap the `#` placeholders for the real profile URLs. They are gathered
 * into this one list so that is a single edit in a single file, rather than
 * three hrefs buried in the markup.
 *
 * The glyphs come from the shared 16x16 set and are hand-drawn silhouettes, not
 * the official marks - at this resolution nothing else would survive anyway.
 * Each link carries its name in the title and the accessible label, so the icon
 * never has to do the identifying on its own.
 */
const CONTACT = [
  { id: 'github', name: 'GITHUB', icon: 'github', href: '#' },
  { id: 'linkedin', name: 'LINKEDIN', icon: 'linkedin', href: '#' },
  { id: 'portfolio', name: 'PORTFOLIO', icon: 'person', href: '#' },
];

/**
 * The toolbar strip across the top of the card.
 *
 * Reading left to right it is the run, then the speed it runs at, then the
 * things that change the map, then the things that leave with you - each group
 * separated by a rule so the bar reads as four short bars rather than one long
 * one. The frame rate sits hard right in its own box: it is the only number
 * here that nobody acts on, and mixing it in with the controls makes both
 * harder to find.
 *
 * Button shapes carry meaning. The one primary action is a filled pill, the
 * transport controls that repeat are round, and everything destructive or
 * modal is a cut rectangle.
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
 * @param {() => void} props.onGenerate
 * @param {boolean} props.fog
 * @param {(on: boolean) => void} props.onFog
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
  onGenerate,
  fog,
  onFog,
  onCompare,
  onDownload,
  flipped,
  onToggleFlip,
  onMenu,
  fps = 0,
}) => (
  <div className="navbar">
    <div className="navbar__group">
      {/* One control for the whole run. Before a search exists it starts one;
          after that it pauses and resumes it. Splitting "solve" from "play" put
          two buttons on the bar that did the same thing from the player's side
          of the screen, which is what made the group feel redundant. */}
      <button
        type="button"
        className="btn btn--round btn--xl btn--primary"
        onClick={hasResult ? onTogglePlay : onSolve}
        disabled={!canSolve}
        title={!hasResult ? 'START' : playing ? 'PAUSE' : 'RESUME'}
        aria-label={!hasResult ? 'Start' : playing ? 'Pause' : 'Resume'}
      >
        <PixelIcon name={hasResult && playing ? 'pause' : 'play'} scale={2} />
      </button>

      <button
        type="button"
        className="btn btn--round btn--lg"
        onClick={onReset}
        disabled={!hasResult}
        title="STOP AND REWIND"
        aria-label="Stop and rewind"
      >
        <PixelIcon name="stop" />
      </button>
    </div>

    <span className="navbar__div" />

    <div className="navbar__group">
      <span className="navbar__label">SPEED</span>
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
      <button type="button" className="btn" onClick={onGenerate}>
        <PixelIcon name="city" />
        GENERATE
      </button>

      <button
        type="button"
        className={`btn btn--round ${fog ? 'btn--on' : ''}`}
        onClick={() => onFog(!fog)}
        aria-pressed={fog}
        title="FOG OF WAR"
        aria-label="Fog of war"
      >
        <PixelIcon name="compass" />
      </button>

      <button
        type="button"
        className="btn btn--round"
        onClick={onCompare}
        disabled={!canSolve}
        title="COMPARE ALGORITHMS"
        aria-label="Compare algorithms"
      >
        <PixelIcon name="gear" />
      </button>
    </div>

    <span className="navbar__div" />

    <div className="navbar__group">
      <button type="button" className="btn" onClick={onDownload} title="DOWNLOAD A PNG SNAPSHOT">
        <PixelIcon name="download" />
        SAVE
      </button>

      <button
        type="button"
        className={`btn btn--pill ${flipped ? 'btn--on' : ''}`}
        onClick={onToggleFlip}
        aria-pressed={flipped}
        title="TURN THE BOARD OVER"
      >
        <PixelIcon name="flip" />
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
          title={link.name}
          aria-label={link.name}
        >
          <PixelIcon name={link.icon} />
        </a>
      ))}
    </div>

    <span className="navbar__div" />

    <div className="navbar__group navbar__group--end">
      <div className="fps">
        FPS <b>{fps}</b>
      </div>

      <button type="button" className="btn btn--cut" onClick={onMenu}>
        MENU
      </button>
    </div>
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
  onGenerate: PropTypes.func.isRequired,
  fog: PropTypes.bool.isRequired,
  onFog: PropTypes.func.isRequired,
  onCompare: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
  flipped: PropTypes.bool.isRequired,
  onToggleFlip: PropTypes.func.isRequired,
  onMenu: PropTypes.func.isRequired,
  fps: PropTypes.number,
};

export default Navbar;
