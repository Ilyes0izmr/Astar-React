/**
 * Playback of a completed search.
 *
 * The algorithms run to completion in well under a millisecond - the animation
 * is a *replay* of the trace they recorded, not the search itself. Separating
 * the two is what makes the speed slider possible: dragging it re-times the
 * replay instead of re-running anything, and the answer on screen never changes
 * halfway through.
 *
 * The original code interleaved `await setTimeout` with grid mutation inside a
 * React effect, which meant a re-render mid-animation left the board in a torn
 * state. This owns its own clock and mutates nothing outside itself.
 */
import { simulateEnergy } from './algorithms/common.js';
import { TILE } from './tiles.js';

/** @enum {string} */
export const PHASE = {
  /** Nothing to show yet. */
  IDLE: 'idle',
  /** Replaying the expansion trace. */
  SEARCH: 'search',
  /** Drawing the final path in, tile by tile. */
  TRACE: 'trace',
  /** Vehicle driving the path. */
  DRIVE: 'drive',
  /** Finished, one way or another. */
  DONE: 'done',
};

/** Tiles per second the vehicle drives at. Independent of the search speed. */
const DRIVE_SPEED = 7;

/** The path draws in at this multiple of the search speed, with a floor. */
const TRACE_SPEED_FACTOR = 3;
const TRACE_SPEED_MIN = 30;

export class Playback {
  /**
   * @param {import('./grid.js').Grid} grid
   * @param {import('./algorithms/common.js').SearchResult} result
   * @param {{energy?: number, stepsPerSecond?: number}} [options]
   */
  constructor(grid, result, options = {}) {
    this.grid = grid;
    this.result = result;
    this.stepsPerSecond = options.stepsPerSecond ?? 60;

    const maxEnergy = options.energy ?? 10;
    this.maxEnergy = maxEnergy;
    /** Energy level on arriving at each path tile, plus where it ran out. */
    this.energy = simulateEnergy(grid, result.path, maxEnergy, maxEnergy);

    this.explored = new Uint8Array(grid.tiles.length);
    this.reset();
  }

  /** Rewinds to the very start. Cheap enough to call every frame if needed. */
  reset() {
    this.explored.fill(0);
    this.appliedSteps = 0;
    this.stepCursor = 0;
    this.traceCursor = 0;
    this.driveCursor = 0;
    this.drivenTo = -1;
    this.passed = this.passed ?? new Uint8Array(this.grid.tiles.length);
    this.passed.fill(0);
    this.pickups = [];
    this.phase = this.result.steps.length > 0 ? PHASE.SEARCH : PHASE.DONE;
  }

