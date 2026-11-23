// Simple 2D collision response for solid bodies: boxes (AABB) and circles, pushing by mass,
// static bodies (mass 0) and world bounds. Pure functions: tested in tests/physics.test.js.
//
// Optional module. Games without solid bodies delete src/physics/, tests/physics.test.js and the
// lines tagged [module:physics] (see .claude/templates/game-2d/MODULES.md). Overlap tests without response (pickups,
// triggers) stay in core/math.js.
//
// Pair checks are O(n²): fine for a few dozen bodies. For hundreds, add a broad phase
// (spatial hash, see the game-architecture skill) and call separate() on nearby pairs only.

import { clamp } from '../core/math.js';

/**
 * A solid body. With `r` it is a circle (x/y = center); otherwise a box (x/y = top-left, w/h = size).
 * @typedef {object} Body
 * @property {number} x
 * @property {number} y
 * @property {number} [w]
 * @property {number} [h]
 * @property {number} [r]
 * @property {number} [mass=1] 0 = static: never moves, pushes others.
 * @property {number} [vx]
 * @property {number} [vy]
 */

/** @typedef {{x: number, y: number}} Vec */

/** @param {Body} b */
const isCircle = (b) => typeof b.r === 'number';

/**
 * Minimum translation that moves `a` out of `b`, or null if they do not overlap.
 * @param {Body} a
 * @param {Body} b
 * @returns {Vec | null}
 */
export function penetration(a, b) {
  if (isCircle(a) && isCircle(b)) return circleCircle(a, b);
  if (isCircle(a)) return circleBox(a, b);
  if (isCircle(b)) {
    const v = circleBox(b, a);
    return v && { x: -v.x, y: -v.y };
  }
  return boxBox(a, b);
}

/** @param {Body} a @param {Body} b @returns {Vec | null} */
function boxBox(a, b) {
  const aw = a.w ?? 0, ah = a.h ?? 0, bw = b.w ?? 0, bh = b.h ?? 0;
  const left = b.x + bw - a.x; // push a to the right by this much
  const right = a.x + aw - b.x; // push a to the left by this much
  const up = a.y + ah - b.y;
  const down = b.y + bh - a.y;
  if (left <= 0 || right <= 0 || up <= 0 || down <= 0) return null;
  const px = left < right ? left : -right;
  const py = down < up ? down : -up;
  return Math.abs(px) < Math.abs(py) ? { x: px, y: 0 } : { x: 0, y: py };
}

/** @param {Body} a @param {Body} b @returns {Vec | null} */
function circleCircle(a, b) {
  const ra = a.r ?? 0, rb = b.r ?? 0;
  const dx = a.x - b.x, dy = a.y - b.y;
  const d = Math.hypot(dx, dy);
  const depth = ra + rb - d;
  if (depth <= 0) return null;
  if (d === 0) return { x: depth, y: 0 }; // same center: pick an axis
  return { x: (dx / d) * depth, y: (dy / d) * depth };
}

/** @param {Body} c circle @param {Body} b box @returns {Vec | null} */
function circleBox(c, b) {
  const r = c.r ?? 0, bw = b.w ?? 0, bh = b.h ?? 0;
  const nx = clamp(c.x, b.x, b.x + bw);
  const ny = clamp(c.y, b.y, b.y + bh);
  const dx = c.x - nx, dy = c.y - ny;
  const d = Math.hypot(dx, dy);
  if (d > 0) return d < r ? { x: (dx / d) * (r - d), y: (dy / d) * (r - d) } : null;
  // Center inside the box: push out through the nearest side.
  const exits = [
    { x: b.x - c.x - r, y: 0 },
    { x: b.x + bw - c.x + r, y: 0 },
    { x: 0, y: b.y - c.y - r },
    { x: 0, y: b.y + bh - c.y + r }
  ];
  return exits.reduce((best, v) => (Math.abs(v.x + v.y) < Math.abs(best.x + best.y) ? v : best));
}

