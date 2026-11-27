// Heuristic bot for headless simulations (development tool, never shipped with the game).
// It plays with the same pure rules as the game (source/src/systems): each step it tries every valid
// action on a copy of the state, scores the result (fights: both outcomes weighted by their odds), and
// plays the best one while it improves the score.

import { PRODUCTION, TROOPS } from '../../source/src/config.js';
import { applyAction, attackBonuses, buildingFight, checkAction } from '../../source/src/systems/actions.js';
import { CELL_COUNT, EDGE_COUNT, POINT_COUNT, edgeEnds, pointCells } from '../../source/src/systems/board.js';
import { winChance } from '../../source/src/systems/combat.js';
import { cellChoices, moveTo, pointChoices, settlementDestinations } from '../../source/src/systems/choices.js';
import { blockerOf, buildingsOf, roadsOf, troopsOf, troopsOnBoard } from '../../source/src/systems/state.js';

/** @typedef {import('../../source/src/systems/state.js').GameState} GameState */
/** @typedef {import('../../source/src/systems/actions.js').Action} Action */

/**
 * How a bot values things. Any field can be tuned.
 * @typedef {object} Style
 * @property {string} name
 * @property {number} production Expected cards per roll from buildings (blocked cells pay nothing).
 * @property {number} card Each resource card in hand (makes spending a real cost).
 * @property {number} road Each road.
 * @property {number} site Share of the production of each free intersection next to an own road (a place for a settlement).
 * @property {Record<string, number>} building Value of each building type.
 * @property {number} troop Each troop on the board.
 * @property {number} support Each cell next to a building (own or rival) where the player leads in troops.
 * @property {number} minGain Smallest score gain worth an action.
 */

/** @type {Record<string, Style>} */
export const STYLES = {
  balanced: { name: 'balanced', production: 6, card: 0.35, road: 0.2, site: 0.4, building: { settlement: 2, castle: 4, port: 4 }, troop: 0.15, support: 0.6, minGain: 0.05 },
  // Builds wide and keeps few troops.
  expander: { name: 'expander', production: 6, card: 0.3, road: 0.4, site: 0.6, building: { settlement: 2.5, castle: 3, port: 3 }, troop: 0.1, support: 0.3, minGain: 0.05 },
  // Many troops: blocks cells and attacks buildings.
  warlord: { name: 'warlord', production: 5, card: 0.25, road: 0.2, site: 0.3, building: { settlement: 2, castle: 4, port: 4 }, troop: 0.25, support: 1.2, minGain: 0.05 }
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
    roads: { ...s.roads },
    dice: s.dice ? [...s.dice] : null
  };
}

/** Expected cards per roll that a building of `type` at `point` of `player` collects (blocked cells pay nothing). */
function pointYield(/** @type {GameState} */ s, /** @type {number} */ point, /** @type {string} */ type, /** @type {number} */ player) {
  let y = 0;
  for (const c of pointCells(point)) {
    const blocker = blockerOf(s, c);
    if (blocker !== null && blocker !== player) continue;
    y += (PRODUCTION[/** @type {keyof typeof PRODUCTION} */ (type)] * WAYS(s.cells[c].number)) / USEFUL_WAYS;
  }
  return y;
}

/**
 * Value of the position for one player.
 * @param {GameState} s
 * @param {number} p
 * @param {Style} st
 */
function value(s, p, st) {
  if (s.players[p].eliminated) return -1000;
  let v = 0;
  const own = buildingsOf(s, p);
  if (own.length === 0) return -1000;
  for (const [point, b] of own) v += st.production * pointYield(s, point, b.type, p) + (st.building[b.type] ?? 0);
  for (const n of Object.values(s.players[p].resources)) v += st.card * n;
  const roads = roadsOf(s, p);
  v += st.road * roads.length;
  const sites = new Set(roads.flatMap((e) => edgeEnds(e)).filter((pt) => !s.buildings[pt]));
  for (const pt of sites) v += st.site * st.production * pointYield(s, pt, 'settlement', p);
  v += st.troop * troopsOnBoard(s, p);
  // Troops around buildings: they defend yours and help to attack the rivals'.
  for (const [point, b] of Object.entries(s.buildings)) {
    for (const c of pointCells(Number(point))) {
      const mine = troopsOf(s, c, p);
      const other = b.owner === p ? Math.max(...s.cells[c].troops.filter((_, q) => q !== p)) : troopsOf(s, c, b.owner);
      if (mine > other) v += st.support;
    }
  }
  return v;
}

/** Score of the position for the active player: their value minus the best rival's. */
export function score(/** @type {GameState} */ s, /** @type {Style} */ st) {
  if (s.phase === 'over') return s.winner === s.current ? 1e6 : -1e6;
  const me = s.current;
  let rival = -Infinity;
  for (const p of s.players) if (p.id !== me && !p.eliminated) rival = Math.max(rival, value(s, p.id, st));
  return value(s, me, st) - (rival === -Infinity ? 0 : rival);
}

