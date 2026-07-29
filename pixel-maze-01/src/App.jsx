import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles/tokens.css';
import './styles/ui.css';

import { generateCity, isSolvable, refreshBuildings } from './core/citygen.js';
import { setTile } from './core/grid.js';
import { codeToSeed, randomSeed, seedToCode } from './core/rng.js';
import { runAlgorithm } from './core/algorithms/index.js';
import { Playback } from './core/playback.js';
import { applyStage } from './core/palette.js';
import { DEFAULT_STAGE_INDEX, stageAt } from './core/daycycle.js';

import CanvasWorld from './render/CanvasWorld.jsx';
import Minimap from './render/Minimap.jsx';
import MainMenu from './ui/MainMenu.jsx';
import Navbar from './ui/Navbar.jsx';
import Sidebar from './ui/Sidebar.jsx';
import Hud from './ui/Hud.jsx';
import InfoBack from './ui/InfoBack.jsx';
import Compare from './ui/Compare.jsx';
import PixelIcon from './ui/PixelIcon.jsx';
import { downloadSnapshot } from './ui/download.js';

/** Starting energy, and the height of the heart bar. */
const MAX_ENERGY = 10;

/** Speed slider stops, in search steps per second. */
const SPEEDS = [4, 8, 15, 30, 60, 120, 240, 600];

/**
 * Root component and state machine.
 *
 * Two screens - the menu and the game - and two pieces of state that live
 * outside React on purpose:
 *
 *   - The grid's tiles are a `Uint8Array` mutated in place, because copying it
 *     on every brush stroke would be wasteful and the render loop needs to read
 *     it without a re-render. `gridVersion` is the change signal that stands in
 *     for identity.
 *   - The playback object advances sixty times a second and nothing in the tree
 *     needs to re-render when it does. Only the HUD numbers cross back into
 *     React, throttled.
 *
 * The time of day is a third case: it lives in React (a slider drives it) but
 * its effect is applied by mutating the shared palette, which every painter
 * reads at draw time. See `core/palette.js` for why that indirection exists.
 *
 * @component
 */
