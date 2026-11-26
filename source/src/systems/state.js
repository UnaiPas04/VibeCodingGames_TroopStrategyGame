// Game state and read-only queries (pure, no DOM). The state is a plain JSON-friendly object.

import { GOLD, PLAYERS, RESOURCES } from '../config.js';
import { generateCells, isCell, pointEdges } from './board.js';

/** @typedef {Record<string, number>} Purse  Resource cards by name (RESOURCES + GOLD). */

/**
 * @typedef {object} Player
 * @property {number} id Player index (also their color).
 * @property {Purse} resources
 */

/**
 * @typedef {object} Building
 * @property {'settlement' | 'castle' | 'port'} type
 * @property {number} owner Player index.
 */

/**
 * @typedef {object} GameState
 * @property {number} playerCount
 * @property {Player[]} players
 * @property {import('./board.js').Cell[]} cells
 * @property {Record<number, Building>} buildings By intersection id.
 * @property {Record<number, number>} roads Owner by edge id.
 * @property {number} current Index of the active player.
 * @property {'setup' | 'roll' | 'actions' | 'over'} phase setup: each player places a castle or port.
 * @property {number[] | null} dice Last accepted roll [a, b].
 * @property {number} turn Turn counter, starting at 1 after the setup.
 * @property {number | null} winner
 */

/** @returns {Purse} */
export const emptyPurse = () => Object.fromEntries([...RESOURCES, GOLD].map((r) => [r, 0]));

/**
 * New game, in the setup phase: player 0 places their first building.
 * @param {{shuffle: <T>(list: readonly T[]) => T[]}} rng
 * @param {number} playerCount
 * @returns {GameState}
 */
export function createState(rng, playerCount) {
  if (!Number.isInteger(playerCount) || playerCount < PLAYERS.min || playerCount > PLAYERS.max) {
    throw new Error(`Player count must be ${PLAYERS.min}-${PLAYERS.max}, got ${playerCount}`);
  }
  return {
    playerCount,
    players: Array.from({ length: playerCount }, (_, id) => ({ id, resources: emptyPurse() })),
    cells: generateCells(rng),
    buildings: {},
    roads: {},
    current: 0,
    phase: 'setup',
    dice: null,
    turn: 0,
    winner: null
  };
}

/** @param {GameState} state @param {number} cell */
export function cellAt(state, cell) {
  if (!isCell(cell)) throw new Error(`Invalid cell: ${cell}`);
  return state.cells[cell];
}

/** Building at an intersection, or undefined. */
export const buildingAt = (/** @type {GameState} */ state, /** @type {number} */ point) => state.buildings[point];

/** Owner of the road on an edge, or undefined. */
export const roadAt = (/** @type {GameState} */ state, /** @type {number} */ edge) => state.roads[edge];

/** Buildings owned by a player, as [point, building] pairs. */
export function buildingsOf(/** @type {GameState} */ state, /** @type {number} */ player) {
  return Object.entries(state.buildings)
    .filter(([, b]) => b.owner === player)
    .map(([point, b]) => /** @type {[number, Building]} */ ([Number(point), b]));
}

/** Edges with a road of the player. */
export const roadsOf = (/** @type {GameState} */ state, /** @type {number} */ player) =>
  Object.entries(state.roads)
    .filter(([, owner]) => owner === player)
    .map(([edge]) => Number(edge));

/** True if one of the player's roads starts at the intersection. */
export const touchesOwnRoad = (/** @type {GameState} */ state, /** @type {number} */ player, /** @type {number} */ point) =>
  pointEdges(point).some((e) => state.roads[e] === player);

// ---- Resources ----

/** @param {Purse} purse @param {Partial<Purse>} cost */
export const canPay = (purse, cost) => Object.entries(cost).every(([r, n]) => (purse[r] ?? 0) >= (n ?? 0));

/** Can pay the cost if gold is exchanged 1:1 for the missing resources. */
export function canPayWithGold(/** @type {Purse} */ purse, /** @type {Partial<Purse>} */ cost) {
  let missing = 0;
  for (const [r, n] of Object.entries(cost)) missing += Math.max(0, (n ?? 0) - (purse[r] ?? 0));
  return missing <= purse[GOLD];
}

/**
 * Pay a cost, exchanging gold 1:1 for whatever is missing.
 * @param {Purse} purse
 * @param {Partial<Purse>} cost
 * @returns {number} Gold exchanged.
 */
export function payWithGold(purse, cost) {
  if (!canPayWithGold(purse, cost)) throw new Error(`Cannot pay ${JSON.stringify(cost)}, even with gold`);
  let gold = 0;
  for (const [r, n] of Object.entries(cost)) {
    const missing = Math.max(0, (n ?? 0) - (purse[r] ?? 0));
    purse[r] += missing;
    gold += missing;
  }
  purse[GOLD] -= gold;
  pay(purse, cost);
  return gold;
}

/** @param {Purse} purse @param {Partial<Purse>} cost */
export function pay(purse, cost) {
  if (!canPay(purse, cost)) throw new Error(`Cannot pay ${JSON.stringify(cost)}`);
  for (const [r, n] of Object.entries(cost)) purse[r] -= n ?? 0;
}