  /**
   * Marks every path tile the vehicle has now reached.
   *
   * Called as the drive advances so pickups can be consumed exactly once. The
   * cursor is a float and a fast replay can cross several tiles in one frame,
   * so this walks from wherever it left off rather than looking only at the
   * tile under the vehicle - otherwise a coin gets skipped at high speed.
   */
  #advanceDriven() {
    const path = this.result.path;
    const limit = Math.min(Math.floor(this.driveCursor), path.length - 1);
    while (this.drivenTo < limit) {
      this.drivenTo++;
      const cell = path[this.drivenTo];
      if (this.passed[cell]) continue;
      this.passed[cell] = 1;
      if (this.grid.tiles[cell] === TILE.COIN) this.pickups.push(cell);
    }
  }

  /**
   * Drains the coins collected since the last call.
   *
   * The renderer uses this to fire a burst once per pickup. Draining rather
   * than exposing the list keeps the "exactly once" guarantee here instead of
   * asking every caller to remember what it has already seen.
   *
   * @returns {number[]} flat cell indices
   */
  takePickups() {
    if (this.pickups.length === 0) return this.pickups;
    const out = this.pickups;
    this.pickups = [];
    return out;
  }

  /**
   * Whether the vehicle has already driven over a cell.
   *
   * @param {number} cell
   * @returns {boolean}
   */
  hasPassed(cell) {
    return this.passed[cell] === 1;
  }

  /** Skips straight to the end state, with the full path and no animation. */
  finish() {
    for (const step of this.result.steps) this.explored[step.cell] = 1;
    this.appliedSteps = this.result.steps.length;
    this.stepCursor = this.appliedSteps;
    this.traceCursor = this.result.path.length;
    this.driveCursor = Math.max(0, this.#driveLimit());
    this.#advanceDriven();
    // Nothing watched these go by, so there is no burst to fire for them.
    this.pickups = [];
    this.phase = PHASE.DONE;
  }

  /** The path index the vehicle may not drive past - the goal, or the stall. */
  #driveLimit() {
    const { stalledAt } = this.energy;
    return stalledAt >= 0 ? stalledAt : this.result.path.length - 1;
  }

  /**
   * Advances the replay.
   *
   * @param {number} dt - seconds since the previous tick
   */
  tick(dt) {
    // A tab that was backgrounded returns a huge dt. Clamping stops the replay
    // from teleporting to the end the moment the user comes back.
    const delta = Math.min(dt, 0.1);

    if (this.phase === PHASE.SEARCH) {
      this.stepCursor += delta * this.stepsPerSecond;
      const target = Math.min(this.result.steps.length, Math.floor(this.stepCursor));
      while (this.appliedSteps < target) {
        this.explored[this.result.steps[this.appliedSteps].cell] = 1;
        this.appliedSteps++;
      }
      if (this.appliedSteps >= this.result.steps.length) {
        this.phase = this.result.found ? PHASE.TRACE : PHASE.DONE;
      }
      return;
    }

    if (this.phase === PHASE.TRACE) {
      const traceSpeed = Math.max(TRACE_SPEED_MIN, this.stepsPerSecond * TRACE_SPEED_FACTOR);
      this.traceCursor += delta * traceSpeed;
      if (this.traceCursor >= this.result.path.length) {
        this.traceCursor = this.result.path.length;
        this.phase = this.result.path.length > 1 ? PHASE.DRIVE : PHASE.DONE;
      }
      return;
    }

    if (this.phase === PHASE.DRIVE) {
      this.driveCursor += delta * DRIVE_SPEED;
      const limit = this.#driveLimit();
      if (this.driveCursor >= limit) {
        this.driveCursor = limit;
        this.phase = PHASE.DONE;
      }
      this.#advanceDriven();
    }
  }

  /** @returns {boolean} true once the replay has nothing left to show. */
  get isComplete() {
    return this.phase === PHASE.DONE;
  }

  /** The cells currently queued but not yet expanded. */
  get frontier() {
    if (this.appliedSteps === 0) return [];
    if (this.phase !== PHASE.SEARCH) return [];
    return this.result.steps[this.appliedSteps - 1].frontier;
  }

  /** How much of the final path has been drawn in, as a tile count. */
  get revealedPathLength() {
    if (this.phase === PHASE.SEARCH) return 0;
    return Math.min(this.result.path.length, Math.floor(this.traceCursor));
  }

  /**
   * Where the vehicle is right now.
   *
   * @returns {{from: number, to: number, t: number}|null} the two cells it is
   *   between and how far along, or null when it is not on the road
   */
  get vehicle() {
    if (this.phase !== PHASE.DRIVE && this.phase !== PHASE.DONE) return null;
    const path = this.result.path;
    if (path.length === 0) return null;

    const limit = this.#driveLimit();
    const clamped = Math.min(this.driveCursor, limit);
    const i = Math.min(Math.floor(clamped), path.length - 1);
    const next = Math.min(i + 1, path.length - 1);
    return { from: path[i], to: path[next], t: clamped - i };
  }

  /** Energy remaining right now, tracking the vehicle's position. */
  get currentEnergy() {
    const { levels } = this.energy;
    if (levels.length === 0) return this.maxEnergy;
    if (this.phase === PHASE.SEARCH || this.phase === PHASE.TRACE) return levels[0];
    const i = Math.min(Math.floor(this.driveCursor), levels.length - 1);
    return levels[i];
  }

  /**
   * Numbers for the HUD.
   *
   * @returns {{phase: string, steps: number, visited: number, frontier: number,
   *            found: boolean, cost: number, pathLength: number,
   *            energy: number, maxEnergy: number, stalled: boolean}}
   */
  get stats() {
    const frontierSize = this.frontier.length;
    return {
      phase: this.phase,
      steps: this.appliedSteps,
      // "Visited" counts every cell the search has touched, settled or queued.
      visited: this.appliedSteps + frontierSize,
      frontier: frontierSize,
      found: this.result.found,
      cost: this.result.cost,
      pathLength: this.result.path.length,
      energy: this.currentEnergy,
      maxEnergy: this.maxEnergy,
      stalled: this.energy.stalledAt >= 0,
    };
  }
}
