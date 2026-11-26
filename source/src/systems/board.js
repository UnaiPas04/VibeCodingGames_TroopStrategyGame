// Board geometry and generation (pure, no DOM).
// Cells: id = row * SIZE + col. Intersections (cell corner points): id = row * (SIZE + 1) + col,
// with row and col in 0..SIZE. Edges (cell sides, where roads go) join two neighboring intersections:
// first the horizontal ones (id = row * SIZE + col), then the vertical ones. See docs/trial-rules.md.

import { BOARD, GOLD, RESOURCES } from '../config.js';

export const SIZE = BOARD.size;
const POINTS = SIZE + 1;
export const CELL_COUNT = SIZE * SIZE;
export const POINT_COUNT = POINTS * POINTS;
const HORIZONTAL = POINTS * SIZE;
export const EDGE_COUNT = 2 * HORIZONTAL;

/** Gold cells (one per quadrant, see BOARD.goldCells) in quadrant order: top-left, top-right, bottom-right, bottom-left. */
export const GOLD_CELLS = BOARD.goldCells.map(([row, col]) => row * SIZE + col);

/**
 * @typedef {object} Cell
 * @property {number} id
 * @property {number} row
 * @property {number} col
 * @property {'normal' | 'gold'} kind normal: one of RESOURCES; gold: produces gold.
 * @property {string} resource One of RESOURCES, or GOLD.
 * @property {number} number Dice number.
 * @property {number[]} troops Troops per player index (filled in by createState).
 */

export const cellRow = (/** @type {number} */ id) => Math.floor(id / SIZE);
export const cellCol = (/** @type {number} */ id) => id % SIZE;
export const isCell = (/** @type {number} */ id) => Number.isInteger(id) && id >= 0 && id < CELL_COUNT;
export const isPoint = (/** @type {number} */ id) => Number.isInteger(id) && id >= 0 && id < POINT_COUNT;
export const isEdge = (/** @type {number} */ id) => Number.isInteger(id) && id >= 0 && id < EDGE_COUNT;
export const pointRow = (/** @type {number} */ id) => Math.floor(id / POINTS);
export const pointCol = (/** @type {number} */ id) => id % POINTS;
const pointId = (/** @type {number} */ row, /** @type {number} */ col) => row * POINTS + col;

/** Orthogonal neighbor cells. */
export function cellNeighbors(/** @type {number} */ id) {
  const r = cellRow(id);
  const c = cellCol(id);
  /** @type {number[]} */
  const out = [];
  if (r > 0) out.push(id - SIZE);
  if (c < SIZE - 1) out.push(id + 1);
  if (r < SIZE - 1) out.push(id + SIZE);
  if (c > 0) out.push(id - 1);
  return out;
}

/** Two cells that share a side. */
export const areNeighbors = (/** @type {number} */ a, /** @type {number} */ b) => cellNeighbors(a).includes(b);

/** Orthogonal steps between two cells. */
export const cellDistance = (/** @type {number} */ a, /** @type {number} */ b) =>
  Math.abs(cellRow(a) - cellRow(b)) + Math.abs(cellCol(a) - cellCol(b));

/** The 4 intersections at the corners of a cell. */
export function cellCorners(/** @type {number} */ id) {
  const r = cellRow(id);
  const c = cellCol(id);
  return [pointId(r, c), pointId(r, c + 1), pointId(r + 1, c + 1), pointId(r + 1, c)];
}

/** Cells touching an intersection: 4 (inner), 2 (coast) or 1 (corner). */
export function pointCells(/** @type {number} */ id) {
  const r = pointRow(id);
  const c = pointCol(id);
  /** @type {number[]} */
  const out = [];
  for (const [dr, dc] of [
    [-1, -1],
    [-1, 0],
    [0, -1],
    [0, 0]
  ]) {
    const row = r + dr;
    const col = c + dc;
    if (row >= 0 && row < SIZE && col >= 0 && col < SIZE) out.push(row * SIZE + col);
  }
  return out;
}

/** @returns {'inner' | 'coast' | 'corner'} */
export function pointKind(/** @type {number} */ id) {
  const n = pointCells(id).length;
  return n === 4 ? 'inner' : n === 2 ? 'coast' : 'corner';
}

