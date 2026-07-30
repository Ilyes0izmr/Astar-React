/**
 * Procedural city life: pedestrians, cyclists, animals, and static details.
 *
 * Entities are spawned deterministically from the grid seed and move along
 * walkable tiles. The system is performance-capped at a fixed number of
 * active entities to keep the frame rate stable on large maps.
 *
 * All sprites are 2-4 pixels wide — detail is communicated by color and
 * motion rather than by resolution, matching the rest of the art.
 */
import { PALETTE } from '../core/palette.js';
import { TILE, isWalkable } from '../core/tiles.js';
import { px, hash2, TILE_PX } from './art.js';

const MAX_ENTITIES = 150;
const PEDESTRIAN_SPEED = 8; // px/s
const CYCLIST_SPEED = 20;
const ANIMAL_SPEED = 5;
const BIRD_SPEED = 30;

/**
 * @typedef {Object} Entity
 * @property {number} x - world pixel x
 * @property {number} y - world pixel y
 * @property {number} vx - velocity x
 * @property {number} vy - velocity y
 * @property {string} kind - entity type
 * @property {number} timer - time until next direction change
 * @property {string} color - palette key for primary color
 */

/** Returns a random walkable cell from the grid. */
function randomWalkableCell(grid, seed) {
  const n = grid.tiles.length;
  let start = Math.floor(hash2(seed, seed * 3, 99) * n);
  for (let i = 0; i < n; i++) {
    const idx = (start + i) % n;
    if (grid.tiles[idx] === TILE.FLOOR) return idx;
  }
  return -1;
}

const ENTITY_KINDS = [
  'pedestrian', 'pedestrian', 'pedestrian', 'pedestrian',
  'cyclist',
  'cat', 'dog',
  'bird', 'bird',
  'pigeon',
  'seagull',
];

export class CityLife {
  constructor(grid) {
    this.grid = grid;
    this.entities = [];

    // Spawn entities at random road positions
    const count = Math.min(MAX_ENTITIES, Math.floor(grid.width * grid.height * 0.1));
    for (let i = 0; i < count; i++) {
      const cell = randomWalkableCell(grid, i * 137 + 42);
      if (cell < 0) continue;

      const col = cell % grid.width;
      const row = Math.floor(cell / grid.width);
      const kind = ENTITY_KINDS[i % ENTITY_KINDS.length];

      this.entities.push({
        x: col * TILE_PX + TILE_PX / 2,
        y: row * TILE_PX + TILE_PX / 2,
        vx: 0,
        vy: 0,
        kind,
        timer: hash2(i, 7, 31) * 3,
        color: this._pickColor(kind, i),
      });
      this._randomizeVelocity(this.entities[this.entities.length - 1]);
    }
  }

  _pickColor(kind, seed) {
    switch (kind) {
      case 'pedestrian': return ['dark', 'mid', 'black'][seed % 3];
      case 'cyclist': return 'dark';
      case 'cat': return ['dark', 'mid', 'light'][seed % 3];
      case 'dog': return ['dark', 'mid'][seed % 2];
      case 'bird': return 'dark';
      case 'pigeon': return 'mid';
      case 'seagull': return 'bg';
      default: return 'dark';
    }
  }

  _speedForKind(kind) {
    switch (kind) {
      case 'cyclist': return CYCLIST_SPEED;
      case 'bird':
      case 'seagull': return BIRD_SPEED;
      case 'cat':
      case 'dog':
      case 'pigeon': return ANIMAL_SPEED;
      default: return PEDESTRIAN_SPEED;
    }
  }

  _randomizeVelocity(e) {
    const speed = this._speedForKind(e.kind);
    // Birds fly freely, others stick to cardinal directions
    if (e.kind === 'bird' || e.kind === 'seagull') {
      const angle = Math.random() * Math.PI * 2;
      e.vx = Math.cos(angle) * speed;
      e.vy = Math.sin(angle) * speed;
    } else {
      // Cardinal direction movement for ground entities
      const dir = Math.floor(Math.random() * 4);
      e.vx = dir === 0 ? speed : dir === 1 ? -speed : 0;
      e.vy = dir === 2 ? speed : dir === 3 ? -speed : 0;
    }
    e.timer = 1.5 + Math.random() * 3;
  }

