/**
 * Zoom and pan for the world view.
 *
 * Zoom is a whole number and nothing else will do: the world is drawn once at
 * one canvas pixel per world pixel and blitted with smoothing off, so a
 * fractional scale resamples the art and leaves some pixels a row wider than
 * their neighbours. Stepping through integers keeps every pixel square, and
 * panning covers the case the old fit-only sizing could not - once the map is
 * bigger than its container, something has to decide which part of it you see.
 *
 * Two numbers per axis describe the view. `scale` is the integer zoom, and
 * `offsetX`/`offsetY` are the world pixel sitting against the top-left corner of
 * the container - integers too, so a pan never lands the pixel grid on a half
 * pixel. A world point maps into the container as
 *
 *     screenX = (worldX - offsetX) * scale + originX
 *
 * where `originX` is the letterbox margin {@link Viewport#transformFor} hands
 * back. It is nonzero only while the scaled world is narrower than the
 * container, which is also exactly when the pan on that axis is ignored and the
 * map is centred instead. Drawing and hit testing must both go through that one
 * method or a click will land on a different tile than the one under the cursor.
 *
 * Lengths are in whatever units the container is measured in - CSS pixels, to
 * match `getBoundingClientRect` - and nothing here touches the DOM.
 *
 * `src/render/__viewport.test.mjs` asserts the clamping, centring, anchored zoom
 * and hit-test invariants under plain `node`, with no framework and no DOM. Run
 * it after touching any of the arithmetic below.
 */

/** Past 6 a tile is 96 pixels across and the map stops reading as a map. */
const MAX_SCALE = 6;

/** Hard floor. The practical floor is whatever it takes to fit the container. */
const MIN_SCALE = 1;

/**
 * Guards every dimension that arrives from outside.
 *
 * Container sizes come from layout, and `ResizeObserver` reports zeroes on the
 * first frame; dividing by one of those turns the whole view state into
 * infinities that no later call can recover from.
 *
 * @param {number} w
 * @param {number} h
 * @returns {boolean}
 */
function usable(w, h) {
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0;
}

/**
 * @typedef {Object} ViewTransform
 * @property {number} scale - integer zoom
 * @property {number} offsetX - world pixel at the container's left edge
 * @property {number} offsetY - world pixel at the container's top edge
 * @property {number} originX - letterbox margin, in container pixels
 * @property {number} originY - letterbox margin, in container pixels
 */

export class Viewport {
  #worldW;
  #worldH;
  #scale = MIN_SCALE;
  #offsetX = 0;
  #offsetY = 0;
  #carryX = 0;
  #carryY = 0;

  /**
   * @param {number} worldW - world width in world pixels
   * @param {number} worldH - world height in world pixels
   */
  constructor(worldW, worldH) {
    this.#worldW = Math.max(1, Math.round(worldW));
    this.#worldH = Math.max(1, Math.round(worldH));
  }

  /** @returns {number} the current integer zoom, at least 1. */
  get scale() {
    return this.#scale;
  }

  /** @returns {number} world pixel at the container's left edge. */
  get offsetX() {
    return this.#offsetX;
  }

  /** @returns {number} world pixel at the container's top edge. */
  get offsetY() {
    return this.#offsetY;
  }

