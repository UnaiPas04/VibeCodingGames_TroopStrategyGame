// Heuristic bot for headless simulations (development tool, never shipped with the game).
// It plays with the same pure rules as the game (source/src/systems): each step it tries every valid
// action on a copy of the state, scores the result, and plays the best one while it improves the score.

import { MOVE, TROOPS } from '../../source/src/config.js';
import { applyAction, checkAction } from '../../source/src/systems/actions.js';
import { CELL_COUNT, POINT_COUNT, cellDistance } from '../../source/src/systems/board.js';
import { cellChoices, moveTo, pointChoices } from '../../source/src/systems/choices.js';
import { winChance } from '../../source/src/systems/combat.js';
import { buildingsOf, majorityGain, towersOf, troopsOf, troopsOnBoard } from '../../source/src/systems/state.js';

/** @typedef {import('../../source/src/systems/state.js').GameState} GameState */
/** @typedef {import('../../source/src/systems/actions.js').Action} Action */

/**
 * How a bot values things. Two styles are predefined; any field can be tuned.
 * @typedef {object} Style
 * @property {string} name
 * @property {number} production Expected cards per roll from cell majorities.
 * @property {number} gold Gold per turn from tower cells.
 * @property {number} troop Each troop on the board.
 * @property {number} card Each resource card in hand (makes spending a real cost).
 * @property {number} siege Each own troop in an enemy tower cell.
 * @property {number} tower Each tower owned.
 * @property {Record<string, number>} building Value of each building type.
 * @property {number} minGain Smallest score gain worth an action.
 */

/** @type {Record<string, Style>} */
export const STYLES = {
  balanced: {
    name: 'balanced',
    production: 6,
    gold: 1,
    troop: 1,
    card: 0.35,
    siege: 1.5,
    tower: 8,
    building: { settlement: 1.5, castle: 4, port: 2 },
    minGain: 0.05
  },
  aggressive: {
    name: 'aggressive',
    production: 4,
    gold: 0.8,
    troop: 1.2,
    card: 0.25,
    siege: 3,
    tower: 12,
    building: { settlement: 1, castle: 3, port: 1 },
    minGain: 0.05
  },
  economic: {
    name: 'economic',
    production: 9,
    gold: 1.2,
    troop: 0.8,
    card: 0.4,
    siege: 0.8,
    tower: 8,
    building: { settlement: 2, castle: 5, port: 3 },
    minGain: 0.05
  }
};

/** Ways to roll each sum with two dice, ignoring the rerolled sums (2, 7, 12): 28 in total. */
const WAYS = (/** @type {number} */ n) => 6 - Math.abs(7 - n);
const USEFUL_WAYS = 28;

/** Fast copy of a game state (plain data). @param {GameState} s @returns {GameState} */
export function cloneState(s) {
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, resources: { ...p.resources } })),
    cells: s.cells.map((c) => ({ ...c, troops: [...c.troops] })),
    buildings: Object.fromEntries(Object.entries(s.buildings).map(([k, b]) => [k, { ...b }])),
    dice: s.dice ? [...s.dice] : null
  };
}

/**
 * Value of the position for one player, in "troop" units.
 * @param {GameState} s
 * @param {number} p
 * @param {Style} st
 */
function value(s, p, st) {
  let v = 0;
  for (const cell of s.cells) {
    if (cell.kind === 'tower' && cell.towerOwner === p) {
      // Own towers are refilled before paying, so leaving them costs no gold: only enemies there do.
      const enemies = cell.troops.reduce((sum, n, q) => sum + (q === p ? 0 : n), 0);
      v += st.gold * Math.max(0, TROOPS.maxPerTower - 2 * enemies);
      continue;
    }
    const gain = majorityGain(s, cell.id);
    if (!gain || gain.player !== p) continue;
    if (cell.kind === 'normal' && cell.number !== null) v += (st.production * gain.amount * WAYS(cell.number)) / USEFUL_WAYS;
    if (cell.kind === 'tower') v += st.gold * gain.amount;
  }
  v += st.troop * troopsOnBoard(s, p);
  for (const n of Object.values(s.players[p].resources)) v += st.card * n;
  for (const [, b] of buildingsOf(s, p)) v += st.building[b.type] ?? 0;
  v += st.tower * towersOf(s, p).length;
  for (const cell of s.cells) {
    if (cell.kind !== 'tower' || cell.towerOwner === p) continue;
    v += st.siege * cell.troops[p];
    if (cell.towerOwner !== null && cell.troops[p] === TROOPS.maxPerTower) v += st.tower; // tower full: owner besieged
  }
  return v;
}

