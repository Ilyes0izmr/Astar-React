/**
 * The decorative layer: spinning coins, twinkles, lamp light, stars and the
 * particle pool.
 *
 * Everything here is transient, so none of it belongs in the cached terrain
 * canvas - it is repainted every frame on top of the world. That is also why the
 * cost of each function matters far more than it does in `terrain.js`: a lamp
 * pool is drawn once per lamp per frame, not once per city.
 *
 * The rule from `palette.js` applies with no exceptions in this file. Several of
 * these effects only exist after dark and read `PALETTE.glow`, which is **null
 * while the sun is up** - every one of them guards for it rather than assuming a
 * color is there.
 *
 * @see instruction.md - "Animations", "Decorative Props", "Lighting"
 */
import { PALETTE, CURRENT_STAGE } from '../core/palette.js';
import { isLit } from '../core/daycycle.js';
import { mulberry32 } from '../core/rng.js';
import { px, dither, hash2, TILE_PX } from './art.js';

/**
 * Silhouette width of each frame of the coin spin, in pixels.
 *
 * Eight frames to the turn, tracing |cos| so the disc narrows to an edge at the
 * quarter turns and widens back out. This is a frame table and not a scale
 * transform on purpose: scaling a circle resamples it into a blurred oval, and
 * the whole point of a pixel-art coin is that each frame is a hand-sized shape
 * with hard edges.
 */
const COIN_WIDTHS = [8, 6, 2, 6, 8, 6, 2, 6];

/**
 * A spinning coin, centred in its tile.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - tile origin in canvas pixels
 * @param {number} y - tile origin in canvas pixels
 * @param {number} phase - 0..1 is one full rotation; values outside wrap
 */
export function drawCoin(ctx, x, y, phase) {
  const frames = COIN_WIDTHS.length;
  const frame = ((Math.floor(phase * frames) % frames) + frames) % frames;
  const w = COIN_WIDTHS[frame];
  const cx = x + TILE_PX / 2;
  const left = cx - (w >> 1);
  const top = y + 3;
  const h = 10;

  // The shadow narrows with the coin. It costs one fill and it is most of what
  // sells the spin at a glance, before the eye resolves the face at all.
  px(ctx, left, y + 14, w, 1, PALETTE.mid);

  if (w <= 2) {
    px(ctx, left, top, 2, h, PALETTE.black);
    px(ctx, left, top + 1, 1, h - 2, PALETTE.light);
    return;
  }

  // Corners knocked off both the silhouette and the face, so a rectangle of
  // fills reads as a disc.
  px(ctx, left + 1, top, w - 2, h, PALETTE.black);
  px(ctx, left, top + 1, w, h - 2, PALETTE.black);
  px(ctx, left + 2, top + 1, w - 4, h - 2, PALETTE.light);
  px(ctx, left + 1, top + 2, w - 2, h - 4, PALETTE.light);

  // The glint is a fixed point on the metal, so it tracks around with the
  // rotation and slides off the receding edge rather than staying put.
  const faceLeft = left + 1;
  const faceSpan = w - 3;
  const g = 0.5 + 0.5 * Math.cos((frame / frames) * Math.PI * 2);
  px(ctx, faceLeft + Math.round(faceSpan * (1 - g)), top + 3, 1, 4, PALETTE.mid);
  px(ctx, faceLeft + Math.round(faceSpan * g), top + 2, 1, h - 4, PALETTE.glow ?? PALETTE.bg);
}

/**
 * A four-point twinkle that grows and fades over its phase.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - centre of the star
 * @param {number} y - centre of the star
 * @param {number} phase - 0..1; the star is at full reach at 0.5 and gone at
 *   both ends
 * @param {number} [size=4] - arm length in pixels at full reach
 */
export function drawSparkle(ctx, x, y, phase, size = 4) {
  const t = Math.max(0, Math.min(1, phase));
  const arm = Math.round(size * Math.sin(t * Math.PI));
  if (arm < 1) return;

  const bright = PALETTE.glow ?? PALETTE.bg;
  px(ctx, x - arm, y, arm * 2 + 1, 1, bright);
  px(ctx, x, y - arm, 1, arm * 2 + 1, bright);

  // Tips stepped down a tone so the arms taper instead of ending in a hard
  // stub, which is the difference between a twinkle and a plus sign.
  px(ctx, x - arm, y, 1, 1, PALETTE.light);
  px(ctx, x + arm, y, 1, 1, PALETTE.light);
  px(ctx, x, y - arm, 1, 1, PALETTE.light);
  px(ctx, x, y + arm, 1, 1, PALETTE.light);

  if (arm >= 3) {
    const d = arm >> 1;
    px(ctx, x - d, y - d, 1, 1, PALETTE.light);
    px(ctx, x + d, y - d, 1, 1, PALETTE.light);
    px(ctx, x - d, y + d, 1, 1, PALETTE.light);
    px(ctx, x + d, y + d, 1, 1, PALETTE.light);
  }

  px(ctx, x, y, 1, 1, PALETTE.bg);
}

