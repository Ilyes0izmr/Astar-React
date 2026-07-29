/**
 * Tile vocabulary for the dungeon-city.
 *
 * The numeric ids are inherited from the original grid so saved layouts and the
 * old editor semantics still line up. What changed is the meaning: the city is
 * a dungeon now, so roads are corridors and buildings are walls.
 *
 * @see instruction.md - "Design Philosophy"
 */
export const TILE = {
  /** Open corridor. The road surface a vehicle can drive on. */
  FLOOR: 0,
  /** Building block. Impassable, drawn as a pixel-art dungeon wall. */
  WALL: 1,
  /** Coin pickup. Free to cross and refunds one unit of energy. */
  COIN: 2,
  /** Rubble. Passable but slow. */
  RUBBLE: 3,
  /** Spikes. Passable, slower still, and hurts. */
  SPIKE: 4,
  /** Start marker. Exactly one per map. */
  START: 5,
  /** Goal marker. Exactly one per map. */
  GOAL: 6,
};

/** Human-readable names, used by the editor palette and tooltips. */
export const TILE_NAME = {
  [TILE.FLOOR]: 'ROAD',
  [TILE.WALL]: 'WALL',
  [TILE.COIN]: 'COIN',
  [TILE.RUBBLE]: 'RUBBLE',
  [TILE.SPIKE]: 'SPIKE',
  [TILE.START]: 'START',
  [TILE.GOAL]: 'GOAL',
};

/**
 * Movement cost of entering a tile. This is the edge weight the weighted
 * algorithms (Dijkstra, A*) minimize.
 *
 * Every cost is a positive integer and the cheapest possible move is 1. That
 * lower bound is what makes the Manhattan heuristic admissible - see
 * {@link ./algorithms/heuristics.js}. Do not add a zero-cost or negative-cost
 * tile here without revisiting the heuristic.
 *
 * @param {number} tile - a {@link TILE} id
 * @returns {number} cost to step onto the tile, or Infinity if impassable
 */
export function stepCost(tile) {
  switch (tile) {
    case TILE.WALL:
      return Infinity;
    case TILE.RUBBLE:
      return 3;
    case TILE.SPIKE:
      return 5;
    default:
      // FLOOR, COIN, START and GOAL are all plain road underneath.
      return 1;
  }
}

/** The cheapest edge in the graph. The heuristic scales by this. */
export const MIN_STEP_COST = 1;

/**
 * Energy change from standing on a tile. Negative drains, positive restores.
 *
 * Energy is deliberately a *separate* quantity from {@link stepCost}: the
 * algorithms optimize for cost, then we replay the winning path through this
 * function to see whether the vehicle actually survives it. Keeping the two
 * apart is what lets a path be optimal and still fail on fuel, which is the
 * interesting case to visualize.
 *
 * @param {number} tile - a {@link TILE} id
 * @returns {number} energy delta applied on entering the tile
 */
export function energyDelta(tile) {
  switch (tile) {
    case TILE.COIN:
      return +1;
    case TILE.RUBBLE:
      return -1;
    case TILE.SPIKE:
      return -2;
    default:
      return 0;
  }
}

/** @param {number} tile @returns {boolean} true if a vehicle may enter. */
export function isWalkable(tile) {
  return tile !== TILE.WALL;
}