  /**
   * The biggest whole-number zoom at which the whole map is visible.
   *
   * Doubles as the low end of the zoom range. Below it nothing new comes into
   * view - the map only gets smaller inside a growing letterbox - so there is
   * nothing to zoom out to.
   *
   * @param {number} containerW
   * @param {number} containerH
   * @returns {number}
   */
  #fitScale(containerW, containerH) {
    const raw = Math.min(containerW / this.#worldW, containerH / this.#worldH);
    // Snap down to the nearest 0.5 so zoom steps align cleanly.
    const snapped = Math.floor(raw * 2) / 2;
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, snapped));
  }

  /**
   * How far the pan may travel on each axis, and whether the axis is centred.
   *
   * The maximum is floored rather than rounded so the far edge can only ever
   * overshoot the container, never stop short of it and expose a strip of
   * backdrop along the edge.
   *
   * @param {number} containerW
   * @param {number} containerH
   */
  #limits(containerW, containerH) {
    return {
      centredX: this.#worldW * this.#scale <= containerW,
      centredY: this.#worldH * this.#scale <= containerH,
      maxX: Math.max(0, Math.floor(this.#worldW - containerW / this.#scale)),
      maxY: Math.max(0, Math.floor(this.#worldH - containerH / this.#scale)),
    };
  }

  /**
   * Everything a draw call or a hit test needs to convert between world and
   * container coordinates.
   *
   * A centred axis reports a pan of zero regardless of what is stored, so the
   * frame between a resize and the {@link Viewport#fit} that follows it cannot
   * paint a stale offset.
   *
   * @param {number} containerW
   * @param {number} containerH
   * @returns {ViewTransform}
   */
  transformFor(containerW, containerH) {
    const scaledW = this.#worldW * this.#scale;
    const scaledH = this.#worldH * this.#scale;
    const centredX = scaledW <= containerW;
    const centredY = scaledH <= containerH;
    return {
      scale: this.#scale,
      offsetX: centredX ? 0 : this.#offsetX,
      offsetY: centredY ? 0 : this.#offsetY,
      originX: centredX ? Math.floor((containerW - scaledW) / 2) : 0,
      originY: centredY ? Math.floor((containerH - scaledH) / 2) : 0,
    };
  }

  /**
   * Picks the largest whole-number zoom that shows the entire map and recentres.
   *
   * @param {number} containerW
   * @param {number} containerH
   */
  fit(containerW, containerH) {
    if (!usable(containerW, containerH)) return;
    this.#scale = this.#fitScale(containerW, containerH);
    this.#offsetX = 0;
    this.#offsetY = 0;
    this.#carryX = 0;
    this.#carryY = 0;
    this.clamp(containerW, containerH);
  }

  /**
   * Back to the opening view. Identical to {@link Viewport#fit} - the map has no
   * other resting state - and exists so callers can say what they mean.
   *
   * @param {number} containerW
   * @param {number} containerH
   */
  reset(containerW, containerH) {
    this.fit(containerW, containerH);
  }

  /**
   * Zooms to a whole-number scale while holding one point of the world still.
   *
   * Without the anchor, zooming from a corner of the map walks the thing you
   * were looking at off the screen. The anchor is where the pointer is, in
   * container coordinates, and defaults to the middle for keyboard and button
   * zooms.
   *
   * @param {number} next - desired zoom, clamped to the usable range
   * @param {number} containerW
   * @param {number} containerH
   * @param {number} [anchorX] - container-relative x to keep fixed
   * @param {number} [anchorY] - container-relative y to keep fixed
   */
  setScale(next, containerW, containerH, anchorX, anchorY) {
    if (!usable(containerW, containerH)) return;
    const target = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.round(next * 2) / 2));
    if (!Number.isFinite(target) || target === this.#scale) return;

    const ax = Number.isFinite(anchorX) ? anchorX : containerW / 2;
    const ay = Number.isFinite(anchorY) ? anchorY : containerH / 2;
    const before = this.transformFor(containerW, containerH);
    const worldX = (ax - before.originX) / before.scale + before.offsetX;
    const worldY = (ay - before.originY) / before.scale + before.offsetY;

    this.#scale = target;
    // The letterbox margin changes with the scale, so it has to be re-read
    // before solving for the pan that puts the same world point back under the
    // anchor.
    const after = this.transformFor(containerW, containerH);
    this.#offsetX = Math.round(worldX - (ax - after.originX) / target);
    this.#offsetY = Math.round(worldY - (ay - after.originY) / target);
    this.#carryX = 0;
    this.#carryY = 0;
    this.clamp(containerW, containerH);
  }

  /**
   * @param {number} containerW
   * @param {number} containerH
   * @param {number} [anchorX]
   * @param {number} [anchorY]
   */
  zoomIn(containerW, containerH, anchorX, anchorY) {
    this.setScale(this.#scale + 0.5, containerW, containerH, anchorX, anchorY);
  }

  /**
   * @param {number} containerW
   * @param {number} containerH
   * @param {number} [anchorX]
   * @param {number} [anchorY]
   */
  zoomOut(containerW, containerH, anchorX, anchorY) {
    this.setScale(this.#scale - 0.5, containerW, containerH, anchorX, anchorY);
  }

  /** @returns {boolean} whether there is a zoom step left to take. */
  canZoomIn() {
    return this.#scale < MAX_SCALE;
  }

  /**
   * @param {number} containerW
   * @param {number} containerH
   * @returns {boolean} whether zooming out would reveal anything not already on
   *   screen
   */
  canZoomOut(containerW, containerH) {
    if (!usable(containerW, containerH)) return false;
    return this.#scale > MIN_SCALE;
  }

  /**
   * Drags the map by a pointer delta, in container pixels, so the map follows
   * the pointer.
   *
   * The leftover fraction is carried between calls. At zoom 6 one pointer pixel
   * is a sixth of a world pixel, and rounding each event on its own would floor
   * every one of them to zero and leave a slow drag completely stuck.
   *
   * @param {number} dx
   * @param {number} dy
   * @param {number} containerW
   * @param {number} containerH
   */
  panBy(dx, dy, containerW, containerH) {
    if (!usable(containerW, containerH)) return;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;

    const wantX = this.#carryX - dx / this.#scale;
    const wantY = this.#carryY - dy / this.#scale;
    const stepX = Math.trunc(wantX);
    const stepY = Math.trunc(wantY);
    this.#offsetX += stepX;
    this.#offsetY += stepY;
    this.#carryX = wantX - stepX;
    this.#carryY = wantY - stepY;
    this.clamp(containerW, containerH);
  }

  /**
   * Pulls the view back into legal territory.
   *
   * An axis whose scaled world is smaller than the container is centred and its
   * pan discarded; an axis that is larger is held so neither of its edges can
   * pull inside the container. Between the two the map can never drift off, and
   * there is never a strip of empty backdrop beside a map big enough to cover
   * it.
   *
   * @param {number} containerW
   * @param {number} containerH
   */
  clamp(containerW, containerH) {
    if (!usable(containerW, containerH)) return;
    this.#scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.round(this.#scale * 2) / 2));

    const limits = this.#limits(containerW, containerH);
    const x = limits.centredX ? 0 : Math.max(0, Math.min(limits.maxX, Math.round(this.#offsetX)));
    const y = limits.centredY ? 0 : Math.max(0, Math.min(limits.maxY, Math.round(this.#offsetY)));

    // Dropping the carry at the limits stops a drag that keeps pushing against
    // an edge from banking a debt that has to be paid back before the map moves
    // the other way.
    if (x !== this.#offsetX) this.#carryX = 0;
    if (y !== this.#offsetY) this.#carryY = 0;
    this.#offsetX = x;
    this.#offsetY = y;
  }

  /**
   * Maps a pointer position to the cell under it.
   *
   * `rect` is the bounding rect of the element the container sizes describe -
   * the box the world is drawn into, not the drawn map itself, which may be
   * smaller than the box and offset inside it.
   *
   * @param {number} clientX
   * @param {number} clientY
   * @param {{left: number, top: number, width: number, height: number}} rect
   * @param {number} gridW - map width in tiles
   * @param {number} gridH - map height in tiles
   * @returns {number} flat cell index, or -1 when the pointer is off the map
   */
  toCell(clientX, clientY, rect, gridW, gridH) {
    if (!rect || !usable(rect.width, rect.height)) return -1;
    if (!usable(gridW, gridH)) return -1;

    const view = this.transformFor(rect.width, rect.height);
    const worldX = (clientX - rect.left - view.originX) / view.scale + view.offsetX;
    const worldY = (clientY - rect.top - view.originY) / view.scale + view.offsetY;
    const col = Math.floor((worldX * gridW) / this.#worldW);
    const row = Math.floor((worldY * gridH) / this.#worldH);

    if (col < 0 || col >= gridW || row < 0 || row >= gridH) return -1;
    return row * gridW + col;
  }
}

/**
 * Creates viewport state for a world of `worldW` x `worldH` device pixels.
 *
 * @param {number} worldW
 * @param {number} worldH
 * @returns {Viewport}
 */
export function createViewport(worldW, worldH) {
  return new Viewport(worldW, worldH);
}

/**
 * The tile range currently on screen, so the renderer can skip the rest.
 *
 * At zoom 6 a 41x41 city has around a twentieth of its tiles visible, and the
 * terrain painter is the most expensive thing in the frame - walking the whole
 * grid to draw a corner of it is most of the cost of the zoom.
 *
 * Both ends are inclusive and always inside the grid, so the caller can loop
 * `for (let c = c0; c <= c1; c++)` without checking anything. The range rounds
 * outward: a tile half off the edge is included, because drawing one tile too
 * many is invisible and drawing one too few leaves a gap along the edge.
 *
 * @param {Viewport} viewport
 * @param {number} containerW
 * @param {number} containerH
 * @param {number} tilePx - world pixels per tile
 * @param {number} gridW - map width in tiles
 * @param {number} gridH - map height in tiles
 * @returns {{c0: number, c1: number, r0: number, r1: number}}
 */
export function visibleTileRange(viewport, containerW, containerH, tilePx, gridW, gridH) {
  const { scale, offsetX, offsetY } = viewport.transformFor(containerW, containerH);
  const spanX = containerW / scale;
  const spanY = containerH / scale;

  const c0 = Math.max(0, Math.min(gridW - 1, Math.floor(offsetX / tilePx)));
  const r0 = Math.max(0, Math.min(gridH - 1, Math.floor(offsetY / tilePx)));
  return {
    c0,
    r0,
    c1: Math.max(c0, Math.min(gridW - 1, Math.floor((offsetX + spanX) / tilePx))),
    r1: Math.max(r0, Math.min(gridH - 1, Math.floor((offsetY + spanY) / tilePx))),
  };
}
