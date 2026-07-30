import PropTypes from 'prop-types';
import Icon from './Icon.jsx';

/**
 * The energy bar.
 *
 * Draws exactly `max` hearts every time and fills the first `value` of them.
 * The original version rebuilt the row from whatever the current energy happened
 * to be, so the bar changed *length* as it drained and vanished entirely at
 * zero - which is why it looked broken. A fixed-length row that only changes
 * fill is both correct and easier to read at a glance.
 *
 * @component
 * @param {Object} props
 * @param {number} props.value - hearts remaining
 * @param {number} props.max - total capacity
 */
const Hearts = ({ value, max }) => {
  const filled = Math.max(0, Math.min(max, Math.round(value)));

  return (
    <div className="hearts" role="img" aria-label={`Energy ${filled} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <Icon key={i} name="heart" size={15} filled={i < filled} />
      ))}
    </div>
  );
};

Hearts.propTypes = {
  value: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
};

export default Hearts;