/** How much a start building wants each resource: wood and stone build the first roads and settlements. */
const START_WEIGHT = { wood: 2, stone: 1.5, grain: 1, iron: 0.8, gold: 1.2 };

/** Best start intersection for the active player: the most expected cards, weighted by START_WEIGHT (setup phase). */
export function bestStart(/** @type {GameState} */ s) {
  let best = -1;
  let bestYield = -1;
  for (let p = 0; p < POINT_COUNT; p++) {
    if (checkAction(s, { type: 'place-start', point: p })) continue;
    const y = pointCells(p).reduce((sum, c) => sum + WAYS(s.cells[c].number) * START_WEIGHT[/** @type {keyof typeof START_WEIGHT} */ (s.cells[c].resource)], 0);
    if (y > bestYield) {
      bestYield = y;
      best = p;
    }
  }
  return best;
}

/** Every action worth trying now for the active player. @param {GameState} s @returns {Action[]} */
function candidates(s) {
  /** @type {Action[]} */
  const out = [];
  const me = s.current;
  for (let e = 0; e < EDGE_COUNT; e++) {
    const a = /** @type {const} */ ({ type: 'build-road', edge: e });
    if (!checkAction(s, a)) out.push(a);
  }
  for (let p = 0; p < POINT_COUNT; p++) {
    for (const c of pointChoices(s, p)) {
      if (c.kind === 'action') out.push(c.action);
      else if (c.kind === 'move-settlement') for (const to of settlementDestinations(s, p)) out.push({ type: 'move-settlement', from: p, to });
      else if (c.kind === 'attack-building') out.push({ type: 'attack-building', from: c.from, target: c.target });
    }
  }
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    for (const c of cellChoices(s, null, cell)) if (c.kind === 'action') out.push(c.action);
    const mine = troopsOf(s, cell, me);
    if (mine === 0) continue;
    for (let to = 0; to < CELL_COUNT; to++) {
      for (const c of cellChoices(s, cell, to, mine)) {
        if (c.kind === 'attack') for (const defender of c.enemies) out.push({ type: 'attack', from: cell, target: to, defender, count: mine });
      }
      if (to === cell) continue;
      const fill = TROOPS.maxPerCell - troopsOf(s, to, me);
      for (const n of new Set([mine, Math.ceil(mine / 2), 1, fill].filter((k) => k >= 1 && k <= mine))) {
        const a = moveTo(s, cell, to, n);
        if (a) out.push(a);
      }
    }
  }
  return out;
}

/** Dice that force a fight's result: [attacker die, defender die]. */
const forced = (/** @type {number[]} */ dice) => ({ int: () => /** @type {number} */ (dice.shift()) });

/** Chance that a fight action is won, before rolling. @param {GameState} s @param {Action} a */
function fightChance(s, a) {
  if (a.type === 'attack') {
    const b = attackBonuses(s, a.target, a.defender);
    const helpers = a.from === a.target ? 0 : troopsOf(s, a.target, s.current);
    return winChance(a.count + helpers + b.attackerBonus - (troopsOf(s, a.target, a.defender) + b.defenderBonus));
  }
  if (a.type === 'attack-building') {
    const f = buildingFight(s, a.from, a.target);
    return winChance(f.attackerBonus + f.attackerSupport - (f.defenderBonus + f.defenderSupport));
  }
  return 1;
}

/** Expected score after an action (fights average their two outcomes). @param {GameState} s @param {Action} action @param {Style} st */
function expectedScore(s, action, st) {
  if (action.type !== 'attack' && action.type !== 'attack-building') {
    const next = cloneState(s);
    applyAction(next, action);
    return score(next, st);
  }
  const p = fightChance(s, action);
  const win = cloneState(s);
  applyAction(win, action, forced([6, 1]));
  const lose = cloneState(s);
  applyAction(lose, action, forced([1, 6]));
  return p * score(win, st) + (1 - p) * score(lose, st);
}

/**
 * Play the active player's actions for this turn (the dice must already be rolled).
 * @param {GameState} s
 * @param {{int: (min: number, max: number) => number}} rng Real dice for the fights.
 * @param {Style} st
 * @param {number} [maxActions]
 * @param {(type: string, purseChange: Record<string, number>, result: Record<string, any>) => void} [onAction] Called after each action.
 */
export function playTurn(s, rng, st, maxActions = 25, onAction = () => {}) {
  for (let i = 0; i < maxActions && s.phase === 'actions'; i++) {
    let best = null;
    let bestScore = score(s, st) + st.minGain;
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
  }
}

