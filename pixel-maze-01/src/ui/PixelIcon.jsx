import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { TILE_PX } from '../render/art.js';
import { ICONS, ICON_NAMES } from './icons.js';

/**
 * Renders one procedural pixel icon into a 16x16 canvas.
 *
 * @see ./icons.js - the icon definitions themselves
 *
 * @component
 * @param {Object} props
 * @param {string} props.name - a key of {@link ICONS}
 * @param {number} [props.scale=1] - whole-number magnification
 */
const PixelIcon = ({ name, scale = 1 }) => {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, TILE_PX, TILE_PX);
    ICONS[name]?.(ctx);
  }, [name]);

  return (
    <canvas
      ref={ref}
      width={TILE_PX}
      height={TILE_PX}
      style={{ width: TILE_PX * scale, height: TILE_PX * scale }}
      aria-hidden="true"
    />
  );
};

PixelIcon.propTypes = {
  name: PropTypes.oneOf(ICON_NAMES).isRequired,
  scale: PropTypes.number,
};

export default PixelIcon;
