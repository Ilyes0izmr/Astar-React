import PropTypes from 'prop-types';
import { STAGES, stageAt } from '../core/daycycle.js';
import PixelIcon from './PixelIcon.jsx';

/**
 * The time-of-day control.
 *
 * Five stops and nothing between them. Each stage is a complete palette rather
 * than a point on a gradient, so a slider that could come to rest halfway would
 * be asking for colors that exist in neither neighbour - exactly the blend the
 * art direction rules out. An integer range with a step of one is what enforces
 * that; the tick row is there so the five stops are visible before you drag.
 *
 * @see ../core/daycycle.js - the stages themselves
 * @see instruction.md - "Color Palette", "Lighting"
 *
 * @component
 * @param {Object} props
 * @param {number} props.index - selected stage, 0..4
 * @param {(index: number) => void} props.onIndex
 */
const DayScrubber = ({ index, onIndex }) => {
  const current = Math.max(0, Math.min(STAGES.length - 1, Math.round(index)));
  const stage = stageAt(current);

  return (
    <div className="dayscrubber">
      {/* The two ends of the day, so which way the slider runs needs no label. */}
      <div className="dayscrubber__track">
        <PixelIcon name="sun" />
        <input
          className="slider slider--day"
          type="range"
          min={0}
          max={STAGES.length - 1}
          step={1}
          value={current}
          onChange={(event) => onIndex(Math.round(Number(event.target.value)))}
          aria-label="Time of day"
          aria-valuetext={stage.label}
        />
        <PixelIcon name="moon" />
      </div>

      <div className="dayscrubber__ticks" aria-hidden="true">
        {STAGES.map((entry, i) => (
          <span
            key={entry.id}
            className={`dayscrubber__tick ${i === current ? 'dayscrubber__tick--on' : ''}`}
          >
            {entry.label}
          </span>
        ))}
      </div>

      <div className="dayscrubber__label">{stage.label}</div>
    </div>
  );
};

DayScrubber.propTypes = {
  index: PropTypes.number.isRequired,
  onIndex: PropTypes.func.isRequired,
};

export default DayScrubber;