/** Score of the position for the active player: their value minus the best rival's. */
export function score(/** @type {GameState} */ s, /** @type {Style} */ st) {
  const me = s.current;
  let rival = 0;
  for (const p of s.players) if (p.id !== me && !p.eliminated) rival = Math.max(rival, value(s, p.id, st));
  return value(s, me, st) - rival;
}

/** Dice that force an attack's result, to score both outcomes. */
const forced = (/** @type {number[]} */ dice) => ({ int: () => /** @type {number} */ (dice.shift()) });

/**
 * Every action worth trying now for the active player.
 * @param {GameState} s
 * @returns {Action[]}
 */
function candidates(s) {
  /** @type {Action[]} */
  const out = [];
  const me = s.current;
  for (let from = 0; from < CELL_COUNT; from++) {
    const mine = troopsOf(s, from, me);
    if (mine === 0) continue;
    const counts = [...new Set([mine, mine - 1, Math.ceil(mine / 2), 1].filter((n) => n >= 1))];
    for (let to = 0; to < CELL_COUNT; to++) {
      if (to === from || cellDistance(from, to) > MOVE.maxCells) continue;
      for (const n of counts) {
        const a = moveTo(s, from, to, n);
        if (a) out.push(a);
      }
    }
    for (let target = 0; target < CELL_COUNT; target++) {
      for (const c of cellChoices(s, from, target, mine)) {
        if (c.kind !== 'attack') continue;
        for (const defender of c.enemies) out.push({ type: 'attack', from, target, defender, count: mine });
      }
    }
  }
  for (let cell = 0; cell < CELL_COUNT; cell++) for (const c of cellChoices(s, null, cell)) if (c.kind === 'action') out.push(c.action);
  for (let p = 0; p < POINT_COUNT; p++) {
    for (const c of pointChoices(s, p)) {
      if (c.kind === 'action') out.push(c.action);
      else if (c.kind === 'move-settlement') for (let to = 0; to < POINT_COUNT; to++) if (!checkAction(s, { type: 'move-settlement', from: p, to })) out.push({ type: 'move-settlement', from: p, to });
    }
  }
  return out;
}

/**
 * Expected score after an action (attacks average their two outcomes).
 * @param {GameState} s
 * @param {Action} action
 * @param {Style} st
 */
function expectedScore(s, action, st) {
  if (action.type !== 'attack') {
    const next = cloneState(s);
    applyAction(next, action, forced([]));
    return score(next, st);
  }
  const me = s.current;
  const defenderTroops = troopsOf(s, action.target, action.defender);
  // Bonuses are the same for both outcomes: read them from a forced win.
  const win = cloneState(s);
  const r = applyAction(win, action, forced([6, 1]));
  const edge = action.count + r.attackerBonus - (defenderTroops + r.defenderBonus);
  const p = winChance(edge);
  if (!r.attackerWins) return score(win, st); // cannot win even with the best dice
  const lose = cloneState(s);
  const rl = applyAction(lose, action, forced([1, 6]));
  if (rl.attackerWins) return score(lose, st); // cannot lose
  void me;
  return p * score(win, st) + (1 - p) * score(lose, st);
}

/**
 * Play the active player's actions for this turn (the dice must already be rolled).
 * @param {GameState} s
 * @param {{int: (min: number, max: number) => number}} rng Real dice for the attacks.
 * @param {Style} st
 * @param {number} [maxActions]
 * @param {(type: string, purseChange: Record<string, number>, result: Record<string, any>) => void} [onAction] Called after each action.
 * @returns {Record<string, number>} Actions played, by type.
 */
export function playTurn(s, rng, st, maxActions = 25, onAction = () => {}) {
  /** @type {Record<string, number>} */
  const played = {};
  for (let i = 0; i < maxActions; i++) {
    const base = score(s, st);
    let best = null;
    let bestScore = base + st.minGain;
    for (const action of candidates(s)) {
      const v = expectedScore(s, action, st);
      if (v > bestScore) {
        bestScore = v;
        best = action;
      }
    }
    if (!best) break;
    const purse = s.players[s.current].resources;
    const before = { ...purse };
    const result = applyAction(s, best, rng);
    onAction(best.type, Object.fromEntries(Object.keys(purse).map((r) => [r, purse[r] - before[r]])), result);
    played[best.type] = (played[best.type] ?? 0) + 1;
  }
  return played;
}
