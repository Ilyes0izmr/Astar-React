import PropTypes from 'prop-types';
import { WEATHER, weatherAt } from '../core/weather.js';
import Icon from './Icon.jsx';

/**
 * The weather control.
 *
 * Built exactly like {@link ./DayScrubber.jsx} and for the same reason: the five
 * modes are discrete states, not points on a continuum, so a slider that could
 * come to rest between two of them would be asking for a half-rainbow over
 * half-snow. An integer range with a step of one is what rules that out.
 *
 * The two end icons say which way the slider runs - a clear sky at one end, a
 * CRT at the other - so the row needs no heading of its own.
 *
 * @see ../core/weather.js - the modes themselves
 * @see ../render/weather.js - what each one draws
 *
 * @component
 * @param {Object} props
 * @param {number} props.index - selected mode, 0..4
 * @param {(index: number) => void} props.onIndex
 */
const WeatherScrubber = ({ index, onIndex }) => {
  const current = Math.max(0, Math.min(WEATHER.length - 1, Math.round(index)));
  const mode = weatherAt(current);

  return (
    <div className="weatherscrubber">
      <div className="weatherscrubber__track">
        <Icon name="cloud" />
        <input
          className="slider slider--weather"
          type="range"
          min={0}
          max={WEATHER.length - 1}
          step={1}
          value={current}
          onChange={(event) => onIndex(Math.round(Number(event.target.value)))}
          aria-label="Weather"
          aria-valuetext={mode.label}
        />
        <Icon name="crt" />
      </div>

      <div className="weatherscrubber__ticks" aria-hidden="true">
        {WEATHER.map((entry, i) => (
          <span
            key={entry.id}
            className={`weatherscrubber__tick ${
              i === current ? 'weatherscrubber__tick--on' : ''
            }`}
          >
            {entry.label}
          </span>
        ))}
      </div>

      <div className="weatherscrubber__label">{mode.label}</div>
    </div>
  );
};

WeatherScrubber.propTypes = {
  index: PropTypes.number.isRequired,
  onIndex: PropTypes.func.isRequired,
};

export default WeatherScrubber;
