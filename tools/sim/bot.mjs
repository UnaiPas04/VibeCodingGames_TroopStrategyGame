// Heuristic bot for headless simulations (development tool, never shipped with the game).
// It plays with the same pure rules as the game (source/src/systems): each step it tries every valid
// action on a copy of the state, scores the result, and plays the best one while it improves the score.

import { PRODUCTION } from '../../source/src/config.js';
import { applyAction, checkAction } from '../../source/src/systems/actions.js';
import { EDGE_COUNT, POINT_COUNT, edgeEnds, pointCells } from '../../source/src/systems/board.js';
import { pointChoices, settlementDestinations } from '../../source/src/systems/choices.js';
import { buildingsOf, roadsOf } from '../../source/src/systems/state.js';

/** @typedef {import('../../source/src/systems/state.js').GameState} GameState */
/** @typedef {import('../../source/src/systems/actions.js').Action} Action */

/**
 * How a bot values things. Any field can be tuned.
 * @typedef {object} Style
 * @property {string} name
 * @property {number} production Expected cards per roll from buildings.
 * @property {number} card Each resource card in hand (makes spending a real cost).
 * @property {number} road Each road.
 * @property {number} site Share of the production of each free intersection next to an own road (a place for a settlement).
 * @property {Record<string, number>} building Value of each building type.
 * @property {number} minGain Smallest score gain worth an action.
 */

/** @type {Record<string, Style>} */
export const STYLES = {
  balanced: { name: 'balanced', production: 6, card: 0.35, road: 0.2, site: 0.4, building: { settlement: 1.5, castle: 3, port: 3 }, minGain: 0.05 },
  // Builds wide: many roads and settlements.
  expander: { name: 'expander', production: 5, card: 0.3, road: 0.4, site: 0.6, building: { settlement: 2.5, castle: 2, port: 2 }, minGain: 0.05 },
  // Builds tall: promotes to castles and ports, keeps cards.
  builder: { name: 'builder', production: 8, card: 0.4, road: 0.1, site: 0.2, building: { settlement: 1, castle: 5, port: 5 }, minGain: 0.05 }
};

/** Ways to roll each sum with two dice, ignoring the rerolled sums (2, 7, 12): 28 in total. */
const WAYS = (/** @type {number} */ n) => 6 - Math.abs(7 - n);
const USEFUL_WAYS = 28;

/** Fast copy of a game state (plain data). @param {GameState} s @returns {GameState} */
export function cloneState(s) {
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, resources: { ...p.resources } })),
    buildings: Object.fromEntries(Object.entries(s.buildings).map(([k, b]) => [k, { ...b }])),
    roads: { ...s.roads },
    dice: s.dice ? [...s.dice] : null
  };
}

/** Expected cards per roll that a building of `type` at `point` collects. */
function pointYield(/** @type {GameState} */ s, /** @type {number} */ point, /** @type {string} */ type) {
  return pointCells(point).reduce((sum, c) => sum + (PRODUCTION[/** @type {keyof typeof PRODUCTION} */ (type)] * WAYS(s.cells[c].number)) / USEFUL_WAYS, 0);
}

/**
 * Value of the position for one player.
 * @param {GameState} s
 * @param {number} p
 * @param {Style} st
 */
function value(s, p, st) {
  let v = 0;
  for (const [point, b] of buildingsOf(s, p)) v += st.production * pointYield(s, point, b.type) + (st.building[b.type] ?? 0);
  for (const n of Object.values(s.players[p].resources)) v += st.card * n;
  const roads = roadsOf(s, p);
  v += st.road * roads.length;
  const sites = new Set(roads.flatMap((e) => edgeEnds(e)).filter((pt) => !s.buildings[pt]));
  // A place for a settlement is worth part of what a settlement there would collect.
  for (const pt of sites) v += st.site * st.production * pointYield(s, pt, 'settlement');
  return v;
}

/** Score of the position for the active player: their value minus the best rival's. */
export function score(/** @type {GameState} */ s, /** @type {Style} */ st) {
  const me = s.current;
  let rival = 0;
  for (const p of s.players) if (p.id !== me) rival = Math.max(rival, value(s, p.id, st));
  return value(s, me, st) - rival;
}

/** Best start intersection for the active player: the most expected cards (setup phase). */
export function bestStart(/** @type {GameState} */ s) {
  let best = -1;
  let bestYield = -1;
  for (let p = 0; p < POINT_COUNT; p++) {
    if (checkAction(s, { type: 'place-start', point: p })) continue;
    const y = pointYield(s, p, 'castle');
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
  for (let e = 0; e < EDGE_COUNT; e++) {
    const a = /** @type {const} */ ({ type: 'build-road', edge: e });
    if (!checkAction(s, a)) out.push(a);
  }
  for (let p = 0; p < POINT_COUNT; p++) {
    for (const c of pointChoices(s, p)) {
      if (c.kind === 'action') out.push(c.action);
      else for (const to of settlementDestinations(s, p)) out.push({ type: 'move-settlement', from: p, to });
    }
  }
  return out;
}

/**
 * Play the active player's actions for this turn (the dice must already be rolled).
 * @param {GameState} s
 * @param {Style} st
 * @param {number} [maxActions]
 * @param {(type: string, purseChange: Record<string, number>) => void} [onAction] Called after each action.
 */
export function playTurn(s, st, maxActions = 25, onAction = () => {}) {
  for (let i = 0; i < maxActions; i++) {
    let best = null;
    let bestScore = score(s, st) + st.minGain;
    for (const action of candidates(s)) {
      const next = cloneState(s);
      applyAction(next, action);
      const v = score(next, st);
      if (v > bestScore) {
        bestScore = v;
        best = action;
      }
    }
    if (!best) break;
    const purse = s.players[s.current].resources;
    const before = { ...purse };
    applyAction(s, best);
    onAction(best.type, Object.fromEntries(Object.keys(purse).map((r) => [r, purse[r] - before[r]])));
  }
}
