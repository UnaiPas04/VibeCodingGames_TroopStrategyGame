// Board geometry and generation (pure, no DOM).
// Cells: id = row * SIZE + col. Intersections (cell corner points): id = row * (SIZE + 1) + col,
// with row and col in 0..SIZE. See docs/trial-rules.md (T0).

import { BOARD, GOLD, PLAYERS, RESOURCES } from '../config.js';

export const SIZE = BOARD.size;
const POINTS = SIZE + 1;
export const CELL_COUNT = SIZE * SIZE;
export const POINT_COUNT = POINTS * POINTS;

/** Base cells (one per quadrant, see BOARD.bases) in order: top-left, top-right, bottom-right, bottom-left. */
export const BASE_CELLS = BOARD.bases.map(([row, col]) => row * SIZE + col);

/**
 * @typedef {object} Cell
 * @property {number} id
 * @property {number} row
 * @property {number} col
 * @property {'normal' | 'tower' | 'empty'} kind normal: resource + number; tower: gold, no number; empty: unused base.
 * @property {string | null} resource One of RESOURCES, GOLD for tower cells, null for empty bases.
 * @property {number | null} number Dice number (normal cells only).
 * @property {number | null} towerOwner Player index, or null for a grey tower (tower cells only).
 * @property {number[]} troops Troops per player index.
 */

export const cellRow = (/** @type {number} */ id) => Math.floor(id / SIZE);
export const cellCol = (/** @type {number} */ id) => id % SIZE;
export const isCell = (/** @type {number} */ id) => Number.isInteger(id) && id >= 0 && id < CELL_COUNT;
export const isPoint = (/** @type {number} */ id) => Number.isInteger(id) && id >= 0 && id < POINT_COUNT;
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

/** The 2 intersections at the ends of the side shared by two neighboring cells. */
export function sharedSideEnds(/** @type {number} */ a, /** @type {number} */ b) {
  if (!areNeighbors(a, b)) throw new Error(`Cells ${a} and ${b} are not neighbors`);
  const corners = cellCorners(b);
  return cellCorners(a).filter((p) => corners.includes(p));
}

/** Pairs of neighboring cells whose shared side ends at this intersection. */
export function neighborPairsAt(/** @type {number} */ point) {
  const cells = pointCells(point);
  /** @type {[number, number][]} */
  const pairs = [];
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) if (areNeighbors(cells[i], cells[j])) pairs.push([cells[i], cells[j]]);
  }
  return pairs;
}

/** Quadrant index of a cell: 0 top-left, 1 top-right, 2 bottom-right, 3 bottom-left (same order as BASE_CELLS). */
export function quadrantOf(/** @type {number} */ id) {
  const half = SIZE / 2;
  const top = cellRow(id) < half;
  const left = cellCol(id) < half;
  return top ? (left ? 0 : 1) : left ? 3 : 2;
}

/**
 * Build the cells for a new game: balanced quadrants (each number once, 2 of each resource),
 * a tower in each player's base, empty bases for missing players.
 * @param {{shuffle: <T>(list: readonly T[]) => T[]}} rng
 * @param {number} playerCount
 * @returns {Cell[]}
 */
export function generateCells(rng, playerCount) {
  const bases = PLAYERS.basesByCount[playerCount];
  if (!bases) throw new Error(`Unsupported player count: ${playerCount}`);
  if (BASE_CELLS.map(quadrantOf).join() !== '0,1,2,3') throw new Error('BOARD.bases must hold one cell per quadrant, in quadrant order');
  if (SIZE % 2 !== 0) throw new Error(`Board size must be even, got ${SIZE}`);
  const perQuadrant = (SIZE / 2) ** 2 - 1;
  if (perQuadrant % BOARD.numbers.length !== 0 || perQuadrant % RESOURCES.length !== 0) {
    throw new Error(`A quadrant has ${perQuadrant} normal cells: it must split evenly into numbers and resources`);
  }

  /** @type {Cell[]} */
  const cells = Array.from({ length: CELL_COUNT }, (_, id) => ({
    id,
    row: cellRow(id),
    col: cellCol(id),
    kind: 'normal',
    resource: null,
    number: null,
    towerOwner: null,
    troops: Array(playerCount).fill(0)
  }));

  for (let q = 0; q < 4; q++) {
    const quadrantCells = cells.filter((cell) => quadrantOf(cell.id) === q && !BASE_CELLS.includes(cell.id));
    const numbers = rng.shuffle(repeat(BOARD.numbers, perQuadrant / BOARD.numbers.length));
    const resources = rng.shuffle(repeat(RESOURCES, perQuadrant / RESOURCES.length));
    quadrantCells.forEach((cell, i) => {
      cell.number = numbers[i];
      cell.resource = resources[i];
    });
  }

  BASE_CELLS.forEach((id, base) => {
    const owner = bases.indexOf(base);
    const cell = cells[id];
    if (owner >= 0) {
      cell.kind = 'tower';
      cell.resource = GOLD;
      cell.towerOwner = owner;
    } else {
      cell.kind = 'empty';
    }
  });
  return cells;
}

/**
 * @template T
 * @param {readonly T[]} list
 * @param {number} times
 */
function repeat(list, times) {
  return Array.from({ length: times }, () => list).flat();
}
