// Player entity: plain data + pure functions (no canvas, no DOM) so it can be unit tested.

import { approach, clamp } from '../core/math.js';

/** @typedef {{x: number, y: number, w: number, h: number, vx: number, vy: number}} Player */

/**
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @returns {Player}
 */
export function createPlayer(x, y, size) {
  return { x, y, w: size, h: size, vx: 0, vy: 0 };
}

/**
 * Move towards the input direction with acceleration, staying inside the bounds.
 * @param {Player} p
 * @param {{x: number, y: number}} dir Input direction, each axis in [-1, 1].
 * @param {{speed: number, accel: number}} tuning
 * @param {{w: number, h: number}} bounds
 * @param {number} dt
 */
export function updatePlayer(p, dir, tuning, bounds, dt) {
  const len = Math.hypot(dir.x, dir.y);
  const nx = len > 1 ? dir.x / len : dir.x; // diagonals are not faster
  const ny = len > 1 ? dir.y / len : dir.y;
  p.vx = approach(p.vx, nx * tuning.speed, tuning.accel * dt);
  p.vy = approach(p.vy, ny * tuning.speed, tuning.accel * dt);
  p.x = clamp(p.x + p.vx * dt, 0, bounds.w - p.w);
  p.y = clamp(p.y + p.vy * dt, 0, bounds.h - p.h);
}
