// Game state and read-only queries (pure, no DOM). The state is a plain JSON-friendly object.

import { GOLD, PLAYERS, RESOURCES, TROOPS } from '../config.js';
import { cellCorners, generateCells, isCell, pointCells } from './board.js';

/** @typedef {Record<string, number>} Purse  Resource cards by name (RESOURCES + GOLD). */

/**
 * @typedef {object} Player
 * @property {number} id Player index (also their color).
 * @property {Purse} resources
 * @property {boolean} eliminated
 */

/**
 * @typedef {object} Building
 * @property {'settlement' | 'castle' | 'port'} type
 * @property {number | null} owner Player index, or null for a grey building.
 */

/**
 * @typedef {object} GameState
 * @property {number} playerCount
 * @property {Player[]} players
 * @property {import('./board.js').Cell[]} cells
 * @property {Record<number, Building>} buildings By intersection id.
 * @property {number} current Index of the active player.
 * @property {'roll' | 'actions' | 'over'} phase
 * @property {number[] | null} dice Last accepted roll [a, b].
 * @property {number} turn Turn counter, starting at 1.
 * @property {number | null} winner
 */

/** @returns {Purse} */
export const emptyPurse = () => Object.fromEntries([...RESOURCES, GOLD].map((r) => [r, 0]));

/**
 * New game, before the first turn starts (call startTurn from turn.js next).
 * @param {{shuffle: <T>(list: readonly T[]) => T[]}} rng
 * @param {number} playerCount
 * @returns {GameState}
 */
export function createState(rng, playerCount) {
  if (!Number.isInteger(playerCount) || playerCount < PLAYERS.min || playerCount > PLAYERS.max) {
    throw new Error(`Player count must be ${PLAYERS.min}-${PLAYERS.max}, got ${playerCount}`);
  }
  const cells = generateCells(rng, playerCount);
  for (const cell of cells) if (cell.kind === 'tower' && cell.towerOwner !== null) cell.troops[cell.towerOwner] = TROOPS.start;
  return {
    playerCount,
    players: Array.from({ length: playerCount }, (_, id) => ({ id, resources: emptyPurse(), eliminated: false })),
    cells,
    buildings: {},
    current: 0,
    phase: 'roll',
    dice: null,
    turn: 1,
    winner: null
  };
}

/** @param {GameState} state @param {number} cell */
export function cellAt(state, cell) {
  if (!isCell(cell)) throw new Error(`Invalid cell: ${cell}`);
  return state.cells[cell];
}

/** Troops of one player in a cell. */
export const troopsOf = (/** @type {GameState} */ state, /** @type {number} */ cell, /** @type {number} */ player) =>
  cellAt(state, cell).troops[player] ?? 0;

/** All troops in a cell. */
export const totalTroops = (/** @type {GameState} */ state, /** @type {number} */ cell) =>
  cellAt(state, cell).troops.reduce((a, b) => a + b, 0);

export const freeSlots = (/** @type {GameState} */ state, /** @type {number} */ cell) => TROOPS.maxPerCell - totalTroops(state, cell);

/** Hold a cell: at least one of your troops and none of anybody else. */
export function holds(/** @type {GameState} */ state, /** @type {number} */ player, /** @type {number} */ cell) {
  const { troops } = cellAt(state, cell);
  return troops[player] > 0 && troops.every((n, p) => p === player || n === 0);
}

/** Players with troops in a cell. */
export const playersIn = (/** @type {GameState} */ state, /** @type {number} */ cell) =>
  cellAt(state, cell)
    .troops.map((n, p) => (n > 0 ? p : -1))
    .filter((p) => p >= 0);

/** Troops of a player on the whole board. */
export const troopsOnBoard = (/** @type {GameState} */ state, /** @type {number} */ player) =>
  state.cells.reduce((sum, cell) => sum + cell.troops[player], 0);

/**
 * Who collects from a cell and how much: majority troops minus all other troops (trial rule T3).
 * @returns {{player: number, amount: number} | null}
 */
export function majorityGain(/** @type {GameState} */ state, /** @type {number} */ cell) {
  const { troops } = cellAt(state, cell);
  const total = troops.reduce((a, b) => a + b, 0);
  let best = -1;
  troops.forEach((n, p) => {
    if (n > 0 && (best < 0 || n > troops[best])) best = p;
  });
  if (best < 0) return null;
  const amount = troops[best] - (total - troops[best]);
  return amount > 0 ? { player: best, amount } : null;
}

/** Building at an intersection, or undefined. */
export const buildingAt = (/** @type {GameState} */ state, /** @type {number} */ point) => state.buildings[point];

/** Buildings owned by a player, as [point, building] pairs. */
export function buildingsOf(/** @type {GameState} */ state, /** @type {number} */ player) {
  return Object.entries(state.buildings)
    .filter(([, b]) => b.owner === player)
    .map(([point, b]) => /** @type {[number, Building]} */ ([Number(point), b]));
}

/** Tower cells owned by a player. */
export const towersOf = (/** @type {GameState} */ state, /** @type {number} */ player) =>
  state.cells.filter((cell) => cell.kind === 'tower' && cell.towerOwner === player).map((cell) => cell.id);

/** True if one of the player's castles stands on a corner of the cell. */
export const touchesOwnCastle = (/** @type {GameState} */ state, /** @type {number} */ player, /** @type {number} */ cell) =>
  cellCorners(cell).some((p) => state.buildings[p]?.type === 'castle' && state.buildings[p].owner === player);

/** How many of the cells touching an intersection the player holds. */
export const heldCellsAround = (/** @type {GameState} */ state, /** @type {number} */ player, /** @type {number} */ point) =>
  pointCells(point).filter((cell) => holds(state, player, cell)).length;

/** Players still in the game. */
export const alivePlayers = (/** @type {GameState} */ state) => state.players.filter((p) => !p.eliminated).map((p) => p.id);

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
