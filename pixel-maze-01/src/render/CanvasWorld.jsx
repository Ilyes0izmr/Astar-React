import { useEffect, useRef, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { PALETTE } from '../core/palette.js';
import { TILE } from '../core/tiles.js';
import { TILE_PX, drawBrackets } from './art.js';
import { drawRoad, drawWall, drawHazard, openMask } from './terrain.js';
import {
  drawExplored,
  drawFrontier,
  drawPathTile,
  drawStartFlag,
  drawGoalChest,
  drawVehicle,
  directionBetween,
  DIR,
} from './sprites.js';

/** How often the HUD numbers refresh. Any faster is wasted on the eye. */
const STATS_INTERVAL_MS = 100;

/**
 * The world view.
 *
 * Two canvases do the work. The terrain - roads, buildings, hazards - is
 * expensive to draw and almost never changes, so it lives in an offscreen
 * canvas that is only repainted when the map is edited. The visible canvas
 * blits that in one call each frame and draws the moving layer on top.
 *
 * Nothing in the animation loop touches React state. The frame callback reads
 * the playback object through a ref and mutates the canvas directly; only the
 * HUD numbers cross back into React, throttled to ten updates a second. Driving
 * this through `setState` at 60fps would spend more time reconciling than
 * drawing.
 *
 * The canvas backing store is exactly one pixel per world pixel and CSS scales
 * it by a whole-number factor, so every pixel on screen is the same size. A
 * fractional scale is what makes pixel art look subtly wrong, and this avoids
 * it entirely at the cost of some letterboxing.
 *
 * @component
 */
const CanvasWorld = ({
  grid,
  gridVersion,
  playbackRef,
  playing,
  speed,
  brush,
  onPaint,
  onStats,
}) => {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const terrainRef = useRef(null);

  // Values the animation loop needs to read without being torn down and
  // rebuilt every time one of them changes.
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const hoverRef = useRef(-1);
  const paintingRef = useRef(false);
  const lastDirRef = useRef(DIR.S);
  const statsRef = useRef(onStats);

  playingRef.current = playing;
  speedRef.current = speed;
  // Held in a ref so an inline callback from the parent cannot tear down and
  // restart the animation loop on every render.
  statsRef.current = onStats;

  const worldWidth = grid.width * TILE_PX;
  const worldHeight = grid.height * TILE_PX;

  /** Repaints the cached terrain layer from scratch. */
  const paintTerrain = useCallback(() => {
    let canvas = terrainRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      terrainRef.current = canvas;
    }
    canvas.width = worldWidth;
    canvas.height = worldHeight;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, worldWidth, worldHeight);

    for (let row = 0; row < grid.height; row++) {
      for (let col = 0; col < grid.width; col++) {
        const tile = grid.tiles[row * grid.width + col];
        const x = col * TILE_PX;
        const y = row * TILE_PX;
        const mask = openMask(grid, row, col);

        if (tile === TILE.WALL) {
          drawWall(ctx, x, y, col, row, mask);
        } else {
          drawRoad(ctx, x, y, col, row, mask);
          drawHazard(ctx, x, y, tile);
        }
      }
    }
  }, [grid, worldWidth, worldHeight]);

  // `gridVersion` is the change signal. The tiles live in a mutable typed array
  // that React cannot see into, so the caller bumps this instead.
  useEffect(paintTerrain, [paintTerrain, gridVersion]);

  /** Keeps the CSS size at a whole-number multiple of the world size. */
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return undefined;

    const fit = () => {
      const { width, height } = wrap.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const scale = Math.max(1, Math.floor(Math.min(width / worldWidth, height / worldHeight)));
      canvas.style.width = `${worldWidth * scale}px`;
      canvas.style.height = `${worldHeight * scale}px`;
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [worldWidth, worldHeight]);

  /** The animation loop. Mounted once per map. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    canvas.width = worldWidth;
    canvas.height = worldHeight;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let raf = 0;
    let last = performance.now();
    let statsAt = 0;
    let frames = 0;
    let fpsWindow = 0;
    let fps = 60;

    const frame = (now) => {
      const dt = (now - last) / 1000;
      last = now;

      frames++;
      fpsWindow += dt;
      if (fpsWindow >= 0.5) {
        fps = Math.round(frames / fpsWindow);
        frames = 0;
        fpsWindow = 0;
      }

      const playback = playbackRef.current;
      if (playback && playingRef.current) {
        playback.stepsPerSecond = speedRef.current;
        playback.tick(dt);
      }

      draw(ctx, now, playback);

      if (now - statsAt >= STATS_INTERVAL_MS) {
        statsAt = now;
        statsRef.current?.(playback ? { ...playback.stats, fps } : { fps });
      }

      raf = requestAnimationFrame(frame);
    };

    /** Paints one complete frame. */
    const draw = (context, now, playback) => {
      context.fillStyle = PALETTE.bg;
      context.fillRect(0, 0, worldWidth, worldHeight);
      if (terrainRef.current) context.drawImage(terrainRef.current, 0, 0);

      const cellX = (i) => (i % grid.width) * TILE_PX;
      const cellY = (i) => Math.floor(i / grid.width) * TILE_PX;

      if (playback) {
        // Settled cells.
        const { explored } = playback;
        for (let i = 0; i < explored.length; i++) {
          if (explored[i]) drawExplored(context, cellX(i), cellY(i));
        }

        // Frontier, breathing in unison.
        const pulse = 0.5 + 0.5 * Math.sin(now / 160);
        for (const cell of playback.frontier) {
          drawFrontier(context, cellX(cell), cellY(cell), pulse);
        }

        // The path, as far as it has been drawn in.
        const { path } = playback.result;
        const revealed = playback.revealedPathLength;
        for (let k = 0; k < revealed; k++) {
          const cell = path[k];
          let mask = 0;
          if (k > 0) mask |= sideBetween(grid, cell, path[k - 1]);
          if (k + 1 < revealed) mask |= sideBetween(grid, cell, path[k + 1]);
          drawPathTile(context, cellX(cell), cellY(cell), mask);
        }
      }

      // Markers sit above the overlays so they never get buried.
      const slowPulse = 0.5 + 0.5 * Math.sin(now / 500);
      if (grid.start >= 0) drawStartFlag(context, cellX(grid.start), cellY(grid.start), slowPulse);
      if (grid.goal >= 0) drawGoalChest(context, cellX(grid.goal), cellY(grid.goal), slowPulse);

      const vehicle = playback?.vehicle;
      if (vehicle) {
        if (vehicle.from !== vehicle.to) {
          lastDirRef.current = directionBetween(grid, vehicle.from, vehicle.to);
        }
        const fromX = cellX(vehicle.from);
        const fromY = cellY(vehicle.from);
        const x = Math.round(fromX + (cellX(vehicle.to) - fromX) * vehicle.t);
        const y = Math.round(fromY + (cellY(vehicle.to) - fromY) * vehicle.t);
        drawVehicle(context, x, y, lastDirRef.current, (now / 120) % 1);
      }

      if (hoverRef.current >= 0) {
        drawBrackets(context, cellX(hoverRef.current), cellY(hoverRef.current), PALETTE.black);
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [grid, worldWidth, worldHeight, playbackRef]);

  /** Maps a pointer event to a flat cell index, or -1 if it missed. */
  const cellFromEvent = useCallback(
    (event) => {
      const canvas = canvasRef.current;
      if (!canvas) return -1;
      const rect = canvas.getBoundingClientRect();
      const col = Math.floor(((event.clientX - rect.left) / rect.width) * grid.width);
      const row = Math.floor(((event.clientY - rect.top) / rect.height) * grid.height);
      if (row < 0 || row >= grid.height || col < 0 || col >= grid.width) return -1;
      return row * grid.width + col;
    },
    [grid],
  );

  const handleMove = (event) => {
    const cell = cellFromEvent(event);
    hoverRef.current = cell;
    // Dragging paints a stroke rather than one tile at a time.
    if (paintingRef.current && cell >= 0 && brush !== null) onPaint?.(cell);
  };

  const handleDown = (event) => {
    if (brush === null) return;
    paintingRef.current = true;
    const cell = cellFromEvent(event);
    if (cell >= 0) onPaint?.(cell);
  };

  const stopPainting = () => {
    paintingRef.current = false;
  };

  return (
    <div className="world" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="world__canvas"
        onMouseMove={handleMove}
        onMouseDown={handleDown}
        onMouseUp={stopPainting}
        onMouseLeave={() => {
          hoverRef.current = -1;
          stopPainting();
        }}
      />
    </div>
  );
};

/**
 * Which side of `cell` its neighbour `other` sits on.
 *
 * @returns {number} an {@link import('./terrain.js').OPEN} flag, or 0 if the
 *   two cells are not adjacent
 */
function sideBetween(grid, cell, other) {
  if (other === cell - grid.width) return 1; // N
  if (other === cell + 1) return 2; // E
  if (other === cell + grid.width) return 4; // S
  if (other === cell - 1) return 8; // W
  return 0;
}

CanvasWorld.propTypes = {
  grid: PropTypes.object.isRequired,
  /** Bumped by the owner whenever the tile array is mutated in place. */
  gridVersion: PropTypes.number.isRequired,
  /** Ref holding the current {@link import('../core/playback.js').Playback}, or null. */
  playbackRef: PropTypes.object.isRequired,
  playing: PropTypes.bool,
  speed: PropTypes.number,
  /** The tile id the pointer paints, or null when the editor is off. */
  brush: PropTypes.number,
  onPaint: PropTypes.func,
  onStats: PropTypes.func,
};

// Memoized because the HUD pushes stats back into React ten times a second.
// Without this the world component would re-render at that rate for no reason -
// its canvas work happens entirely inside the animation loop.
export default memo(CanvasWorld);
