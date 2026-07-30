/**
 * The landscape the city is built inside.
 *
 * Mountains close the north edge, the sea closes the south, and a river runs
 * from one to the other. The point is not decoration: it gives the generator a
 * boundary to build *against*. Before this, the road lattice ran to the canvas
 * edge and the city read as a texture someone had cropped. Framed, it reads as
 * a place.
 *
 * The order the pieces are laid down matters and is not interchangeable:
 *
 *   1. the frame is carved first, which hands back the interior rectangle
 *   2. the city is generated inside that rectangle only
 *   3. the river is cut through the finished city
 *   4. bridges are restored at every main street the river crossed
 *
 * Cutting the river last and repairing afterwards is deliberate. Routing a
 * river around a street plan produces something that looks like a canal; cutting
 * it through and bridging the damage produces a city that grew around a river,
 * which is what actually happens.
 *
 * @see instruction.md - "City Style"
 */
import { TILE, isWalkable } from './tiles.js';
import { idx } from './grid.js';

/**
 * @typedef {Object} Frame
 * @property {number} r0 - first interior row (below the mountains)
 * @property {number} c0
 * @property {number} r1 - last interior row (above the beach)
 * @property {number} c1
 * @property {number} mountainRows
 * @property {number} beachRow - first row of sand
 * @property {number} seaRow - first row of open water
 */

/**
 * How much of the map each band of landscape takes.
 *
 * Both bands were originally half this and neither worked. Three rows of
 * mountain cannot carry a ridge profile - every column ends up the same height
 * and the range reads as a textured stripe. Four rows of sea left no row clear
 * of the harbour, so the boats had nowhere to sail. Depth is what makes each of
 * them read as landscape rather than as a border.
 */
export const FRAME = {
  mountainRows: 6,
  /** Woodland between the rock and the first street. */
  forestRows: 3,
  beachRows: 2,
  seaRows: 7,
};

/**
 * Fills in the mountains, the beach and the sea, and reports what is left.
 *
 * @param {import('./grid.js').Grid} grid - mutated
 * @param {ReturnType<typeof import('./rng.js').createRng>} rng
 * @returns {Frame} the rectangle the city may use
 */
export function carveFrame(grid, rng) {
  const { width, height } = grid;
  const seaRow = height - FRAME.seaRows;
  const beachRow = seaRow - FRAME.beachRows;

  // The range gets a real profile: a random walk across the columns, so peaks
  // and saddles run into each other instead of every column being the same
  // height. Walking the height rather than rolling it per column is the whole
  // trick - independent rolls give a comb, and a comb does not read as rock.
  let ridge = FRAME.mountainRows - 1;
  // The treeline runs its own walk, offset from the ridge, so the woodland is
  // not a constant-thickness collar traced around the rock. Where the two get
  // close the forest climbs the slope; where they part it spills toward the
  // city, and that interlocking is what makes the two bands read as one
  // landscape instead of two stacked stripes.
  let tree = FRAME.mountainRows + FRAME.forestRows - 1;

  for (let c = 0; c < width; c++) {
    ridge = Math.max(2, Math.min(FRAME.mountainRows, ridge + rng.int(-1, 1)));
    for (let r = 0; r < ridge; r++) grid.tiles[idx(grid, r, c)] = TILE.MOUNTAIN;

    tree = Math.max(ridge + 1, Math.min(FRAME.mountainRows + FRAME.forestRows, tree + rng.int(-1, 1)));
    for (let r = ridge; r < tree; r++) grid.tiles[idx(grid, r, c)] = TILE.FOREST;

    // The shoreline wanders by a row for the same reason.
    const shore = beachRow + (rng.chance(0.3) ? 1 : 0);
    for (let r = shore; r < seaRow; r++) grid.tiles[idx(grid, r, c)] = TILE.SAND;
    for (let r = seaRow; r < height; r++) grid.tiles[idx(grid, r, c)] = TILE.WATER;
  }

  return {
    r0: FRAME.mountainRows + FRAME.forestRows + 1,
    c0: 0,
    r1: beachRow - 1,
    c1: width - 1,
    mountainRows: FRAME.mountainRows,
    forestRow: FRAME.mountainRows,
    beachRow,
    seaRow,
  };
}

