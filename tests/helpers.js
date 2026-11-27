// Shared helpers for the rule tests.
// Board layout (6 x 6): cell id = row * 6 + col; intersection id = row * 7 + col.

import { createRng } from '../source/src/core/rng.js';
import { edgeBetween } from '../source/src/systems/board.js';
import { createState } from '../source/src/systems/state.js';

/** Inner intersection (3,3): touches cells 14, 15, 20, 21; neighbors 17 (up), 25 (right), 31 (down), 23 (left). */
export const P = 24;

/** Fake rng with fixed dice values. @param {number[]} dice */
export const fixedDice = (dice) => ({ int: () => /** @type {number} */ (dice.shift()), shuffle: (/** @type {any[]} */ l) => [...l] });

/** The edge (road place) between two neighboring intersections. */
export const road = (/** @type {number} */ a, /** @type {number} */ b) => /** @type {number} */ (edgeBetween(a, b));

/**
 * A state in the actions phase with the given resources for every player, and a settlement for each
 * player far away (bottom-right corner: 48, 47, ...), so nobody is out of the game.
 * @param {number} [playerCount]
 * @param {Record<string, number>} [resources]
 */
export function setup(playerCount = 2, resources = {}) {
  const state = createState(createRng(1), playerCount);
  for (const p of state.players) Object.assign(p.resources, resources);
  for (const p of state.players) state.buildings[48 - p.id] = { type: 'settlement', owner: p.id };
  state.phase = 'actions';
  state.turn = 1;
  return state;
}
