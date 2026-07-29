/**
 * Saving a run: the PNG snapshot, and the one line of text that describes how
 * the run ended.
 *
 * Those two belong in the same module because they have to agree. A screenshot
 * captioned ARRIVED under a board the interface called OUT OF ENERGY is worse
 * than an uncaptioned one, so the wording lives in exactly one place and both
 * the image and the on-screen readouts pull from it.
 *
 * The snapshot composites the canvas *backing store* rather than the element as
 * it appears on screen. The board is displayed through a whole-number CSS zoom;
 * capturing at display size would resample the art and leave grey fringes along
 * every outline, which is the one thing the whole render pipeline is built to
 * avoid.
 *
 * @see instruction.md - "UI Principles", "Typography"
 */
import { PALETTE } from '../core/palette.js';
import { PHASE } from '../core/playback.js';
import { ALGORITHM_BY_ID } from '../core/algorithms/index.js';
import { px } from '../render/art.js';

/** Caption strip: a rule, then three text rows, all on the 8px grid. */
const FOOTER_H = 56;
const FOOTER_PAD = 8;
const LINE_H = 16;
const RULE_H = 2;

/**
 * The one short line that describes how a run ended.
 *
 * The order of these tests is the entire content of the function. A search that
 * found nothing has to be reported before any energy warning, because a path
 * that does not exist cannot have run out of fuel - reversing the two makes the
 * flag blame the vehicle for the map.
 *
 * @param {Object} [stats] - playback stats, or anything before the first run
 * @returns {{text: string, bad: boolean}|null} null when there is nothing to say
 */
export function runOutcome(stats) {
  if (!stats || !stats.phase) return null;
  if (stats.phase === PHASE.SEARCH) return { text: 'SEARCHING', bad: false };
  if (!stats.found) return { text: 'NO PATH', bad: true };
  if (stats.phase !== PHASE.DONE) return { text: 'PATH FOUND', bad: false };
  if (stats.stalled) return { text: 'OUT OF ENERGY', bad: true };
  return { text: `ARRIVED - ${stats.pathLength} TILES`, bad: false };
}

/**
 * Composites the world canvas with a caption strip and triggers a PNG save.
 *
 * @param {HTMLCanvasElement|null} canvas - the world canvas, at world resolution
 * @param {Object} [info]
 * @param {string} [info.algorithm] - algorithm id or label
 * @param {Object} [info.stats] - playback stats for the run being saved
 * @param {string} [info.seedCode] - the five-character city code
 * @param {string} [info.stageLabel] - the time of day the shot was taken at
 */
export function downloadSnapshot(canvas, info = {}) {
  // The button is live before the first frame is drawn, so an absent canvas is
  // an ordinary state to sit through rather than something to throw over.
  if (!canvas || !canvas.width || !canvas.height) return;

  const { algorithm = '', stats = {}, seedCode = '-----', stageLabel = '' } = info;
  const label = ALGORITHM_BY_ID[algorithm]?.label ?? algorithm ?? '-';

  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height + FOOTER_H;

  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0);

  const top = canvas.height;
  px(ctx, 0, top, out.width, FOOTER_H, PALETTE.bg);
  px(ctx, 0, top, out.width, RULE_H, PALETTE.black);

  const outcome = runOutcome(stats);
  const lines = [
    `${label} - ${outcome ? outcome.text : 'NOT SOLVED'}`,
    `COST ${stats.found ? stats.cost : '-'}  STEPS ${stats.steps ?? 0}  SEEN ${stats.visited ?? 0}`,
    `SEED ${seedCode}${stageLabel ? `  ${stageLabel}` : ''}`,
  ];

  // A whole-number size in the same face the interface uses, so the caption is
  // the same pixel grid as the picture above it. Any fractional size would be
  // hinted onto half pixels and read as a different font entirely.
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = PALETTE.black;
  lines.forEach((line, i) => {
    ctx.fillText(line, FOOTER_PAD, top + RULE_H + FOOTER_PAD + i * LINE_H);
  });

  const link = document.createElement('a');
  link.href = out.toDataURL('image/png');
  link.download = `pixel-city-${seedCode}-${slug(label)}.png`;
  // Firefox only honours a click on an anchor that is actually in the document.
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Reduces an algorithm name to something a file system will accept.
 *
 * "A*" is a legal label and an illegal Windows filename, which is the whole
 * reason this exists.
 *
 * @param {string} value
 * @returns {string}
 */
function slug(value) {
  const clean = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || 'run';
}
