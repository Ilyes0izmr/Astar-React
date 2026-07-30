/**
 * The living sea: moving glints on the water, and the boats that cross it.
 *
 * The still water tile is cached with the rest of the terrain
 * ({@link import('./terrain.js').drawWater}); everything here is repainted every
 * frame on top of it. That split is the whole reason the sea can move at all -
 * baking a shimmer into the terrain cache would mean rebuilding the entire map
 * canvas sixty times a second.
 *
 * Nothing in this file reads a clock of its own. The caller passes `time`, and
 * all randomness comes from the grid's seed through {@link mulberry32} or from
 * {@link hash2}, so the same city always gets the same boats sailing the same
 * lanes - which is what keeps a replay reproducible.
 *
 * @see instruction.md - "Animations"
 */
import { PALETTE, CURRENT_STAGE } from '../core/palette.js';
import { isLit } from '../core/daycycle.js';
import { TILE } from '../core/tiles.js';
import { px, hash2, TILE_PX } from './art.js';
import { mulberry32 } from '../core/rng.js';

/**
 * Draws the moving glints on the water.
 *
 * Each water tile carries at most one dash, and only for part of its cycle, so a
 * bay reads as light catching a ripple here and there rather than as a sheet of
 * moving texture. The phase is offset per tile by its own hash, which is what
 * stops a whole row flashing in unison.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../core/grid.js').Grid} grid
 * @param {number} time - performance.now() milliseconds
 */
export function drawWaterShimmer(ctx, grid, time) {
  const { width, tiles } = grid;
  const lit = isLit(CURRENT_STAGE);
  // Fraction of its cycle a tile spends glinting. After dark the sea only picks
  // out the odd highlight, so the window narrows and the tone switches to
  // whatever the lamps are burning.
  const duty = lit ? 0.16 : 0.34;
  const tone = lit ? PALETTE.glow ?? PALETTE.light : PALETTE.light;
  const spark = lit ? PALETTE.glow ?? PALETTE.bg : PALETTE.bg;

  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] !== TILE.WATER) continue;

    const col = i % width;
    const row = Math.floor(i / width);
    const offset = hash2(col, row, 101);
    const phase = (time / 2600 + offset) % 1;
    if (phase > duty) continue;

    const x = col * TILE_PX;
    const y = row * TILE_PX;
    // The dash drifts sideways across its tile as the phase runs, so the glint
    // travels rather than blinking on the spot.
    const dx = 2 + Math.floor(phase * 22);
    const dy = 4 + Math.floor(hash2(col, row, 102) * 8);
    const len = phase < 0.17 ? 4 : 3;

    px(ctx, x + Math.min(dx, TILE_PX - len - 1), y + dy, len, 1, tone);
    if (hash2(col, row, 103) > 0.82) {
      px(ctx, x + Math.min(dx + 1, TILE_PX - 2), y + dy - 1, 1, 1, spark);
    }
  }
}

/** How many boats a map gets, before the open-water check trims it. */
const FLEET_SIZE = 3;

/**
 * The boats that cross the open sea.
 *
 * Each one owns a lane - a row of open water in the sea band - and sails it at a
 * constant speed, wrapping round when it leaves the far edge. Lanes are chosen
 * once from the grid seed, so a city always has the same traffic.
 */
export class ShipField {
  /**
   * @param {import('../core/grid.js').Grid} grid
   */
  constructor(grid) {
    /** @type {{x: number, row: number, speed: number, len: number, dir: number}[]} */
    this.ships = [];
    this.width = grid.width * TILE_PX;
    if (!grid.frame) return;

    const random = mulberry32((grid.seed ^ 0x5eaf00d) >>> 0);
    const lanes = this.#findLanes(grid);
    if (lanes.length === 0) return;

    for (let i = 0; i < FLEET_SIZE; i++) {
      const row = lanes[Math.floor(random() * lanes.length)];
      const dir = random() > 0.5 ? 1 : -1;
      this.ships.push({
        x: random() * this.width,
        row,
        // Slow, and varied enough that they do not travel as a formation.
        speed: (7 + random() * 9) * dir,
        // Roughly two tiles long. The first version was half this and simply
        // vanished at 1x zoom - a boat has to clear the noise of the water it
        // sits on before it reads as a boat at all.
        len: 26 + Math.floor(random() * 10),
        dir,
      });
    }
  }

