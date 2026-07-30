/**
 * Animated trains running along the northern railway.
 *
 * Each train follows a fixed cycle:
 *   1. Enter from the right edge
 *   2. Stop at the station for 10 seconds
 *   3. Departure whistle (visual puff of smoke)
 *   4. Leave to the left
 *   5. Stay off-screen for 15 seconds
 *   6. Repeat
 *
 * The train is drawn as a sequence of carriages, each a small pixel-art
 * rectangle. Smoke particles rise from the locomotive.
 */
import { PALETTE, BUILDING_HUES } from '../core/palette.js';
import { TILE } from '../core/tiles.js';
import { px, hash2, TILE_PX } from './art.js';

/** How many carriages the train has. */
const CARRIAGE_COUNT = 6;
/** Width of one carriage in pixels. */
const CARRIAGE_W = 18;
/** Gap between carriages. */
const CARRIAGE_GAP = 2;
/** Height of a carriage. */
const CARRIAGE_H = 10;
/** Total train length in pixels. */
const TRAIN_LENGTH = CARRIAGE_COUNT * (CARRIAGE_W + CARRIAGE_GAP);

const PHASE_ENTER = 0;
const PHASE_STOP = 1;
const PHASE_DEPART = 2;
const PHASE_AWAY = 3;

const STOP_DURATION = 10;
const AWAY_DURATION = 15;
const TRAIN_SPEED = 80; // pixels per second

/**
 * Manages one or two trains on the northern railway.
 */
export class TrainSystem {
  constructor(grid) {
    this.grid = grid;
    this.trains = [];

    // Find railway rows
    this.trackY = -1;
    for (let r = 0; r < grid.height; r++) {
      if (grid.tiles[r * grid.width] === TILE.RAILWAY ||
          grid.tiles[r * grid.width + 1] === TILE.RAILWAY) {
        this.trackY = r * TILE_PX + 2;
        break;
      }
    }

    if (this.trackY < 0) return;

    const worldW = grid.width * TILE_PX;
    // Two trains, offset so they don't overlap
    this.trains.push(new Train(worldW, this.trackY, 0));
    this.trains.push(new Train(worldW, this.trackY + TILE_PX, STOP_DURATION + AWAY_DURATION / 2));
  }

  update(dt) {
    for (const train of this.trains) train.update(dt);
  }

  draw(ctx, now) {
    for (const train of this.trains) train.draw(ctx, now);
  }
}

class Train {
  constructor(worldW, y, timeOffset) {
    this.worldW = worldW;
    this.y = y;
    this.phase = PHASE_AWAY;
    this.timer = timeOffset; // start with offset so trains don't sync
    this.x = worldW + TRAIN_LENGTH; // off-screen right
    this.smokeParticles = [];
    this.stationX = Math.floor(worldW * 0.35); // stop position
  }

  update(dt) {
    this.timer += dt;

    switch (this.phase) {
      case PHASE_AWAY:
        if (this.timer >= AWAY_DURATION) {
          this.phase = PHASE_ENTER;
          this.x = this.worldW + TRAIN_LENGTH;
          this.timer = 0;
        }
        break;

      case PHASE_ENTER:
        this.x -= TRAIN_SPEED * dt;
        if (this.x <= this.stationX) {
          this.x = this.stationX;
          this.phase = PHASE_STOP;
          this.timer = 0;
        }
        break;

      case PHASE_STOP:
        // Puff smoke at departure
        if (this.timer >= STOP_DURATION - 1) {
          this._emitSmoke();
        }
        if (this.timer >= STOP_DURATION) {
          this.phase = PHASE_DEPART;
          this.timer = 0;
        }
        break;

      case PHASE_DEPART:
        this.x -= TRAIN_SPEED * dt;
        this._emitSmoke();
        if (this.x + TRAIN_LENGTH < 0) {
          this.phase = PHASE_AWAY;
          this.timer = 0;
        }
        break;
    }

    // Update smoke
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 8 * dt; // float upward
      if (p.life <= 0) this.smokeParticles.splice(i, 1);
    }
    // Cap particles
    if (this.smokeParticles.length > 30) {
      this.smokeParticles.splice(0, this.smokeParticles.length - 30);
    }
  }

  _emitSmoke() {
    if (Math.random() > 0.3) return;
    this.smokeParticles.push({
      x: this.x + TRAIN_LENGTH - 4,
      y: this.y - 4,
      vx: (Math.random() - 0.5) * 6,
      vy: -12 - Math.random() * 8,
      life: 0.8 + Math.random() * 0.6,
      size: Math.random() > 0.5 ? 2 : 3,
    });
  }

  draw(ctx, now) {
    const x = Math.round(this.x);
    const y = Math.round(this.y);

    // Draw carriages
    for (let i = 0; i < CARRIAGE_COUNT; i++) {
      const cx = x + i * (CARRIAGE_W + CARRIAGE_GAP);
      // Skip if off-screen
      if (cx + CARRIAGE_W < 0 || cx > this.worldW) continue;

      const isLoco = i === CARRIAGE_COUNT - 1;

      // Pick a random color from BUILDING_HUES for the carriage, fallback to mid
      let carriageColor = PALETTE.mid;
      if (!isLoco && BUILDING_HUES && BUILDING_HUES.length > 0) {
        // Use a consistent index based on the train y-coordinate and carriage index
        const colorIndex = Math.floor(hash2(i, this.y, 42) * BUILDING_HUES.length);
        carriageColor = BUILDING_HUES[colorIndex];
      }

      // Carriage body
      px(ctx, cx, y, CARRIAGE_W, CARRIAGE_H, isLoco ? PALETTE.dark : carriageColor);
      // Roof
      px(ctx, cx + 1, y, CARRIAGE_W - 2, 2, PALETTE.black);
      // Windows
      if (!isLoco) {
        for (let w = 3; w < CARRIAGE_W - 3; w += 4) {
          px(ctx, cx + w, y + 3, 2, 3, PALETTE.light);
        }
      } else {
        // Locomotive chimney
        px(ctx, cx + CARRIAGE_W - 6, y - 3, 3, 3, PALETTE.black);
        px(ctx, cx + CARRIAGE_W - 5, y - 4, 1, 1, PALETTE.mid);
        // Cab window
        px(ctx, cx + 2, y + 3, 4, 3, PALETTE.light);
      }
      // Wheels
      px(ctx, cx + 2, y + CARRIAGE_H, 3, 2, PALETTE.black);
      px(ctx, cx + CARRIAGE_W - 5, y + CARRIAGE_H, 3, 2, PALETTE.black);
      // Coupling
      if (i < CARRIAGE_COUNT - 1) {
        px(ctx, cx + CARRIAGE_W, y + CARRIAGE_H - 3, CARRIAGE_GAP, 1, PALETTE.dark);
      }
    }

    // Draw smoke
    for (const p of this.smokeParticles) {
      const t = p.life / 1.4;
      const color = t > 0.5 ? PALETTE.mid : PALETTE.light;
      px(ctx, Math.round(p.x), Math.round(p.y), p.size, p.size, color);
    }

    // Signal lights at station position
    if (this.phase === PHASE_STOP) {
      // Red signal
      const sigX = Math.round(this.stationX - 8);
      px(ctx, sigX, y - 6, 3, 8, PALETTE.black);
      px(ctx, sigX + 1, y - 5, 1, 2, PALETTE.glow ?? '#e2574c');
    }
  }
}
