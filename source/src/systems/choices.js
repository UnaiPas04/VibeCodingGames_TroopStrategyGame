// Click choices (pure): what the active player can do by clicking a cell, an intersection or a cell side.
// The board needs no tool buttons: click a road slot (middle of a cell side) to build a road; an
// intersection circle to place your start building, build, promote, trade, move a settlement or attack a
// rival building; one of your cells to pick troops, then where they go or whom they fight.

import { BUILDING_BONUS } from '../config.js';
import { CELL_COUNT, EDGE_COUNT, POINT_COUNT, pointNeighbors } from './board.js';
import { checkAction, fittingCount, portTradeOptions } from './actions.js';
import { buildingsOf, playersIn, troopsOf } from './state.js';

/**
 * @typedef {{kind: 'action', action: import('./actions.js').Action}
 *   | {kind: 'move-settlement', point: number}
 *   | {kind: 'attack', from: number, target: number, enemies: number[]}
 *   | {kind: 'attack-building', from: number, target: number}} Choice
 */

/** @typedef {import('./state.js').GameState} GameState */

/** Enemies the active player can fight in `target`, attacking from the neighboring cell `from` (or from inside: same cell). */
export function attackableEnemies(/** @type {GameState} */ state, /** @type {number} */ from, /** @type {number} */ target) {
  const count = from === target ? troopsOf(state, from, state.current) : 1;
  return playersIn(state, target).filter((d) => d !== state.current && !checkAction(state, { type: 'attack', from, target, defender: d, count }));
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

/** The player's strongest building that can attack the rival building at `target`, or null. */
export function bestAttacker(/** @type {GameState} */ state, /** @type {number} */ target) {
  let best = null;
  for (const [point, b] of buildingsOf(state, state.current)) {
    if (checkAction(state, { type: 'attack-building', from: point, target })) continue;
    if (best === null || BUILDING_BONUS[b.type] > BUILDING_BONUS[state.buildings[best].type]) best = point;
  }
  return best;
}

/**
 * What a click on an intersection can do: place the start building (setup), build, promote, trade,
 * start moving a settlement, or attack a rival building.
 * @param {GameState} state
 * @param {number} point
 * @returns {Choice[]}
 */
export function pointChoices(state, point) {
  if (state.phase === 'setup') {
    const action = /** @type {const} */ ({ type: 'place-start', point });
    return checkAction(state, action) ? [] : [{ kind: 'action', action }];
  }
  if (state.phase !== 'actions') return [];
  /** @type {Choice[]} */
  const choices = [];
  /** @type {import('./actions.js').Action[]} */
  const actions = [
    { type: 'build-settlement', point },
    { type: 'promote', point },
    ...portTradeOptions(state, point).map((pay) => /** @type {const} */ ({ type: 'port-trade', point, pay }))
  ];
  for (const action of actions) if (!checkAction(state, action)) choices.push({ kind: 'action', action });
  if (settlementDestinations(state, point).length) choices.push({ kind: 'move-settlement', point });
  const attacker = bestAttacker(state, point);
  if (attacker !== null) choices.push({ kind: 'attack-building', from: attacker, target: point });
  return choices;
}

/** Free intersections where the settlement at `from` can move now (along a road). */
export function settlementDestinations(/** @type {GameState} */ state, /** @type {number} */ from) {
  return pointNeighbors(from).filter((to) => !checkAction(state, { type: 'move-settlement', from, to }));
}

/** Intersections with something to do (drawn as circles on the board). */
export function activePoints(/** @type {GameState} */ state) {
  /** @type {number[]} */
  const out = [];
  for (let p = 0; p < POINT_COUNT; p++) if (pointChoices(state, p).length) out.push(p);
  return out;
}

/** Edges where the active player can build a road now (drawn as road slots). */
export function roadSlots(/** @type {GameState} */ state) {
  /** @type {number[]} */
  const out = [];
  if (state.phase !== 'actions') return out;
  for (let e = 0; e < EDGE_COUNT; e++) if (!checkAction(state, { type: 'build-road', edge: e })) out.push(e);
  return out;
}
