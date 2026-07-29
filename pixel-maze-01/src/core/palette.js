/**
 * The active palette.
 *
 * `PALETTE` is a single mutable object that always holds the colors of whatever
 * time of day is currently selected. Painters read `PALETTE.mid` at the moment
 * they draw, so changing the hour is one call to {@link applyStage} - no
 * painter signature mentions color at all.
 *
 * That mutability is deliberate, and it is the reason this file is worth
 * reading before touching the renderers. The alternative - threading a palette
 * argument through every painter, every sprite and every icon - buys nothing
 * here, because the app renders exactly one world at exactly one hour. What it
 * would cost is a parameter on roughly forty functions.
 *
 * The rule that follows from it: **never capture a palette value at module
 * scope.** `const c = PALETTE.mid` at the top of a file freezes midday into
 * that module forever. Read it inside the function that draws.
 *
 * @see ./daycycle.js - where the values come from
 */
import { STAGES, DEFAULT_STAGE_INDEX } from './daycycle.js';

const initial = STAGES[DEFAULT_STAGE_INDEX];

/**
 * The live palette. Five material tones plus the two the day cycle needs.
 *
 * @type {{bg: string, light: string, mid: string, dark: string, black: string,
 *         backdrop: string, glow: string|null}}
 */
export const PALETTE = {
  /** Brightest tone: road markings, marker pads, highlights. */
  bg: initial.bg,
  /** Road surface, windows, UI accents. */
  light: initial.light,
  /** Building faces, buttons, road details. */
  mid: initial.mid,
  /** Roofs, cast shadows, borders. */
  dark: initial.dark,
  /** Outlines, text, deep shadows. */
  black: initial.black,
  /** The surface the world sits on. */
  backdrop: initial.backdrop,
  /** Lit windows and lamp pools. Null while the sun is up. */
  glow: initial.glow,
};

/** The stage currently applied. Painters read this for sun direction. */
export let CURRENT_STAGE = initial;

/** Subscribers notified whenever the hour changes. */
const listeners = new Set();

/**
 * Switches the whole app to a different time of day.
 *
 * Mutates {@link PALETTE} in place rather than replacing it, so every module
 * that imported the object keeps pointing at the live values.
 *
 * @param {import('./daycycle.js').Stage} stage
 */
export function applyStage(stage) {
  PALETTE.bg = stage.bg;
  PALETTE.light = stage.light;
  PALETTE.mid = stage.mid;
  PALETTE.dark = stage.dark;
  PALETTE.black = stage.black;
  PALETTE.backdrop = stage.backdrop;
  PALETTE.glow = stage.glow;
  CURRENT_STAGE = stage;

  // Mirror the palette into CSS so the interface chrome changes hour with the
  // world. Keeping one source of truth for both is what stops the panels from
  // drifting out of step with the map they frame.
  if (typeof document !== 'undefined') {
    const root = document.documentElement.style;
    root.setProperty('--bg', stage.bg);
    root.setProperty('--light', stage.light);
    root.setProperty('--mid', stage.mid);
    root.setProperty('--dark', stage.dark);
    root.setProperty('--black', stage.black);
    root.setProperty('--backdrop', stage.backdrop);
    root.setProperty('--glow', stage.glow ?? stage.bg);
  }

  for (const fn of listeners) fn(stage);
}

/**
 * Registers a callback for hour changes.
 *
 * @param {(stage: import('./daycycle.js').Stage) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onStageChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * The five material tones of the current hour, darkest to lightest.
 *
 * Rebuilt on each call precisely because the palette moves - a cached array
 * would go stale the moment the sun did.
 *
 * @returns {string[]}
 */
export function ramp() {
  return [PALETTE.black, PALETTE.dark, PALETTE.mid, PALETTE.light, PALETTE.bg];
}

/**
 * Nudges a color one or more steps along the current {@link ramp}.
 *
 * @param {string} color - a tone from the active palette
 * @param {number} delta - positive goes lighter, negative goes darker
 * @returns {string} the shifted tone, clamped at both ends
 */
export function shade(color, delta) {
  const list = ramp();
  const i = list.indexOf(color);
  if (i === -1) return color;
  return list[Math.max(0, Math.min(list.length - 1, i + delta))];
}
