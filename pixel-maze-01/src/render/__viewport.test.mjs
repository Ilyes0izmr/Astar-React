/**
 * Self-checks for the viewport maths. Run with
 * `node src/render/__viewport.test.mjs`.
 *
 * Pure arithmetic, no DOM and no framework, so it runs straight in Node. It
 * earns its place because every property it asserts is one that fails silently
 * and looks like something else: a pan limit that is off by a pixel shows up as
 * a hairline of backdrop along one edge, and a hit test that disagrees with the
 * draw transform shows up as the brush painting the wrong tile only when the map
 * is zoomed and panned.
 *
 * What it covers, in order of what it would catch:
 *
 *   - the pan can never expose backdrop beside a map large enough to cover the
 *     container, and can never drift off the other way either
 *   - an axis with room to spare is centred and its pan discarded
 *   - zooming holds the anchored world point still, unless a limit stops it
 *   - the hit test is the exact inverse of the draw transform, at every zoom,
 *     every pan and every tile
 *   - the visible tile range never omits a tile that is on screen
 */
import { createViewport, visibleTileRange } from './viewport.js';

const TILE = 16;
const GRID_W = 25;
const GRID_H = 25;
const WORLD_W = GRID_W * TILE;
const WORLD_H = GRID_H * TILE;

/** Deliberately mixed: square, wide, tiny, huge, and a few odd sizes. */
const CONTAINERS = [
  [400, 400],
  [900, 600],
  [1200, 1200],
  [300, 300],
  [240, 180],
  [100, 100],
  [4000, 4000],
  [901, 603],
  [1000, 397],
];

