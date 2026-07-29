import PropTypes from 'prop-types';
import { TILE, TILE_NAME } from '../core/tiles.js';
import PixelIcon from './PixelIcon.jsx';

/**
 * The brushes available in the editor, in the order they appear.
 *
 * Each one carries the icon that draws it, so the swatch is a preview of the
 * actual tile rather than a symbol standing in for it.
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

/** Speed slider stops, in search steps per second. */
const SPEEDS = [4, 8, 15, 30, 60, 120, 240, 600];

/**
 * The control bar along the bottom of the game screen.
 *
 * @see instruction.md - "HUD Layout", "Buttons"
 *
 * @component
 */
const Toolbar = ({
  brush,
  onBrush,
  onGenerate,
  onSolve,
  onReset,
  onCompare,
  onMenu,
  playing,
  onTogglePlay,
  speedIndex,
  onSpeedIndex,
  fog,
  onFog,
  canSolve,
  hasResult,
}) => (
  <div className="panel toolbar">
    <div className="toolbar__group">
      <button type="button" className="btn" onClick={onMenu}>
        MENU
      </button>
      <button type="button" className="btn" onClick={onGenerate}>
        <PixelIcon name="city" />
        GENERATE
      </button>
    </div>

    <div className="toolbar__group">
      <span className="toolbar__label">BRUSH</span>
      {BRUSHES.map(({ tile, icon }) => (
        <button
          key={tile}
          type="button"
          className={`swatch ${brush === tile ? 'swatch--on' : ''}`}
          // Clicking the active brush turns the editor off, so the pointer stops
          // painting the moment you are done with it.
          onClick={() => onBrush(brush === tile ? null : tile)}
          title={TILE_NAME[tile]}
          aria-label={TILE_NAME[tile]}
          aria-pressed={brush === tile}
        >
          <PixelIcon name={icon} />
        </button>
      ))}
    </div>

    <div className="toolbar__group">
      <button type="button" className="btn btn--primary" onClick={onSolve} disabled={!canSolve}>
        <PixelIcon name="play" />
        SOLVE
      </button>
      <button type="button" className="btn" onClick={onTogglePlay} disabled={!hasResult}>
        <PixelIcon name={playing ? 'pause' : 'play'} />
        {playing ? 'PAUSE' : 'PLAY'}
      </button>
      <button type="button" className="btn" onClick={onReset} disabled={!hasResult}>
        <PixelIcon name="reset" />
        RESET
      </button>
    </div>

    <div className="toolbar__group">
      <span className="toolbar__label">SPEED</span>
      <input
        className="slider"
        type="range"
        min={0}
        max={SPEEDS.length - 1}
        step={1}
        value={speedIndex}
        onChange={(event) => onSpeedIndex(Number(event.target.value))}
        aria-label="Search speed"
      />
      <span className="toolbar__label">{SPEEDS[speedIndex]}/S</span>
    </div>

    <div className="toolbar__group">
      <button
        type="button"
        className={`btn ${fog ? 'btn--on' : ''}`}
        onClick={() => onFog(!fog)}
        aria-pressed={fog}
      >
        <PixelIcon name="compass" />
        FOG
      </button>
      <button type="button" className="btn" onClick={onCompare} disabled={!canSolve}>
        <PixelIcon name="gear" />
        COMPARE
      </button>
    </div>
  </div>
);

export { SPEEDS };

Toolbar.propTypes = {
  brush: PropTypes.number,
  onBrush: PropTypes.func.isRequired,
  onGenerate: PropTypes.func.isRequired,
  onSolve: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  onCompare: PropTypes.func.isRequired,
  onMenu: PropTypes.func.isRequired,
  playing: PropTypes.bool.isRequired,
  onTogglePlay: PropTypes.func.isRequired,
  speedIndex: PropTypes.number.isRequired,
  onSpeedIndex: PropTypes.func.isRequired,
  fog: PropTypes.bool.isRequired,
  onFog: PropTypes.func.isRequired,
  canSolve: PropTypes.bool.isRequired,
  hasResult: PropTypes.bool.isRequired,
};

export default Toolbar;
