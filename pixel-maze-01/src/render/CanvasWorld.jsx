import { useEffect, useRef, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { PALETTE, CURRENT_STAGE, applyStage } from '../core/palette.js';
import { TILE } from '../core/tiles.js';
import { isLit, stageAt } from '../core/daycycle.js';
import { TILE_PX, drawBrackets, hash2 } from './art.js';
import { drawRoad, drawHazard, drawBuildingTile, drawShadowPass, openMask } from './terrain.js';
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
import { drawCoin, drawSparkle, drawStreetLamp, drawStars, ParticleField } from './effects.js';
import { createViewport } from './viewport.js';

/** How often the HUD numbers refresh. Any faster is wasted on the eye. */
const STATS_INTERVAL_MS = 100;

/**
 * The world view.
 *
 * ## Two canvases
 *
 * The terrain - roads, cast shadows, buildings, hazards - is expensive and
 * changes rarely, so it lives in an offscreen canvas repainted only when the
 * map or the hour changes. The visible canvas blits it in one call per frame
 * and draws everything that moves on top.
 *
 * The hour matters as much as the map here: every color in the cache comes from
 * the live palette, so moving the day slider invalidates the terrain exactly
 * like editing a wall does.
 *
 * ## Draw order
 *
 * The order below is load-bearing, not incidental:
 *
 *   backdrop -> stars -> roads -> SHADOWS -> buildings -> hazards
 *      -> explored -> frontier -> path -> coins -> lamps
 *      -> markers -> vehicle -> particles -> cursor
 *
 * Shadows go down after the roads and before the buildings. That single choice
 * is what removes the need to clip them: a shadow that falls on another
 * building is simply painted over when that building is drawn a moment later.
 * Move the shadow pass after the buildings and every block gets a smear across
 * its roof.
 *
 * ## Why none of this is React state
 *
 * The frame callback reads the playback object through a ref and mutates the
 * canvas directly. Only the HUD numbers cross back into React, throttled to ten
 * updates a second. Driving a 60fps canvas through `setState` would spend more
 * time reconciling than drawing.
 *
 * ## Pixel scaling
 *
 * The backing store is exactly one pixel per world pixel and CSS scales it by a
 * whole number, so every pixel on screen is the same size. Fractional scaling
 * resamples and makes some pixels wider than others, which is the one thing
 * that reliably makes pixel art look wrong. {@link createViewport} enforces it.
 *
 * @component
 */
const CanvasWorld = ({
  grid,
  gridVersion,
  stageIndex,
  playbackRef,
  playing,
  speed,
  brush,
  onPaint,
  onStats,
  onViewport,
  viewportRef,
}) => {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const terrainRef = useRef(null);
  const particlesRef = useRef(null);

  // Values the animation loop reads without being torn down and rebuilt every
  // time one of them changes.
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const brushRef = useRef(brush);
  const hoverRef = useRef(-1);
  const paintingRef = useRef(false);
  const panningRef = useRef(null);
  const lastDirRef = useRef(DIR.S);
  const statsRef = useRef(onStats);
  const viewportStatsRef = useRef(onViewport);
  const lastGoalRef = useRef(false);

  playingRef.current = playing;
  speedRef.current = speed;
  brushRef.current = brush;
  // Held in refs so an inline callback from the parent cannot tear down and
  // restart the animation loop on every render.
  statsRef.current = onStats;
  viewportStatsRef.current = onViewport;

  const worldWidth = grid.width * TILE_PX;
  const worldHeight = grid.height * TILE_PX;

  if (!particlesRef.current) particlesRef.current = new ParticleField();

  /**
   * Repaints the cached terrain layer from scratch.
   *
   * This applies the time of day itself rather than trusting a parent effect to
   * have done it. React runs child effects before parent ones, so an `applyStage`
   * living in App would land *after* this repaint and bake the previous hour's
   * colors into the cache - the map would sit one stage behind the slider until
   * something else invalidated it. Applying it here makes the ordering
   * impossible to get wrong; the call is idempotent, so App applying it again
   * for the CSS variables costs nothing.
   */
  const paintTerrain = useCallback(() => {
    applyStage(stageAt(stageIndex));

    let canvas = terrainRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      terrainRef.current = canvas;
    }
    canvas.width = worldWidth;
    canvas.height = worldHeight;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, worldWidth, worldHeight);
    drawStars(ctx, worldWidth, worldHeight, CURRENT_STAGE);

    for (let row = 0; row < grid.height; row++) {
      for (let col = 0; col < grid.width; col++) {
        const tile = grid.tiles[row * grid.width + col];
        if (tile === TILE.WALL) continue;
        drawRoad(ctx, col * TILE_PX, row * TILE_PX, col, row, openMask(grid, row, col));
      }
    }

    drawShadowPass(ctx, grid, CURRENT_STAGE);

    const owner = grid.buildings?.ownerOf;
    const list = grid.buildings?.list;
    for (let row = 0; row < grid.height; row++) {
      for (let col = 0; col < grid.width; col++) {
        const cell = row * grid.width + col;
        const tile = grid.tiles[cell];
        const x = col * TILE_PX;
        const y = row * TILE_PX;

        if (tile === TILE.WALL) {
          const building = owner && owner[cell] >= 0 ? list[owner[cell]] : null;
          drawBuildingTile(ctx, grid, cell, x, y, openMask(grid, row, col), building);
        } else {
          // Coins are deliberately absent here - they spin, so they belong to
          // the animated layer below.
          drawHazard(ctx, x, y, tile);
        }
      }
    }
  }, [grid, worldWidth, worldHeight, stageIndex]);

  // `gridVersion` is the change signal for the tiles, which live in a mutable
  // typed array React cannot see into. `stageIndex` is the other one: the cache
  // holds baked palette colors, so a new hour is a full repaint.
  useEffect(paintTerrain, [paintTerrain, gridVersion]);

  /**
   * Creates the viewport and refits it whenever the container resizes.
   *
   * The CSS size and pan transform are *not* applied here - the frame loop does
   * that, with a dirty check. Zoom can be changed from a toolbar button, a
   * scroll wheel or a resize, and having one place read the viewport and push
   * it to the DOM is far less fragile than making every one of those callers
   * remember to sync.
   */
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;

    const viewport = createViewport(worldWidth, worldHeight);
    viewportRef.current = viewport;

    const refit = () => {
      const { width, height } = wrap.getBoundingClientRect();
      if (width > 0 && height > 0) viewport.clamp(width, height);
    };

    const { width, height } = wrap.getBoundingClientRect();
    viewport.fit(width || 1, height || 1);

    const observer = new ResizeObserver(refit);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [worldWidth, worldHeight, viewportRef]);

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

    const cellX = (i) => (i % grid.width) * TILE_PX;
    const cellY = (i) => Math.floor(i / grid.width) * TILE_PX;

    /** Paints one complete frame. */
    const draw = (now, dt, playback) => {
      const particles = particlesRef.current;
      const lit = isLit(CURRENT_STAGE);

      ctx.fillStyle = PALETTE.backdrop;
      ctx.fillRect(0, 0, worldWidth, worldHeight);
      if (terrainRef.current) ctx.drawImage(terrainRef.current, 0, 0);

      if (playback) {
        const { explored } = playback;
        for (let i = 0; i < explored.length; i++) {
          if (explored[i]) drawExplored(ctx, cellX(i), cellY(i));
        }

        const pulse = 0.5 + 0.5 * Math.sin(now / 160);
        for (const cell of playback.frontier) {
          drawFrontier(ctx, cellX(cell), cellY(cell), pulse);
        }

        const { path } = playback.result;
        const revealed = playback.revealedPathLength;
        for (let k = 0; k < revealed; k++) {
          const cell = path[k];
          let mask = 0;
          if (k > 0) mask |= sideBetween(grid, cell, path[k - 1]);
          if (k + 1 < revealed) mask |= sideBetween(grid, cell, path[k + 1]);
          drawPathTile(ctx, cellX(cell), cellY(cell), mask);
        }

        // A spark runs along the head of the path as it draws in, so the reveal
        // reads as motion rather than tiles appearing.
        if (revealed > 0 && revealed < path.length) {
          const head = path[revealed - 1];
          drawSparkle(ctx, cellX(head) + 8, cellY(head) + 8, (now / 200) % 1, 7);
        }
      }

      // Coins spin, so they are drawn every frame rather than baked into the
      // terrain cache. The phase is offset per tile so a street of them does
      // not flash in unison, and any the vehicle has already driven over are
      // gone - it picked them up.
      for (let i = 0; i < grid.tiles.length; i++) {
        if (grid.tiles[i] !== TILE.COIN) continue;
        if (playback?.hasPassed(i)) continue;
        const offset = hash2(i % grid.width, Math.floor(i / grid.width), 7);
        drawCoin(ctx, cellX(i), cellY(i), (now / 900 + offset) % 1);
      }

      // One burst per coin, fired the frame it is collected.
      if (playback) {
        for (const cell of playback.takePickups()) {
          for (let i = 0; i < 8; i++) {
            particles.spawn(cellX(cell) + 8, cellY(cell) + 8, 'spark');
          }
          drawSparkle(ctx, cellX(cell) + 8, cellY(cell) + 8, 0.5, 6);
        }
      }

      if (lit) {
        for (let i = 0; i < grid.tiles.length; i++) {
          if (grid.tiles[i] === TILE.WALL) continue;
          // One lamp per few intersections, chosen deterministically so they
          // stay put between frames.
          if (hash2(i % grid.width, Math.floor(i / grid.width), 21) > 0.94) {
            drawStreetLamp(ctx, cellX(i), cellY(i), now);
          }
        }
      }

      const slowPulse = 0.5 + 0.5 * Math.sin(now / 500);
      if (grid.start >= 0) drawStartFlag(ctx, cellX(grid.start), cellY(grid.start), slowPulse);
      if (grid.goal >= 0) {
        drawGoalChest(ctx, cellX(grid.goal), cellY(grid.goal), slowPulse);
        if (slowPulse > 0.94) {
          drawSparkle(ctx, cellX(grid.goal) + 12, cellY(grid.goal) + 3, (now / 300) % 1, 5);
        }
      }

      const vehicle = playback?.vehicle;
      if (vehicle) {
        if (vehicle.from !== vehicle.to) {
          lastDirRef.current = directionBetween(grid, vehicle.from, vehicle.to);
        }
        const fromX = cellX(vehicle.from);
        const fromY = cellY(vehicle.from);
        const x = Math.round(fromX + (cellX(vehicle.to) - fromX) * vehicle.t);
        const y = Math.round(fromY + (cellY(vehicle.to) - fromY) * vehicle.t);
        drawVehicle(ctx, x, y, lastDirRef.current, (now / 120) % 1);

        if (playingRef.current && Math.random() < 0.3) {
          particles.spawn(x + 8, y + 12, 'dust');
        }

        // One burst when the vehicle actually lands on the goal, and not again
        // until a new run resets the flag.
        const arrived = vehicle.from === grid.goal;
        if (arrived && !lastGoalRef.current) {
          for (let i = 0; i < 14; i++) particles.spawn(x + 8, y + 8, 'burst');
        }
        lastGoalRef.current = arrived;
      } else {
        lastGoalRef.current = false;
      }

      particles.update(dt);
      particles.draw(ctx);

      if (hoverRef.current >= 0 && brushRef.current !== null) {
        drawBrackets(ctx, cellX(hoverRef.current), cellY(hoverRef.current), PALETTE.black);
      }
    };

    let appliedScale = 0;
    let appliedX = NaN;
    let appliedY = NaN;

    /** Pushes viewport changes to the DOM, only when something actually moved. */
    const syncViewport = () => {
      const viewport = viewportRef.current;
      const wrap = wrapRef.current;
      if (!viewport || !wrap) return;

      if (viewport.scale !== appliedScale) {
        appliedScale = viewport.scale;
        canvas.style.width = `${worldWidth * appliedScale}px`;
        canvas.style.height = `${worldHeight * appliedScale}px`;
      }
      if (viewport.offsetX !== appliedX || viewport.offsetY !== appliedY) {
        appliedX = viewport.offsetX;
        appliedY = viewport.offsetY;
        canvas.style.transform = `translate(${-appliedX * appliedScale}px, ${
          -appliedY * appliedScale
        }px)`;
      }
    };

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

      syncViewport();

      const playback = playbackRef.current;
      if (playback && playingRef.current) {
        playback.stepsPerSecond = speedRef.current;
        playback.tick(dt);
      }

      draw(now, Math.min(dt, 0.1), playback);

      if (now - statsAt >= STATS_INTERVAL_MS) {
        statsAt = now;
        const viewport = viewportRef.current;
        const wrap = wrapRef.current;
        statsRef.current?.(playback ? { ...playback.stats, fps } : { fps });
        if (viewport && wrap) {
          const box = wrap.getBoundingClientRect();
          viewportStatsRef.current?.({
            scale: viewport.scale,
            canZoomIn: viewport.canZoomIn(),
            canZoomOut: viewport.canZoomOut(box.width, box.height),
          });
        }
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [grid, worldWidth, worldHeight, playbackRef, viewportRef]);

  /** Maps a pointer event to a flat cell index, or -1 if it missed. */
  const cellFromEvent = useCallback(
    (event) => {
      const canvas = canvasRef.current;
      const viewport = viewportRef.current;
      if (!canvas || !viewport) return -1;
      return viewport.toCell(
        event.clientX,
        event.clientY,
        canvas.getBoundingClientRect(),
        grid.width,
        grid.height,
      );
    },
    [grid, viewportRef],
  );

  const handleMove = (event) => {
    const pan = panningRef.current;
    if (pan) {
      const wrap = wrapRef.current;
      const viewport = viewportRef.current;
      const box = wrap.getBoundingClientRect();
      viewport.panBy(
        (pan.x - event.clientX) / viewport.scale,
        (pan.y - event.clientY) / viewport.scale,
        box.width,
        box.height,
      );
      panningRef.current = { x: event.clientX, y: event.clientY };
      return;
    }

    const cell = cellFromEvent(event);
    hoverRef.current = cell;
    if (paintingRef.current && cell >= 0 && brushRef.current !== null) onPaint?.(cell);
  };

  const handleDown = (event) => {
    // With no brush selected the pointer drags the map instead of painting it,
    // which is the only sensible thing for it to do once zoom exists.
    if (brush === null) {
      panningRef.current = { x: event.clientX, y: event.clientY };
      return;
    }
    paintingRef.current = true;
    const cell = cellFromEvent(event);
    if (cell >= 0) onPaint?.(cell);
  };

  const stopPointer = () => {
    paintingRef.current = false;
    panningRef.current = null;
  };

  const handleWheel = (event) => {
    const wrap = wrapRef.current;
    const viewport = viewportRef.current;
    if (!wrap || !viewport) return;
    event.preventDefault();
    const box = wrap.getBoundingClientRect();
    const anchorX = event.clientX - box.left;
    const anchorY = event.clientY - box.top;
    if (event.deltaY < 0) viewport.zoomIn(box.width, box.height, anchorX, anchorY);
    else viewport.zoomOut(box.width, box.height, anchorX, anchorY);
  };

  return (
    <div className="world" ref={wrapRef} onWheel={handleWheel}>
      <canvas
        ref={canvasRef}
        className={`world__canvas ${brush === null ? 'world__canvas--grab' : ''}`}
        onMouseMove={handleMove}
        onMouseDown={handleDown}
        onMouseUp={stopPointer}
        onMouseLeave={() => {
          hoverRef.current = -1;
          stopPointer();
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
  /** Which time of day is active. Changing it invalidates the terrain cache. */
  stageIndex: PropTypes.number.isRequired,
  /** Ref holding the current {@link import('../core/playback.js').Playback}, or null. */
  playbackRef: PropTypes.object.isRequired,
  /** Ref the viewport is published into, so the toolbar can drive zoom. */
  viewportRef: PropTypes.object.isRequired,
  playing: PropTypes.bool,
  speed: PropTypes.number,
  /** The tile id the pointer paints, or null when the editor is off. */
  brush: PropTypes.number,
  onPaint: PropTypes.func,
  onStats: PropTypes.func,
  onViewport: PropTypes.func,
};

// Memoized because the HUD pushes stats back into React ten times a second.
// Without this the world component would re-render at that rate for no reason -
// its canvas work happens entirely inside the animation loop.
export default memo(CanvasWorld);