function App() {
  const [screen, setScreen] = useState('menu');
  const [algorithm, setAlgorithm] = useState('astar');
  const [seedText, setSeedText] = useState('');

  const [grid, setGrid] = useState(() => generateCity({ seed: randomSeed() }));
  const [gridVersion, setGridVersion] = useState(0);

  const [brush, setBrush] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(4);
  const [stageIndex, setStageIndex] = useState(DEFAULT_STAGE_INDEX);
  const [fog, setFog] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const [result, setResult] = useState(null);
  const [stats, setStats] = useState({ fps: 60, maxEnergy: MAX_ENERGY, energy: MAX_ENERGY });
  const [view, setView] = useState({ scale: 1, canZoomIn: true, canZoomOut: false });

  const playbackRef = useRef(null);
  const viewportRef = useRef(null);
  const stageElRef = useRef(null);

  // The palette is a mutable singleton, so switching the hour is a side effect
  // rather than a value anything renders from.
  useEffect(() => {
    applyStage(stageAt(stageIndex));
  }, [stageIndex]);

  /** Throws away any current run. Called whenever the map stops matching it. */
  const clearRun = useCallback(() => {
    playbackRef.current = null;
    setResult(null);
    setPlaying(false);
    setFlipped(false);
    setStats({ fps: 60, maxEnergy: MAX_ENERGY, energy: MAX_ENERGY });
  }, []);

  /**
   * Builds a new city.
   *
   * A blank seed box means "surprise me"; anything else is decoded back into
   * the exact number that produced that city before.
   */
  const generate = useCallback(() => {
    const parsed = seedText.trim() ? codeToSeed(seedText) : null;
    const seed = parsed === null ? randomSeed() : parsed;
    setGrid(generateCity({ seed }));
    setGridVersion((v) => v + 1);
    clearRun();
  }, [seedText, clearRun]);

  /** Paints one tile. Mutates in place and signals the change. */
  const paint = useCallback(
    (cell) => {
      if (brush === null) return;
      if (grid.tiles[cell] === brush) return;
      setTile(grid, cell, brush);
      // Painting a wall can merge two buildings or split one in half, so the
      // building index has to be rebuilt before the terrain is repainted.
      refreshBuildings(grid);
      setGridVersion((v) => v + 1);
      clearRun();
    },
    [brush, grid, clearRun],
  );

  /** Runs the selected algorithm and starts the replay. */
  const solve = useCallback(() => {
    if (grid.start < 0 || grid.goal < 0) return;
    const searchResult = runAlgorithm(algorithm, grid);
    playbackRef.current = new Playback(grid, searchResult, {
      energy: MAX_ENERGY,
      stepsPerSecond: SPEEDS[speedIndex],
    });
    setResult(searchResult);
    setPlaying(true);
    setFlipped(false);
  }, [algorithm, grid, speedIndex]);

  /**
   * Stops the run and rewinds it, without recomputing anything.
   *
   * Leaves it paused rather than restarting. Resuming is what the transport
   * button is for, and having this one auto-play made it indistinguishable from
   * pressing start again.
   */
  const reset = useCallback(() => {
    playbackRef.current?.reset();
    setPlaying(false);
  }, []);

  const startGame = useCallback(() => {
    generate();
    setScreen('game');
  }, [generate]);

  const download = useCallback(() => {
    downloadSnapshot(document.querySelector('canvas.world__canvas'), {
      algorithm,
      stats,
      seedCode: seedToCode(grid.seed),
      stageLabel: stageAt(stageIndex).label,
    });
  }, [algorithm, stats, grid.seed, stageIndex]);

  const zoom = useCallback((direction) => {
    const viewport = viewportRef.current;
    const el = stageElRef.current;
    if (!viewport || !el) return;
    const box = el.getBoundingClientRect();
    if (direction > 0) viewport.zoomIn(box.width, box.height, box.width / 2, box.height / 2);
    else if (direction < 0) viewport.zoomOut(box.width, box.height, box.width / 2, box.height / 2);
    else viewport.reset(box.width, box.height);
  }, []);

  /** Expands the whole card, so the map gets the entire screen. */
  const toggleFullscreen = useCallback(() => {
    const el = stageElRef.current?.closest('.card');
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  }, []);

  const canSolve = grid.start >= 0 && grid.goal >= 0;
  const solvable = useMemo(
    () => isSolvable(grid),
    // The tiles mutate in place, so the version counter is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grid, gridVersion],
  );

  /** Keyboard shortcuts, ignored while a text field has focus. */
  useEffect(() => {
    if (screen !== 'game') return undefined;

    const onKey = (event) => {
      if (event.target instanceof HTMLInputElement) return;
      switch (event.key.toLowerCase()) {
        case ' ':
          event.preventDefault();
          if (playbackRef.current) setPlaying((p) => !p);
          break;
        case 'enter':
          solve();
          break;
        case 'r':
          reset();
          break;
        case 'g':
          generate();
          break;
        case 'f':
          setFlipped((f) => !f);
          break;
        case '+':
        case '=':
          zoom(1);
          break;
        case '-':
          zoom(-1);
          break;
        case '0':
          zoom(0);
          break;
        case 'escape':
          setShowCompare(false);
          setBrush(null);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, solve, reset, generate, zoom]);

  if (screen === 'menu') {
    return (
      <div className="app">
        <MainMenu
          algorithm={algorithm}
          onAlgorithm={setAlgorithm}
          seedText={seedText}
          onSeedText={setSeedText}
          onGenerate={startGame}
        />
      </div>
    );
  }

  const seedCode = seedToCode(grid.seed);

  return (
    <div className="app">
      <div className="card">
        <div className="card__bar">
          <Navbar
            onSolve={solve}
            onTogglePlay={() => setPlaying((p) => !p)}
            onReset={reset}
            playing={playing}
            canSolve={canSolve}
            hasResult={result !== null}
            speedIndex={speedIndex}
            onSpeedIndex={setSpeedIndex}
            speeds={SPEEDS}
            onGenerate={generate}
            fog={fog}
            onFog={setFog}
            onCompare={() => setShowCompare(true)}
            onDownload={download}
            flipped={flipped}
            onToggleFlip={() => setFlipped((f) => !f)}
            onMenu={() => setScreen('menu')}
            fps={stats.fps ?? 0}
          />
        </div>

        <div className="card__body">
          <div
            className={`stage flip ${flipped ? 'flip--on' : ''}`}
            ref={stageElRef}
          >
            <div className="flip__face flip__face--front">
              <CanvasWorld
                grid={grid}
                gridVersion={gridVersion}
                stageIndex={stageIndex}
                playbackRef={playbackRef}
                viewportRef={viewportRef}
                playing={playing}
                speed={SPEEDS[speedIndex]}
                brush={brush}
                onPaint={paint}
                onStats={setStats}
                onViewport={setView}
              />
              <Minimap
                grid={grid}
                gridVersion={gridVersion}
                playbackRef={playbackRef}
                fog={fog}
              />
              <Hud stats={stats} seedCode={seedCode} />

              <div className="zoombar">
                <button
                  type="button"
                  className="btn btn--round"
                  onClick={() => zoom(1)}
                  disabled={!view.canZoomIn}
                  aria-label="Zoom in"
                >
                  +
                </button>
                <span className="zoombar__level">{view.scale}X</span>
                <button
                  type="button"
                  className="btn btn--round"
                  onClick={() => zoom(-1)}
                  disabled={!view.canZoomOut}
                  aria-label="Zoom out"
                >
                  -
                </button>
                <button
                  type="button"
                  className="btn btn--round"
                  onClick={toggleFullscreen}
                  aria-label="Open fullscreen"
                >
                  <PixelIcon name="compass" />
                </button>
              </div>

              {!solvable && canSolve && (
                <div className="hud__warning">
                  <span className="hud__flag hud__flag--bad">GOAL IS WALLED IN</span>
                </div>
              )}
            </div>

            <div className="flip__face flip__face--back">
              <InfoBack
                algorithm={algorithm}
                stats={stats}
                seedCode={seedCode}
                onClose={() => setFlipped(false)}
              />
            </div>
          </div>

          <Sidebar
            brush={brush}
            onBrush={setBrush}
            seedText={seedText}
            onSeedText={setSeedText}
            onGenerate={generate}
            seedCode={seedCode}
            stageIndex={stageIndex}
            onStageIndex={setStageIndex}
            energy={stats.energy ?? MAX_ENERGY}
            maxEnergy={stats.maxEnergy ?? MAX_ENERGY}
            stats={stats}
          />
        </div>

        {showCompare && (
          <Compare grid={grid} gridVersion={gridVersion} onClose={() => setShowCompare(false)} />
        )}
      </div>
    </div>
  );
}

export default App;