/**
 * Carves a train station between the mountains and the city.
 *
 * Layout (top to bottom):
 *   - Forest row(s) (already placed by carveFrame)
 *   - Station building (1 row of STATION_BUILDING tiles)
 *   - Railway tracks (2 rows of RAILWAY tiles)
 *   - Station platform (1 row of STATION tiles, centered, ~60% width)
 *
 * The station sits just below the forest, replacing what would otherwise
 * be the first row of city. The tracks span the full width; the platform
 * is narrower and centered.
 *
 * @param {import('./grid.js').Grid} grid - mutated
 * @param {Frame} frame
 */
export function carveStation(grid, frame) {
  const { width } = grid;
  // Two rows of railway tracks at the bottom of the forest zone
  const trackRow1 = frame.r0 - 2;
  const trackRow2 = frame.r0 - 1;

  if (trackRow1 < 2) return; // Need room above

  for (let c = 0; c < width; c++) {
    // Replace forest/wall with tracks
    grid.tiles[idx(grid, trackRow1, c)] = TILE.RAILWAY;
    grid.tiles[idx(grid, trackRow2, c)] = TILE.RAILWAY;
  }

  // Station platform on the first city row, centered, about 60% width
  const platformRow = frame.r0;
  const margin = Math.floor(width * 0.2);
  for (let c = margin; c < width - margin; c++) {
    grid.tiles[idx(grid, platformRow, c)] = TILE.STATION;
  }

  // Station building above the tracks
  const buildingRow = frame.r0 - 3;
  if (buildingRow > 0) {
    for (let c = margin; c < width - margin; c++) {
      grid.tiles[idx(grid, buildingRow, c)] = TILE.STATION_BUILDING;
    }
  }
}

/**
 * Cuts a river from the foot of the mountains to the sea.
 *
 * A downward random walk, one tile wide, widening as it nears the mouth. Where
 * it steps sideways the intervening tile is carved too - without that the river
 * would be a chain of diagonally touching cells, which reads as a dotted line
 * and, worse, would let the pathfinder walk straight through it, since movement
 * here is four-directional.
 *
 * @param {import('./grid.js').Grid} grid - mutated
 * @param {Frame} frame
 * @param {ReturnType<typeof import('./rng.js').createRng>} rng
 * @returns {number[]} the flat indices of every river tile, top to bottom
 */
export function carveRiver(grid, frame, rng) {
  const { width } = grid;
  const cells = [];
  // Kept off the edges so both banks have room for a city.
  let col = rng.int(4, Math.max(4, width - 5));

  const wet = (r, c) => {
    if (c < 0 || c >= width) return;
    const i = idx(grid, r, c);
    // Never dig away the shoreline - the beach is what makes the mouth read as
    // a mouth rather than the river simply stopping.
    if (grid.tiles[i] === TILE.SAND) return;
    grid.tiles[i] = TILE.WATER;
    cells.push(i);
  };

  for (let row = frame.mountainRows - 1; row < frame.beachRow; row++) {
    wet(row, col);

    // Widens toward the mouth, the way a river actually does.
    if (row > frame.beachRow - 4) wet(row, col + 1);

    const shift = rng.int(-1, 1);
    if (shift === 0) continue;
    const next = Math.max(1, Math.min(width - 2, col + shift));
    for (let c = Math.min(col, next); c <= Math.max(col, next); c++) wet(row, c);
    col = next;
  }

  return cells;
}

/**
 * Puts the streets back across the river.
 *
 * Every main street the river cut is given a bridge. That is a lot of bridges
 * for a small map, and it is the right number: the alternative is picking a few
 * "good" crossings and hoping the rest of the grid survives, which strands
 * whole districts on the wrong bank. Bridging at each arterial guarantees both
 * banks stay connected no matter where the walk wandered.
 *
 * @param {import('./grid.js').Grid} grid - mutated
 * @param {Frame} frame
 * @param {number[]} river - from {@link carveRiver}
 * @param {number} period - the road lattice spacing
 * @returns {number} how many bridges were built
 */
export function buildBridges(grid, frame, river, period) {
  const { width } = grid;
  let built = 0;

  for (const cell of river) {
    const row = Math.floor(cell / width);
    const col = cell % width;
    if (row < frame.r0 || row > frame.r1) continue;

    const onStreetRow = (row - frame.r0) % period === 0;
    const onStreetCol = (col - frame.c0) % period === 0;
    if (!onStreetRow && !onStreetCol) continue;

    // Only bridge where there is actually something to join on both banks.
    const eastWest =
      col > 0 && col < width - 1 && isBank(grid, cell - 1) && isBank(grid, cell + 1);
    const northSouth = isBank(grid, cell - width) && isBank(grid, cell + width);
    if (!eastWest && !northSouth) continue;

    grid.tiles[cell] = TILE.BRIDGE;
    built++;
  }

  return built;
}