let failures = 0;
const check = (name, cond, extra = '') => {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${name} ${extra}`);
  }
};

/** Where a world point lands inside the container, per the documented mapping. */
function screenOf(view, worldX, worldY) {
  return {
    x: (worldX - view.offsetX) * view.scale + view.originX,
    y: (worldY - view.offsetY) * view.scale + view.originY,
  };
}

/** The invariants that must hold after any operation, whatever the state. */
function assertClamped(label, viewport, cw, ch) {
  check(`${label} scale is a whole number in range`,
    Number.isInteger(viewport.scale) && viewport.scale >= 1 && viewport.scale <= 6,
    `scale=${viewport.scale}`);
  check(`${label} pan is whole pixels`,
    Number.isInteger(viewport.offsetX) && Number.isInteger(viewport.offsetY),
    `${viewport.offsetX},${viewport.offsetY}`);

  const scaledW = WORLD_W * viewport.scale;
  const scaledH = WORLD_H * viewport.scale;

  if (scaledW <= cw) {
    check(`${label} narrow map ignores horizontal pan`, viewport.offsetX === 0, `x=${viewport.offsetX}`);
  } else {
    check(`${label} left edge stays put`, viewport.offsetX >= 0, `x=${viewport.offsetX}`);
    check(`${label} right edge covers the container`,
      (WORLD_W - viewport.offsetX) * viewport.scale >= cw,
      `x=${viewport.offsetX} scale=${viewport.scale} cw=${cw}`);
  }

  if (scaledH <= ch) {
    check(`${label} short map ignores vertical pan`, viewport.offsetY === 0, `y=${viewport.offsetY}`);
  } else {
    check(`${label} top edge stays put`, viewport.offsetY >= 0, `y=${viewport.offsetY}`);
    check(`${label} bottom edge covers the container`,
      (WORLD_H - viewport.offsetY) * viewport.scale >= ch,
      `y=${viewport.offsetY} scale=${viewport.scale} ch=${ch}`);
  }
}

console.log('--- fit ---');
for (const [cw, ch] of CONTAINERS) {
  const expected = Math.max(1, Math.min(6, Math.floor(Math.min(cw / WORLD_W, ch / WORLD_H))));
  const v = createViewport(WORLD_W, WORLD_H);
  v.fit(cw, ch);
  check(`fit ${cw}x${ch} picks the largest whole scale`, v.scale === expected, `got ${v.scale} want ${expected}`);
  check(`fit ${cw}x${ch} recentres`, v.offsetX === 0 && v.offsetY === 0);
  // Either the whole map is on screen, or the container is too small for even
  // one pixel per world pixel and 1 is all there is.
  check(`fit ${cw}x${ch} shows the whole map`,
    (WORLD_W * v.scale <= cw && WORLD_H * v.scale <= ch) || v.scale === 1,
    `scale=${v.scale}`);
  assertClamped(`fit ${cw}x${ch}`, v, cw, ch);
}

{
  const v = createViewport(WORLD_W, WORLD_H);
  v.fit(900, 600);
  v.zoomIn(900, 600);
  v.reset(900, 600);
  check('reset returns to the fit view', v.scale === 1 && v.offsetX === 0 && v.offsetY === 0);

  const before = { scale: v.scale, x: v.offsetX, y: v.offsetY };
  v.fit(0, 0);
  v.clamp(0, 600);
  v.panBy(10, 10, 900, 0);
  check('zero-sized container is ignored',
    v.scale === before.scale && v.offsetX === before.x && v.offsetY === before.y);
}

console.log('--- centring ---');
for (const [cw, ch] of CONTAINERS) {
  const v = createViewport(WORLD_W, WORLD_H);
  v.fit(cw, ch);
  const view = v.transformFor(cw, ch);
  const scaledW = WORLD_W * view.scale;
  const scaledH = WORLD_H * view.scale;

  if (scaledW <= cw) {
    check(`centre ${cw}x${ch} horizontal margin`,
      view.originX === Math.floor((cw - scaledW) / 2), `originX=${view.originX}`);
    check(`centre ${cw}x${ch} equal margins`,
      Math.abs((cw - scaledW - view.originX) - view.originX) <= 1);
  } else {
    check(`centre ${cw}x${ch} wide map has no margin`, view.originX === 0);
  }
  if (scaledH <= ch) {
    check(`centre ${cw}x${ch} vertical margin`,
      view.originY === Math.floor((ch - scaledH) / 2), `originY=${view.originY}`);
  } else {
    check(`centre ${cw}x${ch} tall map has no margin`, view.originY === 0);
  }

  // A map with room to spare must not move, however hard it is dragged.
  v.panBy(-500, -500, cw, ch);
  v.panBy(500, 500, cw, ch);
  if (scaledW <= cw) check(`centre ${cw}x${ch} drag does not shift it`, v.offsetX === 0, `x=${v.offsetX}`);
  if (scaledH <= ch) check(`centre ${cw}x${ch} drag does not lift it`, v.offsetY === 0, `y=${v.offsetY}`);
}

console.log('--- clamping ---');
const DRAGS = [
  [0, 0],
  [-10000, -10000],
  [10000, 10000],
  [-37, 11],
  [200, -450],
  [-1, -1],
];
for (const [cw, ch] of CONTAINERS) {
  for (let want = 1; want <= 6; want++) {
    const v = createViewport(WORLD_W, WORLD_H);
    v.fit(cw, ch);
    v.setScale(want, cw, ch);
    assertClamped(`scale ${want} in ${cw}x${ch}`, v, cw, ch);
    for (const [dx, dy] of DRAGS) {
      v.panBy(dx, dy, cw, ch);
      assertClamped(`drag ${dx},${dy} at ${v.scale} in ${cw}x${ch}`, v, cw, ch);
    }
  }
}

console.log('--- zoom bounds ---');
{
  const v = createViewport(WORLD_W, WORLD_H);
  v.fit(900, 600);
  check('fit view cannot zoom out further', !v.canZoomOut(900, 600));
  check('fit view can zoom in', v.canZoomIn());
  for (let i = 0; i < 12; i++) v.zoomIn(900, 600);
  check('zoom stops at 6', v.scale === 6, `scale=${v.scale}`);
  check('no zoom left at 6', !v.canZoomIn());
  check('zoomed in view can zoom out', v.canZoomOut(900, 600));
  for (let i = 0; i < 12; i++) v.zoomOut(900, 600);
  check('zoom out stops at the fit scale', v.scale === 1, `scale=${v.scale}`);

  const big = createViewport(WORLD_W, WORLD_H);
  big.fit(1200, 1200);
  check('roomy container fits at 3', big.scale === 3, `scale=${big.scale}`);
  big.setScale(1, 1200, 1200);
  check('cannot shrink below the fit scale', big.scale === 3, `scale=${big.scale}`);
  check('and reports as much', !big.canZoomOut(1200, 1200));
  check('canZoomOut is false without a container', !big.canZoomOut(0, 0));
}

console.log('--- anchored zoom ---');
for (const [cw, ch] of CONTAINERS) {
  const anchors = [
    [cw / 2, ch / 2],
    [cw * 0.25, ch * 0.75],
    [7, 5],
    [cw - 3, ch - 9],
  ];
  for (const [ax, ay] of anchors) {
    const v = createViewport(WORLD_W, WORLD_H);
    v.fit(cw, ch);
    for (let step = 0; step < 5; step++) {
      const before = v.transformFor(cw, ch);
      const worldX = (ax - before.originX) / before.scale + before.offsetX;
      const worldY = (ay - before.originY) / before.scale + before.offsetY;
      v.zoomIn(cw, ch, ax, ay);
      const after = v.transformFor(cw, ch);
      if (after.scale === before.scale) continue;

      const nowX = (ax - after.originX) / after.scale + after.offsetX;
      const nowY = (ay - after.originY) / after.scale + after.offsetY;
      // A pan pinned to a limit cannot honour the anchor; that is the clamp
      // doing its job, and the invariant sweep above already covers it.
      const pinnedX = WORLD_W * after.scale <= cw
        || v.offsetX === 0
        || v.offsetX === Math.floor(WORLD_W - cw / after.scale);
      const pinnedY = WORLD_H * after.scale <= ch
        || v.offsetY === 0
        || v.offsetY === Math.floor(WORLD_H - ch / after.scale);
      check(`anchor ${ax},${ay} holds x in ${cw}x${ch} at ${after.scale}`,
        pinnedX || Math.abs(nowX - worldX) <= 1, `${worldX} -> ${nowX}`);
      check(`anchor ${ax},${ay} holds y in ${cw}x${ch} at ${after.scale}`,
        pinnedY || Math.abs(nowY - worldY) <= 1, `${worldY} -> ${nowY}`);
    }
  }
}

console.log('--- pan carry ---');
{
  const v = createViewport(WORLD_W, WORLD_H);
  v.fit(300, 300);
  // Anchored on the top-left corner so the zoom leaves the pan where it can be
  // read at a glance.
  v.setScale(4, 300, 300, 0, 0);
  check('pan starts at the origin', v.offsetX === 0 && v.offsetY === 0, `${v.offsetX},${v.offsetY}`);
  v.panBy(-1, 0, 300, 300);
  v.panBy(-1, 0, 300, 300);
  v.panBy(-1, 0, 300, 300);
  check('a sub-pixel drag holds', v.offsetX === 0, `x=${v.offsetX}`);
  v.panBy(-1, 0, 300, 300);
  check('four pointer pixels at zoom 4 move one world pixel', v.offsetX === 1, `x=${v.offsetX}`);
  v.panBy(4, 0, 300, 300);
  check('and it comes back', v.offsetX === 0, `x=${v.offsetX}`);

  // Pushing against a limit must not bank a debt that swallows the return drag.
  v.panBy(2000, 0, 300, 300);
  check('pushing past the left edge stops there', v.offsetX === 0);
  v.panBy(-4, 0, 300, 300);
  check('and the next drag the other way moves immediately', v.offsetX === 1, `x=${v.offsetX}`);
  v.panBy(NaN, NaN, 300, 300);
  check('a broken delta is ignored', v.offsetX === 1 && v.offsetY === 0);
}

console.log('--- hit testing ---');
{
  const RECT_LEFT = 37;
  const RECT_TOP = 11;
  let mismatches = 0;

  for (const [cw, ch] of CONTAINERS) {
    for (const zoom of [1, 2, 3, 6]) {
      for (const [dx, dy] of [[0, 0], [-10000, -10000], [-137, -61]]) {
        const v = createViewport(WORLD_W, WORLD_H);
        v.fit(cw, ch);
        v.setScale(zoom, cw, ch);
        v.panBy(dx, dy, cw, ch);
        const view = v.transformFor(cw, ch);
        const rect = { left: RECT_LEFT, top: RECT_TOP, width: cw, height: ch };

        for (let row = 0; row < GRID_H; row++) {
          for (let col = 0; col < GRID_W; col++) {
            // The centre of the tile, so half-pixel rounding cannot decide it.
            const p = screenOf(view, col * TILE + TILE / 2, row * TILE + TILE / 2);
            const cell = v.toCell(RECT_LEFT + p.x, RECT_TOP + p.y, rect, GRID_W, GRID_H);
            if (cell !== row * GRID_W + col) mismatches++;
          }
        }

        // Just outside each edge of the map.
        const topLeft = screenOf(view, 0, 0);
        const bottomRight = screenOf(view, WORLD_W, WORLD_H);
        check(`off the left edge at ${zoom} in ${cw}x${ch}`,
          v.toCell(RECT_LEFT + topLeft.x - 1, RECT_TOP + topLeft.y + 1, rect, GRID_W, GRID_H) === -1);
        check(`above the top edge at ${zoom} in ${cw}x${ch}`,
          v.toCell(RECT_LEFT + topLeft.x + 1, RECT_TOP + topLeft.y - 1, rect, GRID_W, GRID_H) === -1);
        check(`off the right edge at ${zoom} in ${cw}x${ch}`,
          v.toCell(RECT_LEFT + bottomRight.x, RECT_TOP + bottomRight.y - 1, rect, GRID_W, GRID_H) === -1);
        check(`below the bottom edge at ${zoom} in ${cw}x${ch}`,
          v.toCell(RECT_LEFT + bottomRight.x - 1, RECT_TOP + bottomRight.y, rect, GRID_W, GRID_H) === -1);
      }
    }
  }
  check('every tile centre maps back to its own cell', mismatches === 0, `${mismatches} wrong`);

  const v = createViewport(WORLD_W, WORLD_H);
  v.fit(900, 600);
  const rect = { left: 0, top: 0, width: 900, height: 600 };
  check('a degenerate rect misses', v.toCell(10, 10, { left: 0, top: 0, width: 0, height: 0 }, GRID_W, GRID_H) === -1);
  check('a missing rect misses', v.toCell(10, 10, null, GRID_W, GRID_H) === -1);
  check('the first tile is cell zero', v.toCell(251, 101, rect, GRID_W, GRID_H) === 0);
}

console.log('--- visible tile range ---');
{
  let missed = 0;
  for (const [cw, ch] of CONTAINERS) {
    for (const zoom of [1, 2, 4, 6]) {
      for (const [dx, dy] of [[0, 0], [-10000, -10000], [-220, -90]]) {
        const v = createViewport(WORLD_W, WORLD_H);
        v.fit(cw, ch);
        v.setScale(zoom, cw, ch);
        v.panBy(dx, dy, cw, ch);

        const range = visibleTileRange(v, cw, ch, TILE, GRID_W, GRID_H);
        const label = `range at ${v.scale} in ${cw}x${ch}`;
        check(`${label} is ordered`, range.c0 <= range.c1 && range.r0 <= range.r1, JSON.stringify(range));
        check(`${label} stays on the map`,
          range.c0 >= 0 && range.c1 < GRID_W && range.r0 >= 0 && range.r1 < GRID_H, JSON.stringify(range));

        const view = v.transformFor(cw, ch);
        for (let row = 0; row < GRID_H; row++) {
          for (let col = 0; col < GRID_W; col++) {
            const p = screenOf(view, col * TILE, row * TILE);
            const onScreen = p.x + TILE * view.scale > 0 && p.x < cw
              && p.y + TILE * view.scale > 0 && p.y < ch;
            if (!onScreen) continue;
            if (col < range.c0 || col > range.c1 || row < range.r0 || row > range.r1) missed++;
          }
        }
      }
    }
  }
  check('no visible tile is left out of the range', missed === 0, `${missed} dropped`);

  const v = createViewport(WORLD_W, WORLD_H);
  v.fit(900, 600);
  const all = visibleTileRange(v, 900, 600, TILE, GRID_W, GRID_H);
  check('a fitted map draws every tile',
    all.c0 === 0 && all.r0 === 0 && all.c1 === GRID_W - 1 && all.r1 === GRID_H - 1, JSON.stringify(all));

  v.setScale(6, 900, 600);
  const few = visibleTileRange(v, 900, 600, TILE, GRID_W, GRID_H);
  const tiles = (few.c1 - few.c0 + 1) * (few.r1 - few.r0 + 1);
  check('a zoomed map draws far fewer', tiles < GRID_W * GRID_H / 3, `${tiles} tiles`);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
