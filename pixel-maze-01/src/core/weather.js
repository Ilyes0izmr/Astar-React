/**
 * Two independent knobs that used to be one.
 *
 * {@link WEATHER} is what the sky is doing - rain, snow, wind, fog. It is
 * animation laid over the finished world and it never touches a colour.
 *
 * {@link RENDER_MODES} is what the world is made of - the original monochrome
 * parchment, or a naturally coloured town. It is a palette swap applied before
 * anything is drawn and it never puts a particle in the air.
 *
 * Folding those two into one slider was a mistake: it meant you could not have
 * rain over a coloured city, and "rainbow" ended up sitting in a list next to
 * "snow" as though they were the same kind of thing. Splitting them gives a
 * five-stop weather slider and a two-state switch, and every combination of the
 * two is valid.
 *
 * @see ./daycycle.js - the third knob, which sets the hour
 * @see ../render/weather.js - where the atmospheric modes become pixels
 */

/**
 * @typedef {Object} WeatherMode
 * @property {string} id
 * @property {string} label - shown on the weather slider
 * @property {number} intensity - 0..1, scales the particle count
 * @property {number} wind - -1..1 horizontal drift for anything airborne
 */

/** @type {WeatherMode[]} ordered as the slider runs them, calm to loud. */
export const WEATHER = [
  { id: 'clear', label: 'CLEAR', intensity: 0, wind: 0 },
  // The fraction is low because each drop is a long streak - at snow's count the
  // screen would be solid water.
  { id: 'rain', label: 'RAIN', intensity: 0.42, wind: -0.6 },
  // Snow takes the whole pool. A flake is one pixel where a drop is a streak, so
  // it needs several times the count before it reads as weather and not dust.
  { id: 'snow', label: 'SNOW', intensity: 1, wind: 0.18 },
  // Nothing falls; the pool carries drifting motes and streaking gusts instead.
  { id: 'wind', label: 'WIND', intensity: 0.55, wind: -1 },
  { id: 'fog', label: 'FOG', intensity: 0.7, wind: -0.15 },
];

/** @type {Record<string, WeatherMode>} */
export const WEATHER_BY_ID = Object.fromEntries(WEATHER.map((m) => [m.id, m]));

/** The mode the app opens on: a clear sky, so the city shows through untouched. */
export const DEFAULT_WEATHER_INDEX = 0;

/**
 * Clamps a slider position to a real mode.
 *
 * @param {number} index
 * @returns {WeatherMode}
 */
export function weatherAt(index) {
  return WEATHER[Math.max(0, Math.min(WEATHER.length - 1, Math.round(index)))];
}

/**
 * The naturally coloured world.
 *
 * Surfaces whose real colour has nothing to do with a greyscale ramp get named
 * entries in `terrain`. Water is not a darker road and foliage is not a lighter
 * roof, so forcing those through the light/mid/dark ladder could only ever
 * produce a tinted version of the monochrome map.
 *
 * The greens are deliberately muted. An earlier pass ran them at full
 * saturation and the parks read as billiard baize next to the muted roofs -
 * retro palettes get their depth from restraint, not from chroma.
 */
const NATURAL_PALETTE = {
  bg: '#F7F3E8',
  light: '#C7C0B2',
  mid: '#9AA0A6',
  dark: '#4E5A63',
  black: '#232A30',
  backdrop: '#CFE0DC',
  glow: '#FFE9A8',
  terrain: {
    water: '#4A8D99',
    foam: '#C6E3E0',
    sand: '#E2D0A8',
    mountain: '#7B8672',
    snow: '#F0F3EE',
    road: '#C6C0B3',
    mark: '#F7F3E8',
    // Vegetation. Every green in the world comes from these three, which is what
    // keeps the forest, the parks and the harbour planting reading as one
    // material rather than three unrelated greens.
    park: '#6E8F5E',
    parkDark: '#42603F',
    parkLit: '#93AF77',
  },
};

/**
 * Roof colours, picked per building from its own seed.
 *
 * Pointedly no green. Green is the world's vegetation colour - trees, parks, the
 * forest under the range - and a green roof in the middle of a block reads as a
 * patch of woodland that has landed on a street. Reserving the hue for one
 * meaning is what lets a glance separate built from grown.
 */
const NATURAL_HUES = [
  '#C4553F',
  '#4E7BA8',
  '#D08A3E',
  '#8A5A7A', // Removed the teal/green hue
  '#D8C9A6',
  '#9C4F5B',
  '#6E7A99',
];

/**
 * @typedef {Object} RenderMode
 * @property {string} id
 * @property {string} label
 * @property {Object|null} palette - a full tone set, or null for the day cycle's
 * @property {string[]|null} hues - per-building accents, or null for none
 */

/**
 * The two ways the world can be painted.
 *
 * `retro` carries no palette at all, which is what makes it the *default* rather
 * than another filter: with nothing to override, the day cycle's own tones come
 * through and the world looks exactly as it always did at that hour.
 *
 * @type {RenderMode[]}
 */
export const RENDER_MODES = [
  { id: 'retro', label: 'RETRO', palette: null, hues: null },
  { id: 'color', label: 'COLOR', palette: NATURAL_PALETTE, hues: NATURAL_HUES },
];

/** @type {Record<string, RenderMode>} */
export const RENDER_BY_ID = Object.fromEntries(RENDER_MODES.map((m) => [m.id, m]));

/**
 * @param {boolean} colored
 * @returns {RenderMode}
 */
export function renderMode(colored) {
  return colored ? RENDER_BY_ID.color : RENDER_BY_ID.retro;
}
