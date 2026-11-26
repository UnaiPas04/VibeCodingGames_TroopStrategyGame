// Where things are drawn on the canvas (pure, game units): cells, intersections, edges, hit tests.

import { BOARD_VIEW } from '../config.js';
import { EDGE_COUNT, SIZE, cellCol, cellRow, edgeEnds, pointCol, pointRow } from '../systems/board.js';

const { margin, cell: CELL } = BOARD_VIEW;

/** Top-left corner and size of a cell. */
export const cellRect = (/** @type {number} */ id) => ({ x: margin + cellCol(id) * CELL, y: margin + cellRow(id) * CELL, w: CELL, h: CELL });

export const cellCenter = (/** @type {number} */ id) => ({ x: margin + (cellCol(id) + 0.5) * CELL, y: margin + (cellRow(id) + 0.5) * CELL });

export const pointPos = (/** @type {number} */ id) => ({ x: margin + pointCol(id) * CELL, y: margin + pointRow(id) * CELL });

/** Middle of an edge (a cell side). */
export function edgeMid(/** @type {number} */ id) {
  const [a, b] = edgeEnds(id).map(pointPos);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Cell under a position (or null outside the board), the nearest intersection and edge middle, and their distances.
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
  let edge = 0;
  let edgeDistance = Infinity;
  for (let e = 0; e < EDGE_COUNT; e++) {
    const m = edgeMid(e);
    const d = Math.hypot(m.x - x, m.y - y);
    if (d < edgeDistance) {
      edge = e;
      edgeDistance = d;
    }
  }
  return { cell, point, pointDistance: Math.hypot(p.x - x, p.y - y), edge, edgeDistance };
}