/** A tile a bridge could land on: dry ground the vehicle can use. */
function isBank(grid, cell) {
  if (cell < 0 || cell >= grid.tiles.length) return false;
  const tile = grid.tiles[cell];
  return tile !== TILE.WATER && isWalkable(tile);
}

/**
 * Builds the harbour in the south-west.
 *
 * A quay along the top of the water with fingers running out into it. The piers
 * are walkable, so they are genuine dead ends the search can wander down - which
 * is exactly the sort of trap that makes greedy and DFS look different from A*.
 *
 * @param {import('./grid.js').Grid} grid - mutated
 * @param {Frame} frame
 * @param {ReturnType<typeof import('./rng.js').createRng>} rng
 * @returns {{quayRow: number, piers: number[]}} the quay row and pier columns
 */
export function buildPort(grid, frame, rng) {
  const { width, height } = grid;
  const quayRow = frame.seaRow;
  const quayEnd = Math.min(width - 2, Math.floor(width * 0.45));
  const piers = [];

  for (let c = 1; c <= quayEnd; c++) grid.tiles[idx(grid, quayRow, c)] = TILE.PIER;

  // Fingers, spaced so there is always open water to moor against between them.
  // They are held back from the bottom rows on purpose: those are the shipping
  // lanes, and a jetty reaching into one leaves the fleet with nowhere to sail.
  const maxReach = Math.max(1, height - quayRow - 3);
  for (let c = 2; c <= quayEnd - 2; c += 3) {
    const len = rng.int(1, maxReach);
    for (let r = quayRow + 1; r <= quayRow + len; r++) {
      grid.tiles[idx(grid, r, c)] = TILE.PIER;
    }
    piers.push(c);
  }

  // The quay is useless if you cannot reach it, so open a way up through the
  // beach onto dry land.
  const ramp = Math.max(1, Math.min(quayEnd, rng.int(2, Math.max(2, quayEnd - 2))));
  for (let r = frame.r1 + 1; r < quayRow; r++) {
    const i = idx(grid, r, ramp);
    if (grid.tiles[i] === TILE.WATER) break;
    grid.tiles[i] = TILE.SAND;
  }

  return { quayRow, piers };
}

/**
 * Opens the beach up to the city.
 *
 * The last row of the street plan sits against the sand, and without this the
 * two never touch - the shoreline becomes scenery behind a wall of buildings
 * rather than somewhere the search can actually go.
 *
 * @param {import('./grid.js').Grid} grid - mutated
 * @param {Frame} frame
 * @param {number} period - the road lattice spacing
 */
export function openShoreline(grid, frame, period) {
  for (let c = frame.c0; c <= frame.c1; c += period) {
    for (let r = frame.r1; r < frame.beachRow + FRAME.beachRows; r++) {
      const i = idx(grid, r, c);
      if (grid.tiles[i] === TILE.WATER) break;
      if (grid.tiles[i] === TILE.MOUNTAIN) break;
      if (grid.tiles[i] === TILE.WALL) grid.tiles[i] = TILE.FLOOR;
    }
  }
}

/**
 * Places a lighthouse on the eastern shore.
 *
 * The lighthouse sits on a small pier jutting into the water from the
 * sand, on the opposite side of the harbour. Its presence is recorded
 * on the grid so the renderer can find it.
 *
 * @param {import('./grid.js').Grid} grid - mutated
 * @param {Frame} frame
 */
export function placeLighthouse(grid, frame) {
  const { width } = grid;
  // Place it in the middle of the ocean
  const col = Math.floor(width / 2);
  const row = Math.floor((frame.seaRow + grid.height) / 2);

  // Lighthouse base: 2x2 block, protected (exactly 4 pixels)
  for (let r = row; r <= row + 1; r++) {
    for (let c = col; c <= col + 1; c++) {
      if (r >= 0 && r < grid.height && c >= 0 && c < width) {
        grid.tiles[idx(grid, r, c)] = TILE.WALL;
      }
    }
  }

  // Record position for the renderer
  grid.lighthouse = { row, col, width: 2, height: 2 };
}
