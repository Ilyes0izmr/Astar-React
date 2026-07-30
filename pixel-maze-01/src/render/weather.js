/**
 * The animated weather overlay.
 *
 * Only the modes that actually put something in the air are drawn here. Rain and
 * snow share one fixed pool of particles - allocated once, never grown - and the
 * CRT pass is a pure function of `time` and the field size.
 *
 * COLOR is deliberately absent: it recolours the world by swapping the palette
 * before anything is painted, which is a different mechanism entirely from
 * laying a shape over the top. See `core/weather.js` for why that distinction
 * matters.
 *
 * Positions are kept in a normalized 0..1 field rather than pixels, so the pool
 * survives a resize untouched - a drop at 0.4 down is 0.4 down whatever the world
 * measures this frame. {@link update} converts pixel-per-second speeds into that
 * space using the live height, which is what keeps the fall looking the same
 * rate on a short map as on a tall one.
 *
 * The palette rule from palette.js holds here as everywhere: colors are read
 * from {@link PALETTE} at draw time, never captured.
 *
 * @see ../core/weather.js - the mode data this reads
 * @see ./effects.js - the ParticleField whose pooling this follows
 */
import { PALETTE } from '../core/palette.js';
import { px, dither, hash2, TILE_PX } from './art.js';
import { mulberry32 } from '../core/rng.js';
import { weatherAt, WEATHER_BY_ID } from '../core/weather.js';

const TAU = Math.PI * 2;

/**
 * Slots in the pool.
 *
 * Sized for the hungriest mode, which is snow rather than rain: a raindrop is an
 * eight-pixel streak and a flake is a single dot, so snow needs several times the
 * count before it reads as weather instead of dust. Each mode's `intensity`
 * scales down from here, so the pool is never run dry.
 */
const PARTICLE_CAPACITY = 560;

