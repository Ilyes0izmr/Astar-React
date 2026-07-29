# Retro City Pathfinder

A procedurally generated dungeon-city you can watch five pathfinding algorithms
cross, rendered as a monochrome Game Boy-era pixel game.

Roads are corridors, buildings are dungeon walls, intersections are rooms. The
art direction is specified in [`../instruction.md`](../instruction.md); every
pixel on screen is drawn from code, with no image files anywhere in the project.

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run verify` | Correctness checks for the search core (no browser needed) |

## Layout

```
src/
  core/                 no DOM anywhere in here - pure logic
    palette.js          the five colors, and nothing else
    tiles.js            tile ids, movement costs, energy deltas
    grid.js             flat-array grid, neighbours, flood fill
    rng.js              seeded RNG and the five-character seed codes
    citygen.js          road lattice -> courtyards -> closed streets -> markers
    playback.js         replays a finished search on its own clock
    algorithms/
      heap.js           binary min-heap priority queue
      common.js         heuristic, path reconstruction, energy simulation
      bestFirst.js      the engine Dijkstra and A* share
      astar.js  dijkstra.js  bfs.js  dfs.js  greedy.js
      index.js          the registry the UI reads
    verify.mjs          `npm run verify`
  render/               canvas drawing
    art.js              pixel primitives, dither patterns, bracket cursor
    terrain.js          roads, buildings, rooftop clutter, hazards
    sprites.js          markers, vehicle, search overlays
    CanvasWorld.jsx     the world view and its animation loop
    Minimap.jsx         corner map, with optional fog of war
  ui/                   React chrome
    MainMenu.jsx  Hud.jsx  Toolbar.jsx  Compare.jsx  Hearts.jsx
    icons.js            procedural 16x16 icons
    PixelIcon.jsx
  styles/
    tokens.css          palette, type scale, pixel-crisp global rules
    ui.css              panels, buttons, cards, layouts
```

## The algorithms

All five return the same shape - a path, a cost, and the full expansion trace -
so one visualizer drives all of them, and **COMPARE** can run every one on the
same city and tabulate the result.

| | Ranks the frontier by | Optimal? |
| --- | --- | --- |
| **A\*** | `g + h` - cost so far plus a Manhattan estimate | yes |
| **Dijkstra** | `g` - cost so far | yes |
| **BFS** | insertion order | only if all terrain costs are equal |
| **DFS** | most recent first | no |
| **Greedy** | `h` - estimate alone | no |

Terrain carries real weights (road 1, rubble 3, spikes 5), which is what makes
these differ. On a typical map A* and Dijkstra return the identical path while
A* settles roughly a third fewer tiles; BFS finds a route with the same number
of tiles but a higher cost, because it cannot see terrain at all.

**Energy** is a separate resource from movement cost. The search optimizes cost;
the winning path is then replayed through the energy rules, so an optimal route
can still strand the vehicle. That is deliberate - it is the interesting case.

## Controls

Click a brush, then drag on the map to edit it. `SPACE` play/pause, `ENTER`
solve, `R` rewind, `G` new city, `ESC` drop the brush.

Seeds are five characters. The same seed always builds the same city, so a map
worth keeping can be typed back in on the menu.

## Notes

The world canvas scales at whole-number zoom only, so pixels stay exactly square
- on a 1080p display the map renders at 2x, on a 720p one at 1x with the
parchment showing around it.
