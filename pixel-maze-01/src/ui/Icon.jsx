import PropTypes from 'prop-types';
import {
  Anchor,
  BarChart3,
  Boxes,
  Briefcase,
  Building2,
  Cloud,
  CloudRain,
  Code2,
  Coins,
  Construction,
  Dices,
  Download,
  Eye,
  EyeOff,
  Flag,
  FlipHorizontal2,
  Gauge,
  Grip,
  Hand,
  Heart,
  LogOut,
  Maximize2,
  Minimize2,
  Monitor,
  Moon,
  Mountain,
  Pause,
  Play,
  Rainbow,
  RotateCcw,
  Route,
  Ruler,
  Sailboat,
  Snowflake,
  Sun,
  Target,
  Trees,
  Triangle,
  User,
  Waves,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

/**
 * The interface icon set.
 *
 * Line icons rather than the hand-drawn pixel glyphs this file replaced. The
 * chrome is set in a bold grotesque with a heavy stroke now, and pixel glyphs
 * sat badly against it - they belong to the map, not to the panels around it.
 * Lucide's weight matches the button borders, and every glyph inherits
 * `currentColor`, so an icon recolours with its button and with the hour for
 * free.
 *
 * Names here are *semantic*, not visual: callers ask for `fog` or `goal`, never
 * for `Eye` or `Target`. Swapping the underlying glyph is then one edit here
 * rather than a hunt through the components.
 */
const GLYPHS = {
  // Transport and run control.
  play: Play,
  pause: Pause,
  reset: RotateCcw,
  compare: BarChart3,
  speed: Gauge,

  // World and view.
  city: Building2,
  dice: Dices,
  size: Ruler,
  fog: Eye,
  fogOff: EyeOff,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
  expand: Maximize2,
  shrink: Minimize2,
  grab: Hand,

  // Output and navigation.
  download: Download,
  flip: FlipHorizontal2,
  menu: LogOut,
  github: Code2,
  linkedin: Briefcase,
  person: User,

  // Time of day.
  sun: Sun,
  moon: Moon,

  // Weather modes, in slider order.
  cloud: Cloud,
  rain: CloudRain,
  snow: Snowflake,
  rainbow: Rainbow,
  crt: Monitor,

  // Terrain brushes.
  road: Route,
  wall: Building2,
  coin: Coins,
  rubble: Boxes,
  spike: Triangle,
  start: Flag,
  goal: Target,
  water: Waves,
  sand: Grip,
  mountain: Mountain,
  bridge: Construction,
  pier: Anchor,
  park: Trees,

  // Status.
  heart: Heart,
  ship: Sailboat,
};

/** @type {string[]} every registered icon name. */
export const ICON_NAMES = Object.keys(GLYPHS);

/**
 * Renders one icon.
 *
 * @component
 * @param {Object} props
 * @param {string} props.name - a key of the glyph table
 * @param {number} [props.size=18]
 * @param {boolean} [props.filled] - fill the glyph with the current colour,
 *   which is how a full heart differs from an empty one
 * @param {string} [props.className]
 */
const Icon = ({ name, size = 18, filled = false, className = '' }) => {
  const Glyph = GLYPHS[name];
  if (!Glyph) return null;

  return (
    <Glyph
      size={size}
      // Heavier than the default, to sit alongside the 3px panel strokes
      // without looking spindly.
      strokeWidth={2.5}
      fill={filled ? 'currentColor' : 'none'}
      className={className}
      aria-hidden="true"
      focusable="false"
    />
  );
};

Icon.propTypes = {
  name: PropTypes.oneOf(ICON_NAMES).isRequired,
  size: PropTypes.number,
  filled: PropTypes.bool,
  className: PropTypes.string,
};

export default Icon;
