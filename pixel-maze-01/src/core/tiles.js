/**
 * Tile vocabulary for the dungeon-city and the landscape around it.
 *
 * The first seven ids are inherited from the original grid so saved layouts and
 * the old editor semantics still line up. The rest are the natural frame -
 * mountains to the north, sea to the south, and the river that runs between
 * them - which exists so the generator has an edge to build against instead of
 * a city that simply stops at the canvas boundary.
 *
 * @see instruction.md - "Design Philosophy"
 */
export const TILE = {
  /** Open corridor. The road surface a vehicle can drive on. */
  FLOOR: 0,
  /** Building block. Impassable, drawn as a rooftop from above. */
  WALL: 1,
  /** Coin pickup. Free to cross and refunds one unit of energy. */
  COIN: 2,
  /** Rubble. Passable but slow. */
  RUBBLE: 3,
  /** Spikes. Passable, slower still, and it hurts. */
  SPIKE: 4,
  /** Start marker. Exactly one per map. */
  START: 5,
  /** Goal marker. Exactly one per map. */
  GOAL: 6,

  /** Sea, and the river. Impassable - cross it on a bridge. */
  WATER: 7,
  /** Beach. Passable, but slow going. */
  SAND: 8,
  /** The range along the north edge. Impassable. */
  MOUNTAIN: 9,
  /** Road carried over water. Passable at normal road cost. */
  BRIDGE: 10,
  /** Harbour decking. Passable, and the only way out onto the water. */
  PIER: 11,
  /** Woodland at the foot of the range. Impassable, and never editable. */
  FOREST: 12,
  /** Railway tracks. Impassable and protected. */
  RAILWAY: 13,
  /** Train station platform. Passable but protected from editing. */
  STATION: 14,
  /** Train station building. Impassable and protected from editing. */
  STATION_BUILDING: 15,
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
  [TILE.WATER]: 'WATER',
  [TILE.SAND]: 'SAND',
  [TILE.MOUNTAIN]: 'MOUNTAIN',
  [TILE.BRIDGE]: 'BRIDGE',
  [TILE.PIER]: 'PIER',
  [TILE.FOREST]: 'FOREST',
  [TILE.RAILWAY]: 'RAILWAY',
  [TILE.STATION]: 'STATION',
  [TILE.STATION_BUILDING]: 'STATION_BUILDING',
};

/**
 * Movement cost of entering a tile. This is the edge weight the weighted
 * algorithms (Dijkstra, A*) minimize.
 *
 * Every finite cost is a positive integer and the cheapest possible move is 1.
 * That lower bound is what makes the Manhattan heuristic admissible - see
 * {@link ./algorithms/common.js}. Do not add a zero-cost or negative-cost tile
 * here without revisiting the heuristic.
 *
 * @param {number} tile - a {@link TILE} id
 * @returns {number} cost to step onto the tile, or Infinity if impassable
 */
export function stepCost(tile) {
  switch (tile) {
    case TILE.WALL:
    case TILE.WATER:
    case TILE.MOUNTAIN:
    case TILE.FOREST:
    case TILE.RAILWAY:
    case TILE.STATION_BUILDING:
      return Infinity;
    case TILE.RUBBLE:
      return 3;
    case TILE.SPIKE:
      return 5;
    case TILE.SAND:
      return 2;
    default:
      // FLOOR, COIN, START, GOAL, BRIDGE and PIER are all road underneath.
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
    case TILE.SAND:
      return -1;
    case TILE.SPIKE:
      return -2;
    default:
      return 0;
  }
}

/** @param {number} tile @returns {boolean} true if a vehicle may enter. */
export function isWalkable(tile) {
  return stepCost(tile) !== Infinity;
}

/**
 * Whether a tile is built mass rather than open ground.
 *
 * Water is impassable but it is not *solid* - it takes no outline, casts no
 * shadow and has no parapet. Keeping the two ideas apart is what stops the sea
 * being drawn as one enormous building.
 *
 * @param {number} tile
 * @returns {boolean}
 */
export function isSolid(tile) {
  return tile === TILE.WALL || tile === TILE.MOUNTAIN || tile === TILE.FOREST || tile === TILE.STATION_BUILDING;
}

/**
 * Whether a tile is part of the permanent landscape rather than the city.
 *
 * These are the surfaces the brush must refuse. The ocean, the harbour, the
 * range and the woodland below it are the frame the city is built inside - they
 * are what stops the map being an unbounded grid, so letting a stray click
 * dissolve the coastline would take the world's shape with it.
 *
 * The beach is deliberately absent: sand is a normal brush, and painting a cove
 * along the shore is exactly the kind of edit the frame is meant to invite.
 *
 * @param {number} tile
 * @returns {boolean}
 */
export function isProtected(tile) {
  return (
    tile === TILE.WATER ||
    tile === TILE.MOUNTAIN ||
    tile === TILE.FOREST ||
    tile === TILE.PIER ||
    tile === TILE.BRIDGE ||
    tile === TILE.RAILWAY ||
    tile === TILE.STATION ||
    tile === TILE.STATION_BUILDING
  );
}

/** @param {number} tile @returns {boolean} true for sea, river or harbour water. */
export function isWater(tile) {
  return tile === TILE.WATER;
}