/**
 * Push two overlapping bodies apart, sharing the correction by inverse mass. If they move into
 * each other, they end up moving together along the contact normal (inelastic: equal masses push
 * at half speed; a static body stops the other one). Returns the translation applied to `a` (+ `b` got
 * the opposite share), or null if they did not overlap.
 * @param {Body} a
 * @param {Body} b
 * @returns {Vec | null}
 */
export function separate(a, b) {
  return push(a, b, inverseMass(a), inverseMass(b));
}

/**
 * @param {Body} a
 * @param {Body} b
 * @param {number} ia Inverse mass used for a (0 = does not move).
 * @param {number} ib
 * @returns {Vec | null}
 */
function push(a, b, ia, ib) {
  const mtv = penetration(a, b);
  if (!mtv) return null;
  const sum = ia + ib;
  if (sum === 0) return mtv; // both static
  a.x += (mtv.x * ia) / sum;
  a.y += (mtv.y * ia) / sum;
  b.x -= (mtv.x * ib) / sum;
  b.y -= (mtv.y * ib) / sum;

  const len = Math.hypot(mtv.x, mtv.y);
  const nx = mtv.x / len; // normal pointing from b to a
  const ny = mtv.y / len;
  const approaching = ((a.vx ?? 0) - (b.vx ?? 0)) * nx + ((a.vy ?? 0) - (b.vy ?? 0)) * ny;
  if (approaching < 0) {
    const j = -approaching / sum; // impulse that cancels the approach
    if (a.vx !== undefined && a.vy !== undefined) {
      a.vx += j * ia * nx;
      a.vy += j * ia * ny;
    }
    if (b.vx !== undefined && b.vy !== undefined) {
      b.vx -= j * ib * nx;
      b.vy -= j * ib * ny;
    }
  }
  return mtv;
}

/** @param {Body} body */
const inverseMass = (body) => {
  const m = body.mass ?? 1;
  return m === 0 ? 0 : 1 / m;
};

/**
 * Keep a body inside the world rectangle [0, w] x [0, h]. Returns true if it had to be moved.
 * @param {Body} body
 * @param {{w: number, h: number}} bounds
 */
export function clampToBounds(body, bounds) {
  const { x, y } = body;
  if (isCircle(body)) {
    const r = body.r ?? 0;
    body.x = clamp(body.x, r, bounds.w - r);
    body.y = clamp(body.y, r, bounds.h - r);
  } else {
    body.x = clamp(body.x, 0, bounds.w - (body.w ?? 0));
    body.y = clamp(body.y, 0, bounds.h - (body.h ?? 0));
  }
  return body.x !== x || body.y !== y;
}

/**
 * Separate every overlapping pair of bodies. A few iterations settle chains (A pushes B into C).
 * A body stopped by the bounds acts as static for the remaining iterations, so whoever pushes
 * it into a wall is blocked instead of overlapping it.
 * @param {Body[]} bodies
 * @param {object} [options]
 * @param {number} [options.iterations=3]
 * @param {{w: number, h: number}} [options.bounds] Clamp bodies inside after each iteration.
 * @param {(a: Body, b: Body, mtv: Vec) => void} [options.onContact] Called once per touching pair.
 */
export function resolveCollisions(bodies, { iterations = 3, bounds, onContact } = {}) {
  /** @type {Set<Body>} */
  const pinned = new Set();
  const im = (/** @type {Body} */ b) => (pinned.has(b) ? 0 : inverseMass(b));
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const ia = im(a);
        const ib = im(b);
        if (ia + ib === 0) continue;
        const mtv = push(a, b, ia, ib);
        if (mtv && it === 0) onContact?.(a, b, mtv);
      }
    }
    if (bounds) {
      for (const body of bodies) if (inverseMass(body) > 0 && clampToBounds(body, bounds)) pinned.add(body);
    }
  }
}
