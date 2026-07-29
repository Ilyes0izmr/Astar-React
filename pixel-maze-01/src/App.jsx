import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles/tokens.css';
import './styles/ui.css';

import { generateCity, isSolvable } from './core/citygen.js';
import { setTile } from './core/grid.js';
import { codeToSeed, randomSeed, seedToCode } from './core/rng.js';
import { runAlgorithm } from './core/algorithms/index.js';
import { Playback } from './core/playback.js';

import CanvasWorld from './render/CanvasWorld.jsx';
import Minimap from './render/Minimap.jsx';
import MainMenu from './ui/MainMenu.jsx';
import Hud from './ui/Hud.jsx';
import Toolbar, { SPEEDS } from './ui/Toolbar.jsx';
import Compare from './ui/Compare.jsx';

/** Starting energy, and the height of the heart bar. */
const MAX_ENERGY = 10;

/**
 * Root component and state machine.
 *
 * Two screens - the menu and the game - and one piece of state that does not
 * live in React: the grid's tile array. Tiles are a `Uint8Array` that gets
 * mutated in place, because copying it on every brush stroke would be wasteful
 * and because the render loop needs to read it without a re-render. `gridVersion`
 * is the change signal that stands in for identity: bump it and anything
 * derived from the tiles repaints.
 *
 * The playback object is held in a ref for the same reason. It advances sixty
 * times a second and nothing in the tree needs to re-render when it does; only
 * the HUD numbers cross back into React, and those arrive throttled.
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
  const [fog, setFog] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  const [result, setResult] = useState(null);
  const [stats, setStats] = useState({ fps: 60, maxEnergy: MAX_ENERGY, energy: MAX_ENERGY });

  const playbackRef = useRef(null);

  /** Throws away any current run. Called whenever the map stops matching it. */
  const clearRun = useCallback(() => {
    playbackRef.current = null;
    setResult(null);
    setPlaying(false);
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
      if (grid.tiles[cell] === brush) return; // nothing to do, skip the repaint
      setTile(grid, cell, brush);
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
  }, [algorithm, grid, speedIndex]);

  /** Rewinds the current run without recomputing it. */
  const reset = useCallback(() => {
    playbackRef.current?.reset();
    setPlaying(true);
  }, []);

  const startGame = useCallback(() => {
    generate();
    setScreen('game');
  }, [generate]);

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
  }, [screen, solve, reset, generate]);

  if (screen === 'menu') {
    return (
      <MainMenu
        algorithm={algorithm}
        onAlgorithm={setAlgorithm}
        seedText={seedText}
        onSeedText={setSeedText}
        onGenerate={startGame}
      />
    );
  }

  return (
    <div className="game">
      <Hud algorithm={algorithm} stats={stats} seedCode={seedToCode(grid.seed)} />

      <div className="stage">
        <CanvasWorld
          grid={grid}
          gridVersion={gridVersion}
          playbackRef={playbackRef}
          playing={playing}
          speed={SPEEDS[speedIndex]}
          brush={brush}
          onPaint={paint}
          onStats={setStats}
        />
        <Minimap grid={grid} gridVersion={gridVersion} playbackRef={playbackRef} fog={fog} />

        {showCompare && (
          <Compare grid={grid} gridVersion={gridVersion} onClose={() => setShowCompare(false)} />
        )}

        {!solvable && canSolve && (
          <div className="panel hud hud__warning">
            <span className="hud__flag hud__flag--bad">GOAL IS WALLED IN</span>
          </div>
        )}
      </div>

      <Toolbar
        brush={brush}
        onBrush={setBrush}
        onGenerate={generate}
        onSolve={solve}
        onReset={reset}
        onCompare={() => setShowCompare(true)}
        onMenu={() => setScreen('menu')}
        playing={playing}
        onTogglePlay={() => setPlaying((p) => !p)}
        speedIndex={speedIndex}
        onSpeedIndex={setSpeedIndex}
        fog={fog}
        onFog={setFog}
        canSolve={canSolve}
        hasResult={result !== null}
      />
    </div>
  );
}

export default App;
