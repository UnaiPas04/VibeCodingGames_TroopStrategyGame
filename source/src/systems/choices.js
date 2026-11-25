// Click choices (pure): what the active player can do by clicking a cell or an intersection.
// The board needs no tool buttons: select one of your cells, pick how many troops, then click where
// they go (any cell up to MOVE.maxCells away) or whom they fight; click an intersection circle to build.

import { CELL_COUNT, POINT_COUNT, pointNeighbors } from './board.js';
import { checkAction, fittingCount, portTradeOptions } from './actions.js';
import { playersIn } from './state.js';

/**
 * @typedef {{kind: 'action', action: import('./actions.js').Action}
 *   | {kind: 'attack', from: number, target: number, enemies: number[]}
 *   | {kind: 'move-settlement', point: number}} Choice
 */

/** @typedef {import('./state.js').GameState} GameState */

/** Enemies the active player can fight in `target`, attacking from `from` (same cell = inside). */
export function attackableEnemies(/** @type {GameState} */ state, /** @type {number} */ from, /** @type {number} */ target) {
  return playersIn(state, target).filter((d) => d !== state.current && !checkAction(state, { type: 'attack', from, target, defender: d, count: 1 }));
}

/**
 * The move a click on `to` makes: `wanted` troops, or fewer if fewer fit; null if it is not valid.
 * @param {GameState} state
 * @param {number} from
 * @param {number} to
 * @param {number} wanted
 * @returns {import('./actions.js').Action | null}
 */
export function moveTo(state, from, to, wanted) {
  const action = /** @type {const} */ ({ type: 'move', from, to, count: fittingCount(state, wanted, from, to) });
  return checkAction(state, action) ? null : action;
}

/**
 * What a click on `cell` can do, with `source` (one of the player's cells) selected or null,
 * and `count` troops picked to move.
 * @param {GameState} state
 * @param {number | null} source
 * @param {number} cell
 * @param {number} [count]
 * @returns {Choice[]}
 */
export function cellChoices(state, source, cell, count = 1) {
  if (state.phase !== 'actions') return [];
  /** @type {Choice[]} */
  const choices = [];
  if (source !== null && source !== cell) {
    const action = moveTo(state, source, cell, count);
    if (action) choices.push({ kind: 'action', action });
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
 * Cells to highlight once a source is selected: where `count` troops can move, and where they can attack.
 * @param {GameState} state
 * @param {number} source
 * @param {number} count
 */
export function sourceTargets(state, source, count) {
  /** @type {number[]} */
  const moves = [];
  /** @type {number[]} */
  const attacks = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    for (const c of cellChoices(state, source, cell, count)) {
      if (c.kind === 'attack') attacks.push(cell);
      else if (c.kind === 'action' && c.action.type === 'move') moves.push(cell);
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
