import { useEffect, useRef, memo, useState } from 'react';
import PropTypes from 'prop-types';
import { PALETTE } from '../core/palette.js';
import { TILE } from '../core/tiles.js';
import Icon from '../ui/Icon.jsx';

/** Pixels per tile on the minimap. */
const MINI_PX = 4;

/** The minimap redraws at this rate. It carries no fine motion, so 12fps reads
 * as smooth and leaves the frame budget to the main view. */
const REDRAW_MS = 80;

/**
 * The corner minimap.
 *
 * With fog enabled it only draws what the search has actually reached, which is
 * the look the reference dungeon map has: solid where you have been, a dithered
 * fringe at the edge of knowledge, bare parchment beyond. It doubles as a read
 * on the algorithm - DFS leaves a thin worm across the map, Dijkstra floods a
 * disc, A* draws a corridor straight at the goal.
 *
 * @see instruction.md - "Minimap"
 *
 * @component
 */
const Minimap = ({ grid, gridVersion, playbackRef, fog }) => {
  const [visible, setVisible] = useState(true);
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const width = grid.width * MINI_PX;
    const height = grid.height * MINI_PX;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let timer = 0;

    const draw = () => {
      const playback = playbackRef.current;
      const explored = playback?.explored ?? null;

      if (!visible) {
        timer = setTimeout(draw, REDRAW_MS);
        return;
      }

      ctx.fillStyle = PALETTE.bg;
      ctx.fillRect(0, 0, width, height);

      for (let row = 0; row < grid.height; row++) {
        for (let col = 0; col < grid.width; col++) {
          const i = row * grid.width + col;
          const tile = grid.tiles[i];
          const x = col * MINI_PX;
          const y = row * MINI_PX;

          const known = !fog || !explored ? true : isKnown(grid, explored, i);
          if (!known) continue;

          if (tile === TILE.WALL) {
            ctx.fillStyle = PALETTE.mid;
            ctx.fillRect(x, y, MINI_PX, MINI_PX);
          } else {
            ctx.fillStyle = PALETTE.light;
            ctx.fillRect(x, y, MINI_PX, MINI_PX);
          }
        }
      }

      // The path, over the terrain.
      if (playback) {
        const { path } = playback.result;
        const revealed = playback.revealedPathLength;
        ctx.fillStyle = PALETTE.dark;
        for (let k = 0; k < revealed; k++) {
          const cell = path[k];
          ctx.fillRect((cell % grid.width) * MINI_PX, Math.floor(cell / grid.width) * MINI_PX, MINI_PX, MINI_PX);
        }
      }

      // Markers, always visible - you can see the objective from anywhere.
      if (grid.goal >= 0) {
        ctx.fillStyle = PALETTE.black;
        ctx.fillRect(
          (grid.goal % grid.width) * MINI_PX,
          Math.floor(grid.goal / grid.width) * MINI_PX,
          MINI_PX,
          MINI_PX,
        );
      }
      if (grid.start >= 0) {
        ctx.fillStyle = PALETTE.dark;
        ctx.fillRect(
          (grid.start % grid.width) * MINI_PX + 1,
          Math.floor(grid.start / grid.width) * MINI_PX + 1,
          MINI_PX - 2,
          MINI_PX - 2,
        );
      }

      const vehicle = playback?.vehicle;
      if (vehicle) {
        ctx.fillStyle = PALETTE.black;
        ctx.fillRect(
          (vehicle.from % grid.width) * MINI_PX,
          Math.floor(vehicle.from / grid.width) * MINI_PX,
          MINI_PX,
          MINI_PX,
        );
      }

      timer = setTimeout(draw, REDRAW_MS);
    };

    draw();
    return () => clearTimeout(timer);
  }, [grid, gridVersion, playbackRef, fog, visible]);

  return (
    <div className="panel minimap">
      <div className="panel__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        MAP
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}
          title={visible ? 'Hide minimap' : 'Show minimap'}
        >
          <Icon name={visible ? 'fog' : 'fogOff'} size={14} />
        </button>
      </div>
      <canvas ref={canvasRef} className="minimap__canvas" style={{ display: visible ? 'block' : 'none' }} />
    </div>
  );
};

/**
 * Whether a cell should be drawn under fog.
 *
 * Explored road tiles are known outright. Walls are known if the search ever
 * stood next to them - you learn where a building is by walking into it, not by
 * seeing through it. Without that second rule the map would be a ribbon of road
 * floating in empty space with no walls at all.
 */
function isKnown(grid, explored, i) {
  if (explored[i]) return true;
  if (grid.tiles[i] !== TILE.WALL) return false;

  const col = i % grid.width;
  const row = Math.floor(i / grid.width);
  if (row > 0 && explored[i - grid.width]) return true;
  if (row < grid.height - 1 && explored[i + grid.width]) return true;
  if (col > 0 && explored[i - 1]) return true;
  if (col < grid.width - 1 && explored[i + 1]) return true;
  return false;
}

Minimap.propTypes = {
  grid: PropTypes.object.isRequired,
  gridVersion: PropTypes.number.isRequired,
  playbackRef: PropTypes.object.isRequired,
  fog: PropTypes.bool,
};

// Same reasoning as CanvasWorld: it drives itself on a timer, so re-rendering
// it alongside the HUD would only throw away and rebuild that timer.
export default memo(Minimap);
