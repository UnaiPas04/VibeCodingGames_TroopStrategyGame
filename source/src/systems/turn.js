// Turn flow (pure): setup (each player places a castle or port), dice roll with production, end of turn.
// Rules: docs/trial-rules.md.

import { BOARD, PRODUCTION } from '../config.js';
import { applyAction } from './actions.js';
import { cellCorners } from './board.js';
import { createState } from './state.js';

/** @typedef {import('./state.js').GameState} GameState */
/** @typedef {{int: (min: number, max: number) => number, shuffle: <T>(list: readonly T[]) => T[]}} Rng */

/**
 * Create a game in the setup phase: player 0 places their castle or port first.
 * @param {Rng} rng
 * @param {number} playerCount
 */
export function newGame(rng, playerCount) {
  return createState(rng, playerCount);
}

/**
 * Setup: the active player places their free start building (a port on the coast, a castle inside).
 * The next player places theirs; after the last one, turn 1 starts with player 0 (roll the dice next).
 * @param {GameState} state
 * @param {number} point
 * @returns {Record<string, any>} The action result, plus `setupDone`.
 */
export function placeStart(state, point) {
  const result = applyAction(state, { type: 'place-start', point });
  const setupDone = state.current === state.playerCount - 1;
  if (setupDone) {
    state.current = 0;
    state.turn = 1;
    state.phase = 'roll';
  } else {
    state.current += 1;
  }
  return { ...result, setupDone };
}

/**
 * Every cell with this number produces: each building on its corners gives its owner
 * PRODUCTION[type] cards of the cell's resource (gold on gold cells).
 * @param {GameState} state
 * @param {number} sum
 */
export function produce(state, sum) {
  /** @type {{cell: number, player: number, resource: string, amount: number}[]} */
  const gains = [];
  for (const cell of state.cells) {
    if (cell.number !== sum) continue;
    /** @type {Map<number, number>} */
    const byPlayer = new Map();
    for (const p of cellCorners(cell.id)) {
      const b = state.buildings[p];
      if (b) byPlayer.set(b.owner, (byPlayer.get(b.owner) ?? 0) + PRODUCTION[b.type]);
    }
    for (const [player, amount] of byPlayer) {
      state.players[player].resources[cell.resource] += amount;
      gains.push({ cell: cell.id, player, resource: cell.resource, amount });
    }
  }
  return gains;
}

/**
 * Roll two dice (rerolling the sums in BOARD.rerollSums) and resolve production.
 * @param {GameState} state
 * @param {Rng} rng
 */
export function rollDice(state, rng) {
  if (state.phase !== 'roll') throw new Error(`Cannot roll in phase ${state.phase}`);
  /** @type {number[]} */
  const rerolled = [];
  let dice;
  for (;;) {
    dice = [rng.int(1, 6), rng.int(1, 6)];
    const sum = dice[0] + dice[1];
    if (!BOARD.rerollSums.includes(sum)) break;
    rerolled.push(sum);
  }
  const sum = dice[0] + dice[1];
  state.dice = dice;
  state.phase = 'actions';
  return { dice, sum, rerolled, gains: produce(state, sum) };
}

/**
 * End the active player's turn: the next player's turn starts (roll the dice next).
 * @param {GameState} state
 */
export function endTurn(state) {
  if (state.phase !== 'actions') throw new Error(`Cannot end the turn in phase ${state.phase}`);
  state.current = (state.current + 1) % state.playerCount;
  state.turn += 1;
  state.phase = 'roll';
  state.dice = null;
  return { player: state.current };
}
