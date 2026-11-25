// Turn flow (pure): start of turn (elimination, gold, spawn), dice roll with production, end of turn.
// Trial rules: "Turn", T3 and T9.

import { BOARD, COSTS, TROOPS } from '../config.js';
import { pointCells } from './board.js';
import { alivePlayers, buildingsOf, canPayWithGold, createState, emptyPurse, freeSlots, majorityGain, totalTroops, towersOf, troopsOnBoard } from './state.js';
import { collectTowerGold, releaseTowers, spawnTroops } from './towers.js';

/** @typedef {import('./state.js').GameState} GameState */
/** @typedef {{int: (min: number, max: number) => number, shuffle: <T>(list: readonly T[]) => T[]}} Rng */

/**
 * @typedef {object} TurnStart
 * @property {number} player Player whose turn starts (or the winner when the game is over).
 * @property {number[]} eliminated Players eliminated while looking for the next player.
 * @property {number} gold Gold collected from tower cells.
 * @property {number} spawned Free troops added.
 * @property {number | null} winner
 */

/**
 * Create a game and start the first turn.
 * @param {Rng} rng
 * @param {number} playerCount
 */
export function newGame(rng, playerCount) {
  const state = createState(rng, playerCount);
  const start = startTurn(state);
  return { state, start };
}

/** Next player still in the game after `from`. */
export function nextAlive(/** @type {GameState} */ state, /** @type {number} */ from) {
  for (let k = 1; k <= state.playerCount; k++) {
    const p = (from + k) % state.playerCount;
    if (!state.players[p].eliminated) return p;
  }
  throw new Error('No player left');
}

/** The player can recruit right now or after exchanging gold: a castle with a free cell around it, and the cost. */
export function canRecruitSomewhere(/** @type {GameState} */ state, /** @type {number} */ player) {
  if (!canPayWithGold(state.players[player].resources, COSTS.recruit)) return false;
  return buildingsOf(state, player).some(([point, b]) => b.type === 'castle' && pointCells(point).some((c) => freeSlots(state, c) > 0));
}

/** Elimination conditions (T9): no troops on the board, every owned tower full, and no way to recruit. */
export function shouldBeEliminated(/** @type {GameState} */ state, /** @type {number} */ player) {
  if (troopsOnBoard(state, player) > 0) return false;
  if (towersOf(state, player).some((cell) => totalTroops(state, cell) < TROOPS.maxPerCell)) return false;
  return !canRecruitSomewhere(state, player);
}

/** Remove a player: no cards, grey buildings, towers released. */
export function eliminate(/** @type {GameState} */ state, /** @type {number} */ player) {
  const p = state.players[player];
  p.eliminated = true;
  p.resources = emptyPurse();
  for (const [, b] of buildingsOf(state, player)) b.owner = null;
  return releaseTowers(state, player);
}

/**
 * Start the active player's turn: elimination check, tower gold, free spawn. Skips eliminated players.
 * @param {GameState} state
 * @returns {TurnStart}
 */
export function startTurn(state) {
  /** @type {number[]} */
  const eliminated = [];
  while (shouldBeEliminated(state, state.current)) {
    eliminated.push(state.current);
    eliminate(state, state.current);
    const alive = alivePlayers(state);
    if (alive.length <= 1) {
      state.phase = 'over';
      state.winner = alive[0] ?? null;
      state.dice = null;
      return { player: state.current, eliminated, gold: 0, spawned: 0, winner: state.winner };
    }
    state.current = nextAlive(state, state.current);
  }
  const gold = collectTowerGold(state);
  const spawned = spawnTroops(state);
  state.phase = 'roll';
  state.dice = null;
  return { player: state.current, eliminated, gold, spawned, winner: null };
}

/**
 * Every normal cell with this number produces for its majority player.
 * @param {GameState} state
 * @param {number} sum
 */
export function produce(state, sum) {
  /** @type {{cell: number, player: number, resource: string, amount: number}[]} */
  const gains = [];
  for (const cell of state.cells) {
    if (cell.kind !== 'normal' || cell.number !== sum || !cell.resource) continue;
    const gain = majorityGain(state, cell.id);
    if (!gain) continue;
    state.players[gain.player].resources[cell.resource] += gain.amount;
    gains.push({ cell: cell.id, player: gain.player, resource: cell.resource, amount: gain.amount });
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
 * End the active player's turn and start the next one.
 * @param {GameState} state
 */
export function endTurn(state) {
  if (state.phase !== 'actions') throw new Error(`Cannot end the turn in phase ${state.phase}`);
  state.current = nextAlive(state, state.current);
  state.turn += 1;
  return startTurn(state);
}
