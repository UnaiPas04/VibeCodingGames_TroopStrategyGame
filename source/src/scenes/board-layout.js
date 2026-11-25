// Where things are drawn on the canvas (pure, game units): cells, intersections, troop slots, hit tests.

import { BOARD_VIEW, TROOPS } from '../config.js';
import { CELL_COUNT, POINT_COUNT, SIZE, cellCol, cellRow, pointCol, pointRow } from '../systems/board.js';

const { margin, cell: CELL } = BOARD_VIEW;

/** Top-left corner and size of a cell. */
export const cellRect = (/** @type {number} */ id) => ({ x: margin + cellCol(id) * CELL, y: margin + cellRow(id) * CELL, w: CELL, h: CELL });

export const cellCenter = (/** @type {number} */ id) => ({ x: margin + (cellCol(id) + 0.5) * CELL, y: margin + (cellRow(id) + 0.5) * CELL });

export const pointPos = (/** @type {number} */ id) => ({ x: margin + pointCol(id) * CELL, y: margin + pointRow(id) * CELL });

/**
 * Position of troop slot k (0..maxPerCell-1) of a cell: a circle around the center, starting at the top.
 * @param {number} id
 * @param {number} k
 */
export function troopSlot(id, k) {
  const c = cellCenter(id);
  const angle = -Math.PI / 2 + (k * 2 * Math.PI) / TROOPS.maxPerCell;
  return { x: c.x + Math.cos(angle) * BOARD_VIEW.troopRing, y: c.y + Math.sin(angle) * BOARD_VIEW.troopRing };
}

/**
 * Cell under a position (or null outside the board) and the nearest intersection within pick range.
 * @param {number} x
 * @param {number} y
 */
export function hitTest(x, y) {
  const col = Math.floor((x - margin) / CELL);
  const row = Math.floor((y - margin) / CELL);
  const cell = col >= 0 && col < SIZE && row >= 0 && row < SIZE ? row * SIZE + col : null;
  const pc = Math.round((x - margin) / CELL);
  const pr = Math.round((y - margin) / CELL);
  let point = null;
  if (pc >= 0 && pc <= SIZE && pr >= 0 && pr <= SIZE) {
    const id = pr * (SIZE + 1) + pc;
    const p = pointPos(id);
    if (Math.hypot(p.x - x, p.y - y) <= BOARD_VIEW.pointPick) point = id;
  }
  return { cell: cell !== null && cell < CELL_COUNT ? cell : null, point: point !== null && point < POINT_COUNT ? point : null };
}
