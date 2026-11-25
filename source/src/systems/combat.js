// Combat math (pure): building bonus, fight result and win odds. Trial rule T6.

import { BUILDING_BONUS } from '../config.js';

const DIE_FACES = 6;

/**
 * Bonus a player gets from their own buildings on the given intersections. Grey buildings help nobody.
 * @param {Record<number, import('./state.js').Building>} buildings
 * @param {number} player
 * @param {number[]} points
 */
export function buildingBonus(buildings, player, points) {
  let bonus = 0;
  for (const p of points) {
    const b = buildings[p];
    if (b && b.owner === player) bonus += BUILDING_BONUS[b.type] ?? 0;
  }
  return bonus;
}

/**
 * Resolve one fight. The defender wins ties.
 * @param {{attackerTroops: number, attackerBonus: number, defenderTroops: number, defenderBonus: number, attackerDie: number, defenderDie: number}} f
 */
export function resolveFight(f) {
  const attackerTotal = f.attackerTroops + f.attackerBonus + f.attackerDie;
  const defenderTotal = f.defenderTroops + f.defenderBonus + f.defenderDie;
  return { attackerTotal, defenderTotal, attackerWins: attackerTotal > defenderTotal };
}

/**
 * Chance (0-1) that the attacker wins with this edge: (attacker troops + bonus) - (defender troops + bonus).
 * @param {number} edge
 */
export function winChance(edge) {
  let wins = 0;
  for (let a = 1; a <= DIE_FACES; a++) for (let d = 1; d <= DIE_FACES; d++) if (edge + a > d) wins++;
  return wins / (DIE_FACES * DIE_FACES);
}