  update(dt) {
    const grid = this.grid;
    const worldW = grid.width * TILE_PX;
    const worldH = grid.height * TILE_PX;

    for (const e of this.entities) {
      e.timer -= dt;

      // Change direction periodically
      if (e.timer <= 0) {
        this._randomizeVelocity(e);
      }

      const nx = e.x + e.vx * dt;
      const ny = e.y + e.vy * dt;

      // Birds wrap around the screen
      if (e.kind === 'bird' || e.kind === 'seagull') {
        e.x = ((nx % worldW) + worldW) % worldW;
        e.y = ((ny % worldH) + worldH) % worldH;
        continue;
      }

      // Ground entities: check if new position is on a walkable tile
      const col = Math.floor(nx / TILE_PX);
      const row = Math.floor(ny / TILE_PX);
      if (col >= 0 && col < grid.width && row >= 0 && row < grid.height) {
        const cell = row * grid.width + col;
        if (isWalkable(grid.tiles[cell])) {
          e.x = nx;
          e.y = ny;
        } else {
          // Hit a wall, reverse and pick new direction
          this._randomizeVelocity(e);
        }
      } else {
        // Off the map, reverse
        this._randomizeVelocity(e);
      }
    }
  }

  draw(ctx) {
    for (const e of this.entities) {
      const x = Math.round(e.x);
      const y = Math.round(e.y);
      const color = PALETTE[e.color] ?? PALETTE.dark;

      switch (e.kind) {
        case 'pedestrian':
          // Head
          px(ctx, x, y - 3, 2, 2, PALETTE.light);
          // Body
          px(ctx, x, y - 1, 2, 3, color);
          // Legs (animate)
          if (e.vx !== 0 || e.vy !== 0) {
            const step = Math.floor(Date.now() / 200) % 2;
            px(ctx, x - step, y + 2, 1, 1, color);
            px(ctx, x + 1 + step, y + 2, 1, 1, color);
          } else {
            px(ctx, x, y + 2, 2, 1, color);
          }
          break;

        case 'cyclist':
          // Body
          px(ctx, x, y - 2, 2, 2, color);
          // Bike frame
          px(ctx, x - 1, y, 4, 1, PALETTE.mid);
          // Wheels
          px(ctx, x - 1, y + 1, 1, 1, PALETTE.black);
          px(ctx, x + 2, y + 1, 1, 1, PALETTE.black);
          break;

        case 'cat':
          px(ctx, x, y, 3, 2, color);
          // Ears
          px(ctx, x, y - 1, 1, 1, color);
          px(ctx, x + 2, y - 1, 1, 1, color);
          // Tail
          px(ctx, x + 3, y - 1, 1, 2, color);
          break;

        case 'dog':
          px(ctx, x, y, 4, 2, color);
          // Head
          px(ctx, x - 1, y, 1, 2, color);
          // Tail
          px(ctx, x + 4, y, 1, 1, color);
          break;

        case 'bird':
          // Wing flap animation
          const wingPhase = Math.floor(Date.now() / 150) % 3;
          px(ctx, x, y, 2, 1, color);
          if (wingPhase === 0) {
            px(ctx, x - 1, y - 1, 1, 1, color);
            px(ctx, x + 2, y - 1, 1, 1, color);
          } else if (wingPhase === 1) {
            px(ctx, x - 1, y, 1, 1, color);
            px(ctx, x + 2, y, 1, 1, color);
          } else {
            px(ctx, x - 1, y + 1, 1, 1, color);
            px(ctx, x + 2, y + 1, 1, 1, color);
          }
          break;

        case 'pigeon':
          px(ctx, x, y, 2, 2, color);
          px(ctx, x - 1, y + 1, 1, 1, color);
          break;

        case 'seagull':
          px(ctx, x, y, 2, 1, PALETTE.bg);
          const sWing = Math.floor(Date.now() / 200) % 2;
          px(ctx, x - 1, y - sWing, 1, 1, PALETTE.bg);
          px(ctx, x + 2, y - sWing, 1, 1, PALETTE.bg);
          break;
      }
    }
  }
}