export class WeatherSystem {
  constructor() {
    /** @type {import('../core/weather.js').WeatherMode} */
    this.mode = weatherAt(0);

    /** @type {{x: number, y: number, speed: number, phase: number, size: number}[]} */
    this.pool = new Array(PARTICLE_CAPACITY);
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i] = { x: 0, y: 0, speed: 1, phase: 0, size: 1 };
    }

    this.setMode(this.mode.id);
  }

  /**
   * Switches modes and re-scatters the pool.
   *
   * Re-seeding across the whole field, not just the top edge, is what stops a
   * switch from stuttering: the new weather is already in progress everywhere the
   * instant it turns on, instead of raining in from the ceiling for a second.
   *
   * @param {string} weatherId - an id from {@link WEATHER_BY_ID}
   */
  setMode(weatherId) {
    this.mode = WEATHER_BY_ID[weatherId] ?? weatherAt(0);

    // Seeded off the id so a mode always lays its field out the same way; a
    // string hash keeps modes of equal-length ids from sharing a scatter.
    let seed = 0x7eafeed;
    for (let k = 0; k < this.mode.id.length; k++) {
      seed = (seed * 31 + this.mode.id.charCodeAt(k)) | 0;
    }
    const rand = mulberry32(seed);

    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      p.x = rand();
      p.y = rand();
      p.speed = 0.75 + rand() * 0.6;
      p.phase = rand() * TAU;
      // A minority of fat flakes and near drops, for a sense of depth.
      p.size = rand() > 0.82 ? 2 : 1;
    }
  }

  /**
   * Advances precipitation. Does nothing for the modes that do not fall.
   *
   * @param {number} dt - seconds since the last frame
   * @param {number} w - world width in pixels
   * @param {number} h - world height in pixels
   */
  update(dt, w, h) {
    const { id, wind } = this.mode;
    if ((id !== 'rain' && id !== 'snow') || w <= 0 || h <= 0) return;

    // A backgrounded tab wakes with one enormous delta; unclamped, every drop
    // teleports a full field on the first frame back.
    const step = Math.min(dt, 0.05);
    const rain = id === 'rain';

    // Speeds are authored in pixels per second, then folded into the normalized
    // field so the fall rate reads the same whatever shape the world is.
    const dy = ((rain ? 900 : 62) * step) / h;
    const dx = (wind * (rain ? 520 : 130) * step) / w;

    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      p.y += dy * p.speed;
      p.x += dx * p.speed;
      if (p.y >= 1) p.y -= 1;
      if (p.x >= 1) p.x -= 1;
      else if (p.x < 0) p.x += 1;
    }
  }

  /**
   * Paints the whole overlay for the current mode.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w - world width in pixels
   * @param {number} h - world height in pixels
   * @param {number} time - elapsed milliseconds, the only clock the effects read
   */
  draw(ctx, w, h, time) {
    const mode = this.mode;
    if (mode.intensity <= 0 || w <= 0 || h <= 0) return;

    switch (mode.id) {
      case 'rain':
        this.#drawRain(ctx, w, h);
        break;
      case 'snow':
        this.#drawSnow(ctx, w, h, time);
        break;
      // COLOR paints nothing here on purpose - it is a palette filter applied
      // before the world is drawn, not an overlay laid on afterwards.
      case 'retro':
        this.#drawRetro(ctx, w, h, time);
        break;
      default:
        break;
    }
  }

  /**
   * Fast diagonal streaks over an overcast wash, with the odd splash.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   */
  #drawRain(ctx, w, h) {
    const mode = this.mode;

    // Knocks the whole scene down a notch so the streaks read as rain against an
    // overcast sky rather than sparks over a clear one.
    dither(ctx, 0, 0, w, h, PALETTE.dark, 0.12 * mode.intensity + 0.04);

    const count = Math.floor(this.pool.length * mode.intensity);
    const len = TILE_PX >> 1;
    // Sideways travel per row, so the streak leans at the mode's wind angle.
    const slope = mode.wind * 1.3;
    const streak = PALETTE.light;
    const head = PALETTE.bg;

    for (let i = 0; i < count; i++) {
      const p = this.pool[i];
      const sx = p.x * w;
      const sy = p.y * h;
      for (let r = 0; r < len; r++) {
        px(ctx, sx + r * slope, sy + r, 1, 1, r < 2 ? head : streak);
      }

      // Only drops low in the field splash, and the hash keys off the slot so
      // the same few splash each frame instead of the whole field flickering.
      if (p.y > 0.86 && hash2(i, 0, 5) < 0.22) {
        const fx = sx + len * slope;
        const fy = sy + len;
        px(ctx, fx - 1, fy, 3, 1, streak);
        px(ctx, fx, fy - 1, 1, 1, head);
      }
    }
  }

  /**
   * Slow flakes swaying on their own phase, calmer and sparser than rain.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   * @param {number} time
   */
  #drawSnow(ctx, w, h, time) {
    const mode = this.mode;
    const count = Math.floor(this.pool.length * mode.intensity);
    const amp = TILE_PX * 0.2;

    for (let i = 0; i < count; i++) {
      const p = this.pool[i];
      // Per-flake phase, so the fall drifts as a soft crowd rather than sliding
      // across in one rigid sheet.
      const sway = Math.sin(time / 900 + p.phase) * amp * p.speed;
      const x = p.x * w + sway;
      const y = p.y * h;
      // The fatter flakes take the brightest tone, reading as the nearer ones.
      px(ctx, x, y, p.size, p.size, p.size > 1 ? PALETTE.bg : PALETTE.light);
    }
  }




  /**
   * The CRT pass: scanlines, a vignette and one rolling refresh bar.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   * @param {number} time
   */
  #drawRetro(ctx, w, h, time) {
    const strength = this.mode.intensity;

    // A dark dash every other row. Dithered, not solid, so the picture reads
    // through the grille the way it does on a real tube.
    for (let y = 0; y < h; y += 2) {
      dither(ctx, 0, y, w, 1, PALETTE.black, 0.55 * strength);
    }

    // Two nested dark frames, denser at the very edge, so the corners fall away
    // without a real gradient anywhere.
    const m = Math.round(Math.min(w, h) * 0.16);
    this.#edges(ctx, w, h, m, 0.18 * strength);
    this.#edges(ctx, w, h, m >> 1, 0.14 * strength);

    // The bright refresh bar, rolling down and wrapping. It starts off the top
    // edge so it slides in rather than blinking on.
    const barH = Math.max(6, Math.round(h * 0.12));
    const span = h + barH;
    const by = ((time / 36) % span) - barH;
    dither(ctx, 0, by, w, barH, PALETTE.light, 0.16 * strength);
  }

  /**
   * Four dark edge strips, the building block of the vignette.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   * @param {number} m - strip thickness
   * @param {number} density
   */
  #edges(ctx, w, h, m, density) {
    if (m <= 0) return;
    const color = PALETTE.black;
    dither(ctx, 0, 0, w, m, color, density);
    dither(ctx, 0, h - m, w, m, color, density);
    dither(ctx, 0, 0, m, h, color, density);
    dither(ctx, w - m, 0, m, h, color, density);
  }
}