  /**
   * Rows in the sea band that are open water the whole way across.
   *
   * A lane with a pier in it would sail a boat straight through the harbour, so
   * any row carrying something solid is rejected outright rather than steered
   * around - there is no room in the band for a boat to manoeuvre.
   */
  #findLanes(grid) {
    const lanes = [];
    for (let row = grid.frame.seaRow + 1; row < grid.height; row++) {
      let clear = true;
      for (let col = 0; col < grid.width; col++) {
        if (grid.tiles[row * grid.width + col] !== TILE.WATER) {
          clear = false;
          break;
        }
      }
      if (clear) lanes.push(row);
    }
    return lanes;
  }

  /**
   * @param {number} dt - seconds since the last frame
   */
  update(dt) {
    if (this.ships.length === 0) return;
    // A backgrounded tab hands back one huge delta; unclamped, the whole fleet
    // teleports several laps downstream on the first frame back.
    const step = Math.min(dt, 0.1);

    for (const ship of this.ships) {
      ship.x += ship.speed * step;
      if (ship.x > this.width + ship.len) ship.x = -ship.len;
      else if (ship.x < -ship.len) ship.x = this.width + ship.len;
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} time - performance.now() milliseconds
   */
  draw(ctx, time) {
    for (let i = 0; i < this.ships.length; i++) {
      const ship = this.ships[i];
      const x = Math.round(ship.x);
      // Each hull bobs on its own offset, so the fleet does not rise and fall
      // as one piece.
      const bob = Math.sin(time / 620 + i * 1.7) > 0 ? 0 : 1;
      const y = ship.row * TILE_PX + 4 + bob;
      this.#hull(ctx, x, y, ship, time, i);
    }
  }

  #hull(ctx, x, y, ship, time, index) {
    const len = ship.len;
    const forward = ship.dir > 0;
    const glow = isLit(CURRENT_STAGE) ? PALETTE.glow : null;

    // Wake, trailing off the stern and flickering so it reads as churn.
    const stern = forward ? x - 9 : x + len + 1;
    const flick = Math.floor(time / 160 + index) % 2;
    px(ctx, stern, y + 7 + flick, 8, 1, PALETTE.bg);
    px(ctx, stern + (forward ? -4 : 4), y + 9 - flick, 5, 1, PALETTE.light);

    // The hull is drawn light-on-dark rather than dark-on-dark. Sitting on deep
    // water, a dark hull with a black outline disappeared entirely; giving the
    // deck the brightest tone and keeping the outline black is what separates a
    // boat from the sea beneath it.
    px(ctx, x, y + 2, len, 9, PALETTE.black);
    px(ctx, x + 1, y + 3, len - 2, 7, PALETTE.light);
    px(ctx, x + 2, y + 7, len - 4, 3, PALETTE.mid);

    // A raked bow, so the boat has a front.
    const bow = forward ? x + len - 3 : x;
    px(ctx, bow, y + 1, 3, 11, PALETTE.black);
    px(ctx, forward ? bow : bow + 1, y + 3, 2, 7, PALETTE.light);

    // Cabin, set back from the bow.
    const cabinX = forward ? x + 5 : x + len - 13;
    px(ctx, cabinX, y - 3, 8, 7, PALETTE.black);
    px(ctx, cabinX + 1, y - 2, 6, 5, PALETTE.mid);
    px(ctx, cabinX + 1, y - 2, 6, 1, PALETTE.light);

    // Two portholes, lit after dark - most of what makes a boat read as crewed
    // rather than as a floating shape.
    px(ctx, cabinX + 2, y - 1, 2, 2, glow ?? PALETTE.bg);
    px(ctx, cabinX + 5, y - 1, 1, 2, glow ?? PALETTE.bg);

    // Mast and a small sail above the cabin.
    px(ctx, cabinX + 3, y - 12, 2, 10, PALETTE.black);
    px(ctx, cabinX + 5, y - 11, 5, 6, PALETTE.black);
    px(ctx, cabinX + 5, y - 10, 4, 4, PALETTE.bg);
  }
}
