// Small math helpers. Pure functions: safe to unit test in Node.

/** @typedef {{x: number, y: number}} Vec */
/** @typedef {{x: number, y: number, w: number, h: number}} Rect  x/y = top-left corner */
/** @typedef {{x: number, y: number, r: number}} Circle  x/y = center */

export const clamp = (/** @type {number} */ v, /** @type {number} */ min, /** @type {number} */ max) =>
  v < min ? min : v > max ? max : v;
export const lerp = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ t) => a + (b - a) * t;
/** Frame-rate independent smoothing: approach(current, target, sharpness, dt). */
export const damp = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ k, /** @type {number} */ dt) =>
  lerp(a, b, 1 - Math.exp(-k * dt));
export const approach = (/** @type {number} */ v, /** @type {number} */ target, /** @type {number} */ step) =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target);

export const vec = (x = 0, y = 0) => ({ x, y });
export const len = (/** @type {Vec} */ v) => Math.hypot(v.x, v.y);
export const dist = (/** @type {Vec} */ a, /** @type {Vec} */ b) => Math.hypot(a.x - b.x, a.y - b.y);
/** @param {Vec} v */
export function normalize(v) {
  const l = Math.hypot(v.x, v.y);
  return l > 0 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 };
}

/** @param {Rect} a @param {Rect} b */
export const rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** @param {Circle} a @param {Circle} b */
export function circlesOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.r + b.r;
  return dx * dx + dy * dy < r * r;
}

/** @param {Circle} c @param {Rect} r */
export function circleRectOverlap(c, r) {
  const nx = clamp(c.x, r.x, r.x + r.w);
  const ny = clamp(c.y, r.y, r.y + r.h);
  const dx = c.x - nx;
  const dy = c.y - ny;
  return dx * dx + dy * dy < c.r * c.r;
}

/** @param {Vec} p @param {Rect} r */
export const pointInRect = (p, r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

/**
 * Minimum translation to push `a` out of `b` (axis of least penetration), or null if not overlapping.
 * @param {Rect} a @param {Rect} b
 */
export function rectPenetration(a, b) {
  const dx1 = b.x + b.w - a.x;
  const dx2 = a.x + a.w - b.x;
  const dy1 = b.y + b.h - a.y;
  const dy2 = a.y + a.h - b.y;
  if (dx1 <= 0 || dx2 <= 0 || dy1 <= 0 || dy2 <= 0) return null;
  const px = dx1 < dx2 ? dx1 : -dx2;
  const py = dy1 < dy2 ? dy1 : -dy2;
  return Math.abs(px) < Math.abs(py) ? { x: px, y: 0 } : { x: 0, y: py };
}