/**
 * A dithered pool of lamp light.
 *
 * Drawn as horizontal bands rather than a per-pixel disc: a radius-12 pool is
 * twelve fills this way and 576 the other, and there can be one under every
 * lamp on screen.
 *
 * Does nothing while the sun is up, when there is no glow tone to draw with.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - centre of the pool
 * @param {number} y - centre of the pool
 * @param {number} radius - in pixels
 * @param {number} [intensity=1] - 0..1, scales the dither density
 */
export function drawLampPool(ctx, x, y, radius, intensity = 1) {
  const glow = PALETTE.glow;
  if (!glow || intensity <= 0) return;

  const r = Math.round(radius);
  if (r < 2) return;

  const band = 2;
  for (let dy = -r; dy < r; dy += band) {
    const t = (dy + band / 2) / r;
    const half = Math.round(r * Math.sqrt(Math.max(0, 1 - t * t)));
    if (half < 1) continue;
    dither(ctx, x - half, y + dy, half * 2, band, glow, intensity * 0.7 * (1 - Math.abs(t) * 0.75));
  }
}

/**
 * A street lamp and the light it casts, drawn only once the lamps are on.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - tile origin in canvas pixels
 * @param {number} y - tile origin in canvas pixels
 * @param {number} [time=0] - elapsed milliseconds, drives the flicker
 */
export function drawStreetLamp(ctx, x, y, time = 0) {
  const stage = CURRENT_STAGE;
  if (!isLit(stage)) return;

  // Offset by the lamp's own position so a street of them breathes out of step.
  // In unison it reads as the whole scene pulsing, which is a different and much
  // worse effect.
  const flicker = 0.85 + 0.15 * Math.sin(time / 700 + hash2(x, y, 7) * 6.283);
  drawLampPool(ctx, x + 8, y + 13, 11, flicker * stage.lit);

  px(ctx, x + 6, y + 13, 4, 2, PALETTE.black);
  px(ctx, x + 7, y + 5, 2, 9, PALETTE.black);
  px(ctx, x + 5, y + 3, 6, 3, PALETTE.black);
  px(ctx, x + 6, y + 4, 4, 1, PALETTE.glow);
  px(ctx, x + 7, y + 6, 2, 1, PALETTE.glow);
}

/**
 * Speckles the backdrop with stars.
 *
 * Positions come from {@link hash2} rather than a live generator, so the sky
 * does not reshuffle itself sixty times a second. Fills the whole rectangle
 * given, so the caller should paint this on the backdrop before the world goes
 * down on top of it.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - width of the area to cover
 * @param {number} h - height of the area to cover
 * @param {import('../core/daycycle.js').Stage} stage
 */
export function drawStars(ctx, w, h, stage) {
  const amount = stage?.stars ?? 0;
  if (amount <= 0) return;

  const cell = 14;
  for (let sy = 0; sy < h; sy += cell) {
    for (let sx = 0; sx < w; sx += cell) {
      const roll = hash2(sx, sy, 314);
      if (roll > amount * 0.4) continue;

      const ox = sx + Math.floor(hash2(sx, sy, 12) * cell);
      const oy = sy + Math.floor(hash2(sx, sy, 34) * cell);

      if (roll < amount * 0.05) {
        // A handful of brighter ones, drawn as a cross so they read as stars
        // and not as dirt on the screen.
        px(ctx, ox, oy - 1, 1, 3, PALETTE.bg);
        px(ctx, ox - 1, oy, 3, 1, PALETTE.bg);
      } else {
        px(ctx, ox, oy, 1, 1, roll < amount * 0.2 ? PALETTE.bg : PALETTE.light);
      }
    }
  }
}

/** Slots in the particle pool. Comfortably more than a goal burst needs. */
const PARTICLE_CAPACITY = 256;

/**
 * A fixed pool of short-lived particles.
 *
 * The pool is allocated once and slots are recycled round-robin. Spawning is on
 * the hot path - dust comes off the vehicle several times a second, and a goal
 * burst is thirty at once - and allocating there would hand the collector a
 * steady drip of garbage during the exact frames that most need the headroom.
 * When the field is saturated the oldest slot is overwritten, which is the cap
 * doing its job.
 */