/** Orthogonal neighbor intersections. */
export function pointNeighbors(/** @type {number} */ id) {
  const r = pointRow(id);
  const c = pointCol(id);
  /** @type {number[]} */
  const out = [];
  if (r > 0) out.push(id - POINTS);
  if (c < SIZE) out.push(id + 1);
  if (r < SIZE) out.push(id + POINTS);
  if (c > 0) out.push(id - 1);
  return out;
}

/** The 2 intersections at the ends of an edge. @returns {[number, number]} */
export function edgeEnds(/** @type {number} */ id) {
  if (!isEdge(id)) throw new Error(`Invalid edge: ${id}`);
  if (id < HORIZONTAL) {
    const a = pointId(Math.floor(id / SIZE), id % SIZE);
    return [a, a + 1];
  }
  const v = id - HORIZONTAL;
  const a = pointId(Math.floor(v / POINTS), v % POINTS);
  return [a, a + POINTS];
}

/** The edge joining two neighboring intersections, or null if they are not neighbors. */
export function edgeBetween(/** @type {number} */ a, /** @type {number} */ b) {
  if (!isPoint(a) || !isPoint(b) || !pointNeighbors(a).includes(b)) return null;
  const [p, q] = a < b ? [a, b] : [b, a];
  if (q === p + 1) return pointRow(p) * SIZE + pointCol(p);
  return HORIZONTAL + p;
}

/** Edges that start at an intersection: 4 (inner), 3 (coast) or 2 (corner). */
export const pointEdges = (/** @type {number} */ id) => pointNeighbors(id).map((n) => /** @type {number} */ (edgeBetween(id, n)));

/** The 4 sides of a cell (edges). */
export function cellEdges(/** @type {number} */ id) {
  const [a, b, c, d] = cellCorners(id);
  return /** @type {number[]} */ ([edgeBetween(a, b), edgeBetween(b, c), edgeBetween(d, c), edgeBetween(a, d)]);
}

/** Two intersections on the corners of a common cell (neighbors, or opposite corners of a cell). */
export function pointsShareCell(/** @type {number} */ a, /** @type {number} */ b) {
  if (a === b) return false;
  const cells = pointCells(b);
  return pointCells(a).some((c) => cells.includes(c));
}

/** Quadrant index of a cell: 0 top-left, 1 top-right, 2 bottom-right, 3 bottom-left (same order as GOLD_CELLS). */
export function quadrantOf(/** @type {number} */ id) {
  const half = SIZE / 2;
  const top = cellRow(id) < half;
  const left = cellCol(id) < half;
  return top ? (left ? 0 : 1) : left ? 3 : 2;
}

/**
 * Build the cells for a new game. Balanced quadrants: each has a gold cell, 2 of each resource, and
 * every number once plus one extra number (BOARD.extraNumbers, a different one per quadrant), so all
 * 9 of its cells have a number.
 * @param {{shuffle: <T>(list: readonly T[]) => T[]}} rng
 * @returns {Cell[]}
 */
export function generateCells(rng) {
  if (GOLD_CELLS.map(quadrantOf).join() !== '0,1,2,3') throw new Error('BOARD.goldCells must hold one cell per quadrant, in quadrant order');
  if (SIZE % 2 !== 0) throw new Error(`Board size must be even, got ${SIZE}`);
  const perQuadrant = (SIZE / 2) ** 2;
  if (BOARD.numbers.length + 1 !== perQuadrant || BOARD.extraNumbers.length !== 4 || (perQuadrant - 1) % RESOURCES.length !== 0) {
    throw new Error(`A quadrant has ${perQuadrant} cells: one gold cell, the numbers once and one extra number`);
  }

  /** @type {Cell[]} */
  const cells = Array.from({ length: CELL_COUNT }, (_, id) => ({ id, row: cellRow(id), col: cellCol(id), kind: 'normal', resource: '', number: 0, troops: [] }));
  const extras = rng.shuffle(BOARD.extraNumbers);
  for (let q = 0; q < 4; q++) {
    const quadrantCells = cells.filter((cell) => quadrantOf(cell.id) === q);
    const numbers = rng.shuffle([...BOARD.numbers, extras[q]]);
    const resources = rng.shuffle(Array.from({ length: (perQuadrant - 1) / RESOURCES.length }, () => RESOURCES).flat());
    quadrantCells.forEach((cell, i) => {
      cell.number = numbers[i];
      if (GOLD_CELLS.includes(cell.id)) {
        cell.kind = 'gold';
        cell.resource = GOLD;
      } else {
        cell.resource = /** @type {string} */ (resources.pop());
      }
    });
  }
  return cells;
}
