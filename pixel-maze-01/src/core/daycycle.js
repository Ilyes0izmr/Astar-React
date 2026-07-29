/**
 * The day cycle: five discrete times of day, each with its own palette, its own
 * sun direction, and its own idea of how lit the city is.
 *
 * The stages are **discrete, never interpolated**. Blending two palettes would
 * produce colors that are in neither of them, and the whole art direction rests
 * on a small fixed set of flat tones - a cross-faded midpoint is exactly the
 * gradient the spec forbids. So the slider snaps: five stops, five complete
 * looks.
 *
 * Every stage supplies the same five material tones in the same roles, so all
 * the painters keep working untouched - they ask for `mid` and get whatever
 * "building face" means at this hour. Two extra roles exist because a day cycle
 * cannot be expressed without them:
 *
 *   - `backdrop` - the surface the world sits on. At noon it is the parchment;
 *     at night it is the dark between the streetlights.
 *   - `glow` - lit windows and lamp pools. Null while the sun is up, because
 *     nobody has their lights on at midday.
 *
 * The sun vector points *from* the light *toward* the shadow, so a painter can
 * offset a silhouette by it directly. Low sun at either end of the day throws
 * long shadows across the roads; at noon they collapse to almost nothing.
 *
 * @see instruction.md - "Color Palette", "Lighting"
 */

/**
 * @typedef {Object} Stage
 * @property {string} id
 * @property {string} label - shown on the time-of-day slider
 * @property {string} bg - brightest tone: road markings, marker pads
 * @property {string} light - road surface, highlights, windows
 * @property {string} mid - building faces, buttons
 * @property {string} dark - roofs, cast shadows, borders
 * @property {string} black - outlines, text
 * @property {string} backdrop - the void behind the world
 * @property {string|null} glow - lit windows and lamp pools, null when unlit
 * @property {{dx: number, dy: number, len: number, density: number}} sun -
 *   shadow offset direction (unit-ish), length in pixels, and dither density
 * @property {number} lit - 0..1, how many windows are switched on
 * @property {number} stars - 0..1, density of sky speckle on the backdrop
 */

/** @type {Stage[]} ordered sunrise to night; the slider indexes straight in. */
export const STAGES = [
  {
    id: 'sunrise',
    label: 'SUNRISE',
    bg: '#F4DCC8',
    light: '#DCB49C',
    mid: '#A87B72',
    dark: '#6B4A55',
    black: '#33212F',
    backdrop: '#F4DCC8',
    glow: '#FFE9B0',
    // Sun low in the east, so everything throws a long shadow west.
    sun: { dx: -1, dy: 0.45, len: 7, density: 0.5 },
    lit: 0.18,
    stars: 0,
  },
  {
    id: 'day',
    label: 'MIDDAY',
    // The original parchment palette from the art spec, unchanged.
    bg: '#D7D1C3',
    light: '#B8B4A7',
    mid: '#7A7772',
    dark: '#44413F',
    black: '#262626',
    backdrop: '#D7D1C3',
    glow: null,
    // Sun overhead: shadows are short and tucked under the buildings.
    sun: { dx: -0.35, dy: 1, len: 3, density: 0.45 },
    lit: 0,
    stars: 0,
  },
  {
    id: 'sunset',
    label: 'SUNSET',
    bg: '#F0CE9C',
    light: '#D4A470',
    mid: '#9C6A4E',
    dark: '#5C3A3E',
    black: '#2B1A24',
    backdrop: '#F0CE9C',
    glow: '#FFD98A',
    // Sun low in the west now, so the shadows swing the other way.
    sun: { dx: 1, dy: 0.4, len: 7, density: 0.55 },
    lit: 0.4,
    stars: 0,
  },
  {
    id: 'dusk',
    label: 'DUSK',
    bg: '#F7E9DA',
    light: '#D9B5A0',
    mid: '#7A5570',
    dark: '#46304F',
    black: '#22162E',
    backdrop: '#46304F',
    glow: '#FFCE8C',
    // Last of the light, raking in from the west and slightly behind.
    sun: { dx: 0.8, dy: -0.55, len: 5, density: 0.6 },
    lit: 0.72,
    stars: 0.25,
  },
  {
    id: 'night',
    label: 'NIGHT',
    bg: '#C9D3E8',
    light: '#5C6485',
    mid: '#333A5C',
    dark: '#1E2340',
    black: '#0E1122',
    backdrop: '#1E2340',
    glow: '#FFE9A8',
    // No sun. What is left is a soft ambient smudge under each building.
    sun: { dx: -0.3, dy: 0.6, len: 2, density: 0.3 },
    lit: 1,
    stars: 0.7,
  },
];

/** @type {Record<string, Stage>} */
export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));

/** The stage the app opens on. */
export const DEFAULT_STAGE_INDEX = 1;

/**
 * Clamps a slider position to a real stage.
 *
 * @param {number} index
 * @returns {Stage}
 */
export function stageAt(index) {
  return STAGES[Math.max(0, Math.min(STAGES.length - 1, Math.round(index)))];
}

/**
 * Whether a stage should have its lights on.
 *
 * @param {Stage} stage
 * @returns {boolean}
 */
export function isLit(stage) {
  return stage.glow !== null && stage.lit > 0;
}

/**
 * The pixel offset a shadow of the given height should be drawn at.
 *
 * Taller buildings throw longer shadows, which is most of what sells the
 * fake-3D: a row of blocks with identical shadows reads flat no matter how well
 * each one is shaded.
 *
 * @param {Stage} stage
 * @param {number} [height=3] - building height in floors, 1..5
 * @returns {{x: number, y: number}} offset in pixels, already rounded
 */
export function shadowOffset(stage, height = 3) {
  const scale = (0.5 + height / 5) * stage.sun.len;
  return {
    x: Math.round(stage.sun.dx * scale),
    y: Math.round(stage.sun.dy * scale),
  };
}