export class ParticleField {
  /**
   * @param {number} [capacity=PARTICLE_CAPACITY]
   */
  constructor(capacity = PARTICLE_CAPACITY) {
    /** @type {{x: number, y: number, vx: number, vy: number, life: number,
     *           ttl: number, size: number, kind: string}[]} */
    this.pool = new Array(Math.max(1, capacity));
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i] = { x: 0, y: 0, vx: 0, vy: 0, life: 0, ttl: 1, size: 1, kind: 'dust' };
    }
    this.cursor = 0;
    // Seeded rather than Math.random for the same reason the city is: a replay
    // of the same run should throw the same sparks.
    this.random = mulberry32(0x9e37);
  }

  /**
   * Emits one particle.
   *
   * @param {number} x
   * @param {number} y
   * @param {string} [kind='dust'] - 'dust', 'burst' or 'spark'
   */
  spawn(x, y, kind = 'dust') {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    const r = this.random;

    p.x = x;
    p.y = y;
    p.kind = kind;

    if (kind === 'burst') {
      const angle = r() * Math.PI * 2;
      const speed = 18 + r() * 34;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.ttl = 0.5 + r() * 0.4;
      p.size = r() > 0.7 ? 2 : 1;
    } else if (kind === 'spark') {
      p.vx = (r() - 0.5) * 14;
      p.vy = -8 - r() * 16;
      p.ttl = 0.25 + r() * 0.25;
      p.size = 1;
    } else {
      p.vx = (r() - 0.5) * 10;
      p.vy = (r() - 0.5) * 10 - 4;
      p.ttl = 0.35 + r() * 0.3;
      p.size = 1;
    }

    p.life = p.ttl;
  }

  /**
   * Advances every live particle.
   *
   * @param {number} dt - seconds since the last frame
   */
  update(dt) {
    if (dt <= 0) return;
    // A backgrounded tab hands back one enormous delta on its first frame.
    // Unclamped, every live particle teleports off screen at once.
    const step = Math.min(dt, 0.05);
    const drag = Math.max(0, 1 - 5 * step);

    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (p.life <= 0) continue;

      p.life -= step;
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.vx *= drag;
      p.vy *= drag;
      if (p.kind !== 'dust') p.vy += 70 * step;
    }
  }

  /**
   * Paints every live particle.
   *
   * Age is expressed by stepping down the palette rather than by fading alpha,
   * because there are only five tones and no transparency anywhere in the art.
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    const bright = PALETTE.glow ?? PALETTE.bg;

    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (p.life <= 0) continue;

      const t = p.life / p.ttl;
      let color;
      if (p.kind === 'dust') {
        // Dust settles toward the road tone it was kicked up from, so it thins
        // out instead of blinking away.
        color = t > 0.55 ? PALETTE.dark : PALETTE.mid;
      } else {
        color = t > 0.45 ? bright : PALETTE.light;
      }

      px(ctx, p.x, p.y, p.size, p.size, color);
    }
  }

  /** Kills everything currently in flight. */
  clear() {
    for (let i = 0; i < this.pool.length; i++) this.pool[i].life = 0;
  }
}

/**
 * A pixel-art lighthouse with a rotating beam at night.
 *
 * The tower is drawn as a static structure. The beam sweeps 360° and is
 * only visible during lit stages (dusk/night/sunrise).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - left edge of the lighthouse in canvas pixels
 * @param {number} y - top edge of the lighthouse in canvas pixels
 * @param {number} now - elapsed ms, drives the rotation
 */
export function drawLighthouse(ctx, x, y, now) {
  const stage = CURRENT_STAGE;
  // Tower body
  px(ctx, x + 8, y + 8, 16, 40, PALETTE.bg);
  px(ctx, x + 10, y + 4, 12, 4, PALETTE.bg);
  // Red stripes
  px(ctx, x + 8, y + 16, 16, 6, '#c4553f');
  px(ctx, x + 8, y + 32, 16, 6, '#c4553f');
  // Outline
  px(ctx, x + 6, y + 8, 2, 40, PALETTE.black);
  px(ctx, x + 24, y + 8, 2, 40, PALETTE.black);
  px(ctx, x + 8, y + 6, 16, 2, PALETTE.black);
  px(ctx, x + 8, y + 48, 16, 2, PALETTE.black);
  // Lamp housing
  px(ctx, x + 10, y, 12, 6, PALETTE.dark);
  px(ctx, x + 12, y + 2, 8, 2, PALETTE.glow ?? PALETTE.bg);

  // Rotating beam (only at night)
  if (isLit(stage)) {
    const angle = (now / 3000) * Math.PI * 2;
    const beamLen = 80;
    const bx = Math.round(x + 16 + Math.cos(angle) * beamLen);
    const by = Math.round(y + 3 + Math.sin(angle) * beamLen);
    const glow = PALETTE.glow;
    if (glow) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = glow;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x + 16, y + 3);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.globalAlpha = 0.15;
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(x + 16, y + 3);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.restore();
    }
  }
}
