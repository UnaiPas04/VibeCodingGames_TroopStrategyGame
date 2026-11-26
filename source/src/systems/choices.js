// Click choices (pure): what the active player can do by clicking an intersection or a cell side.
// The board needs no tool buttons: click a road slot (middle of a cell side) to build a road, or an
// intersection circle to place your start building, build, promote, trade or move a settlement.

import { EDGE_COUNT, POINT_COUNT, pointNeighbors } from './board.js';
import { checkAction, portTradeOptions } from './actions.js';

/**
 * @typedef {{kind: 'action', action: import('./actions.js').Action}
 *   | {kind: 'move-settlement', point: number}} Choice
 */

/** @typedef {import('./state.js').GameState} GameState */

/**
 * What a click on an intersection can do: place the start building (setup), build, promote, trade,
 * or start moving a settlement.
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
