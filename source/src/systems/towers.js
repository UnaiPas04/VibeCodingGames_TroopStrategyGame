// Towers (pure): gold, free spawns and ownership. Trial rules T3 (tower cells) and T9.

import { GOLD, TROOPS } from '../config.js';
import { freeSlots, majorityGain, playersIn, towersOf } from './state.js';

/**
 * Give the active player the gold of every tower cell where they have the majority.
 * @param {import('./state.js').GameState} state
 * @returns {number} Gold collected.
 */
export function collectTowerGold(state) {
  const player = state.current;
  let gold = 0;
  for (const cell of state.cells) {
    if (cell.kind !== 'tower') continue;
    const gain = majorityGain(state, cell.id);
    if (gain && gain.player === player) gold += gain.amount;
  }
  state.players[player].resources[GOLD] += gold;
  return gold;
}

/**
 * Add free troops to every tower cell the active player owns, up to the cell limit.
 * @param {import('./state.js').GameState} state
 * @returns {number} Troops spawned.
 */
export function spawnTroops(state) {
  const player = state.current;
  let spawned = 0;
  for (const id of towersOf(state, player)) {
    const n = Math.max(0, Math.min(TROOPS.spawnPerTower, freeSlots(state, id)));
    state.cells[id].troops[player] += n;
    spawned += n;
  }
  return spawned;
}

/**
 * A grey tower goes to the only player with troops in its cell (any number).
 * @param {import('./state.js').GameState} state
 * @returns {{cell: number, player: number}[]} Towers claimed.
 */
export function claimGreyTowers(state) {
  /** @type {{cell: number, player: number}[]} */
  const claimed = [];
  for (const cell of state.cells) {
    if (cell.kind !== 'tower' || cell.towerOwner !== null) continue;
    const present = playersIn(state, cell.id);
    if (present.length === 1) {
      cell.towerOwner = present[0];
      claimed.push({ cell: cell.id, player: present[0] });
    }
  }
  return claimed;
}

/**
 * The player loses every tower: each turns grey, then goes to a single enemy present in it, if any.
 * @param {import('./state.js').GameState} state
 * @param {number} player
 */
export function releaseTowers(state, player) {
  for (const id of towersOf(state, player)) state.cells[id].towerOwner = null;
  return claimGreyTowers(state);
}
