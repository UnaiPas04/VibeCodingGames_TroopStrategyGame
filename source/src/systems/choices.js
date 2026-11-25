// Click choices (pure): what the active player can do by clicking a cell or an intersection.
// The board needs no tool buttons: select one of your cells, then click where the troops go
// (cart: next cell, horse: 2 steps) or whom they fight; click an intersection circle to build.

import { MOVES } from '../config.js';
import { CELL_COUNT, POINT_COUNT, cellDistance, pointNeighbors } from './board.js';
import { checkAction, moveCount, portTradeOptions } from './actions.js';
import { playersIn } from './state.js';

/**
 * @typedef {{kind: 'action', action: import('./actions.js').Action}
 *   | {kind: 'attack', from: number, target: number, enemies: number[]}
 *   | {kind: 'move-settlement', point: number}} Choice
 */

/** @typedef {import('./state.js').GameState} GameState */

/** Cart for a neighbor cell, horse for a cell 2 steps away, otherwise null. */
export function moveTypeFor(/** @type {number} */ from, /** @type {number} */ to) {
  const d = cellDistance(from, to);
  for (const type of /** @type {const} */ (['cart', 'horse'])) if (MOVES[type].cells === d) return type;
  return null;
}

/** Enemies the active player can fight in `target`, attacking from `from` (same cell = inside). */
export function attackableEnemies(/** @type {GameState} */ state, /** @type {number} */ from, /** @type {number} */ target) {
  return playersIn(state, target).filter((d) => d !== state.current && !checkAction(state, { type: 'attack', from, target, defender: d, count: 1 }));
}

/**
 * What a click on `cell` can do, with `source` (one of the player's cells) selected or null.
 * @param {GameState} state
 * @param {number | null} source
 * @param {number} cell
 * @returns {Choice[]}
 */
export function cellChoices(state, source, cell) {
  if (state.phase !== 'actions') return [];
  /** @type {Choice[]} */
  const choices = [];
  if (source !== null && source !== cell) {
    const type = moveTypeFor(source, cell);
    if (type) {
      const action = { type, from: source, to: cell };
      if (!checkAction(state, action)) choices.push({ kind: 'action', action });
    }
  }
  if (source !== null) {
    const enemies = attackableEnemies(state, source, cell);
    if (enemies.length) choices.push({ kind: 'attack', from: source, target: cell, enemies });
  }
  if (source === null || source === cell) {
    const recruit = /** @type {const} */ ({ type: 'recruit', cell });
    if (!checkAction(state, recruit)) choices.push({ kind: 'action', action: recruit });
  }
  return choices;
}

/**
 * What a click on an intersection can do: build, promote, conquer, trade, or start moving a settlement.
 * @param {GameState} state
 * @param {number} point
 * @returns {Choice[]}
 */
export function pointChoices(state, point) {
  if (state.phase !== 'actions') return [];
  /** @type {Choice[]} */
  const choices = [];
  /** @type {import('./actions.js').Action[]} */
  const actions = [
    { type: 'build-settlement', point },
    { type: 'promote', point },
    { type: 'conquer', point },
    ...portTradeOptions(state, point).map((pay) => /** @type {const} */ ({ type: 'port-trade', point, pay }))
  ];
  for (const action of actions) if (!checkAction(state, action)) choices.push({ kind: 'action', action });
  if (settlementDestinations(state, point).length) choices.push({ kind: 'move-settlement', point });
  return choices;
}

/** Free intersections where the settlement at `from` can move now. */
export function settlementDestinations(/** @type {GameState} */ state, /** @type {number} */ from) {
  return pointNeighbors(from).filter((to) => !checkAction(state, { type: 'move-settlement', from, to }));
}

/**
 * Cells to highlight once a source is selected: where troops can move, and where they can attack.
 * @param {GameState} state
 * @param {number} source
 */
export function sourceTargets(state, source) {
  /** @type {number[]} */
  const moves = [];
  /** @type {number[]} */
  const attacks = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    for (const c of cellChoices(state, source, cell)) {
      if (c.kind === 'attack') attacks.push(cell);
      else if (c.kind === 'action' && (c.action.type === 'cart' || c.action.type === 'horse')) moves.push(cell);
    }
  }
  return { moves, attacks };
}

/** Intersections with something to do (drawn as circles on the board). */
export function activePoints(/** @type {GameState} */ state) {
  /** @type {number[]} */
  const out = [];
  if (state.phase !== 'actions') return out;
  for (let p = 0; p < POINT_COUNT; p++) if (pointChoices(state, p).length) out.push(p);
  return out;
}

/** Troops a move choice would carry (for its label). */
export const choiceCount = (/** @type {GameState} */ state, /** @type {import('./actions.js').Action} */ action) =>
  action.type === 'cart' || action.type === 'horse' ? moveCount(state, action.type, action.from, action.to) : 0;
