// Where things are drawn on the canvas (pure, game units): cells, intersections, troop slots, hit tests.

import { BOARD_VIEW } from '../config.js';
import { SIZE, cellCol, cellRow, pointCol, pointRow } from '../systems/board.js';

const { margin, cell: CELL } = BOARD_VIEW;

/** Top-left corner and size of a cell. */
export const cellRect = (/** @type {number} */ id) => ({ x: margin + cellCol(id) * CELL, y: margin + cellRow(id) * CELL, w: CELL, h: CELL });

export const cellCenter = (/** @type {number} */ id) => ({ x: margin + (cellCol(id) + 0.5) * CELL, y: margin + (cellRow(id) + 0.5) * CELL });

export const pointPos = (/** @type {number} */ id) => ({ x: margin + pointCol(id) * CELL, y: margin + pointRow(id) * CELL });

/**
 * Position of troop slot k of a cell with `slots` places: a circle around the center, starting at the top.
 * @param {number} id
 * @param {number} k
 * @param {number} slots
 */
export function troopSlot(id, k, slots) {
  const c = cellCenter(id);
  const angle = -Math.PI / 2 + (k * 2 * Math.PI) / slots;
  return { x: c.x + Math.cos(angle) * BOARD_VIEW.troopRing, y: c.y + Math.sin(angle) * BOARD_VIEW.troopRing };
}

/**
 * Cell under a position (or null outside the board), the nearest intersection and its distance.
 * @param {number} x
 * @param {number} y
 */
export function hitTest(x, y) {
  const col = Math.floor((x - margin) / CELL);
  const row = Math.floor((y - margin) / CELL);
  const cell = col >= 0 && col < SIZE && row >= 0 && row < SIZE ? row * SIZE + col : null;
  const pc = Math.min(SIZE, Math.max(0, Math.round((x - margin) / CELL)));
  const pr = Math.min(SIZE, Math.max(0, Math.round((y - margin) / CELL)));
  const point = pr * (SIZE + 1) + pc;
  const p = pointPos(point);
  return { cell, point, pointDistance: Math.hypot(p.x - x, p.y - y) };
}
