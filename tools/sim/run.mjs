// Headless simulation: bots play many games with the real rules and print statistics
// (results and game length; economy: income, spending and leftover cards; what they built; troops:
// how much of the map they fill and how many cells they block; fights).
// Usage: npm run simulate -- [games] [styleA] [styleB] [maxTurns]
//   e.g. npm run simulate -- 20 expander warlord 150
// Styles: see STYLES in tools/sim/bot.mjs. Two players; seats alternate so both styles start first.

import { GOLD, RESOURCES, TROOPS } from '../../source/src/config.js';
import { createRng } from '../../source/src/core/rng.js';
import { CELL_COUNT } from '../../source/src/systems/board.js';
import { blockerOf, buildingsOf, roadsOf, troopsOnBoard } from '../../source/src/systems/state.js';
import { endTurn, newGame, placeStart, rollDice } from '../../source/src/systems/turn.js';
import { STYLES, bestStart, playTurn } from './bot.mjs';

const CARDS = [...RESOURCES, GOLD];
const SAMPLE_TURNS = [10, 25, 50, 100, 150];

/** Statistics of one style over all its games. */
export function emptyStats() {
  return {
    games: 0,
    wins: 0,
    /** @type {Record<string, number>} cards received, by resource (dice and ports) */ income: Object.fromEntries(CARDS.map((r) => [r, 0])),
    /** @type {Record<string, Record<string, number>>} cards spent, by action then resource */ spent: {},
    /** @type {Record<string, number>} actions played, by type */ actions: {},
    /** @type {Record<string, number>} fights won, by action type */ won: {},
    /** @type {Record<string, number>} cards left at the end */ leftover: Object.fromEntries(CARDS.map((r) => [r, 0])),
    /** @type {Record<number, Record<string, number>>} sums over games at sample turns */ at: {},
    /** @type {Record<number, number>} games that reached each sample turn */ reachedAt: {}
  };
}

/** Map-wide sums over games at sample turns: % of troop slots filled, blocked cells. @type {Record<number, {fill: number, blocked: number, games: number}>} */
const board = {};

/**
 * Play one game between two styles and add what happened to `stats` (one entry per seat's style).
 * @param {number} seed
 * @param {import('./bot.mjs').Style[]} styles Style of each seat.
 * @param {ReturnType<typeof emptyStats>[]} stats Stats object of each seat.
 * @param {number} maxTurns
 */
export function playGame(seed, styles, stats, maxTurns) {
  const rng = createRng(seed);
  const state = newGame(rng, styles.length);
  for (const st of stats) st.games++;
  while (state.phase === 'setup') placeStart(state, bestStart(state));
  let turns = 0;
  while (state.phase !== 'over' && turns < maxTurns) {
    const me = state.current;
    const my = stats[me];
    const roll = rollDice(state, rng);
    for (const g of roll.gains) stats[g.player].income[g.resource] += g.amount;
    playTurn(state, rng, styles[me], 25, (type, change, result) => {
      my.actions[type] = (my.actions[type] ?? 0) + 1;
      if ((type === 'attack' && result.attackerWins) || (type === 'attack-building' && result.toppled)) my.won[type] = (my.won[type] ?? 0) + 1;
      my.spent[type] ??= {};
      for (const [r, n] of Object.entries(change)) {
        if (n < 0) my.spent[type][r] = (my.spent[type][r] ?? 0) - n;
        else if (n > 0) my.income[r] += n; // gold from trades
      }
    });
    if (/** @type {string} */ (state.phase) === 'over') break; // the game can end during a turn
    endTurn(state);
    turns++;
    if (SAMPLE_TURNS.includes(turns)) {
      state.players.forEach((p) => {
        const built = buildingsOf(state, p.id);
        const a = (stats[p.id].at[turns] ??= { cards: 0, grain: 0, troops: 0, settlements: 0, big: 0, roads: 0 });
        a.cards += CARDS.reduce((s, r) => s + p.resources[r], 0);
        a.grain += p.resources.grain;
        a.troops += troopsOnBoard(state, p.id);
        a.settlements += built.filter(([, b]) => b.type === 'settlement').length;
        a.big += built.filter(([, b]) => b.type !== 'settlement').length;
        a.roads += roadsOf(state, p.id).length;
        stats[p.id].reachedAt[turns] = (stats[p.id].reachedAt[turns] ?? 0) + 1;
      });
      const all = state.cells.reduce((s, c) => s + c.troops.reduce((x, y) => x + y, 0), 0);
      const b = (board[turns] ??= { fill: 0, blocked: 0, games: 0 });
      b.fill += all / (CELL_COUNT * TROOPS.maxPerCell);
      b.blocked += state.cells.filter((c) => blockerOf(state, c.id) !== null).length;
      b.games++;
    }
  }
  state.players.forEach((p) => {
    for (const r of CARDS) stats[p.id].leftover[r] += p.resources[r];
  });
  if (state.winner !== null) stats[state.winner].wins++;
  return { turns, winner: state.winner };
}

/** Per-game average of a record of numbers. @param {Record<string, number>} rec @param {number} games */
const perGame = (rec, games) => Object.fromEntries(Object.entries(rec).map(([k, n]) => [k, +(n / games).toFixed(1)]));

/** @param {ReturnType<typeof emptyStats>} s @param {string} label */
function report(s, label) {
  const g = s.games;
  /** @type {Record<string, number>} */
  const spentTotal = Object.fromEntries(CARDS.map((r) => [r, 0]));
  for (const byRes of Object.values(s.spent)) for (const [r, n] of Object.entries(byRes)) spentTotal[r] += n;
  const pct = (/** @type {string} */ type) => (s.actions[type] ? `${Math.round(((s.won[type] ?? 0) / s.actions[type]) * 100)}%` : '-');
  console.log(`\n== ${label}: ${s.wins}/${g} wins ==`);
  console.log('Income per game (cards):', perGame(s.income, g));
  console.log('Spent per game (cards):  ', perGame(spentTotal, g));
  console.log('Left at the end (cards): ', perGame(s.leftover, g));
  console.log('Actions per game:', perGame(s.actions, g), `· troop attacks won ${pct('attack')}, building attacks won ${pct('attack-building')}`);
  console.log('At turn (cards in hand, grain in hand, troops, settlements, castles+ports, roads):');
  for (const t of SAMPLE_TURNS) {
    const n = s.reachedAt[t];
    if (n) console.log(`  ${t}:`, perGame(s.at[t], n));
  }
}

/** @param {string[]} argv */
function main(argv) {
  const games = Number(argv[0] ?? 20);
  const [a, b] = [STYLES[argv[1] ?? 'balanced'], STYLES[argv[2] ?? 'balanced']];
  const maxTurns = Number(argv[3] ?? 150);
  if (!a || !b) throw new Error(`Unknown style. Use one of: ${Object.keys(STYLES).join(', ')}`);
  const statsA = emptyStats();
  const statsB = emptyStats();
  /** @type {number[]} */
  const lengths = [];
  const started = Date.now();
  for (let g = 0; g < games; g++) {
    const aFirst = g % 2 === 0;
    const r = playGame(1000 + g, aFirst ? [a, b] : [b, a], aFirst ? [statsA, statsB] : [statsB, statsA], maxTurns);
    if (r.winner !== null) lengths.push(r.turns);
  }
  lengths.sort((x, y) => x - y);
  console.log(`Games: ${games} (${((Date.now() - started) / 1000).toFixed(1)} s), at most ${maxTurns} turns each (both players' turns counted)`);
  console.log(`Finished: ${lengths.length}, unfinished: ${games - lengths.length}.`);
  if (lengths.length) console.log(`Game length: min ${lengths[0]}, median ${lengths[Math.floor(lengths.length / 2)]}, max ${lengths.at(-1)} turns`);
  console.log('Board at turn (troop slots filled, blocked cells):');
  for (const t of SAMPLE_TURNS) {
    const x = board[t];
    if (x) console.log(`  ${t}: ${Math.round((x.fill / x.games) * 100)}% filled, ${(x.blocked / x.games).toFixed(1)} of ${CELL_COUNT} cells blocked (${x.games} games)`);
  }
  report(statsA, `A ${a.name}`);
  report(statsB, `B ${b.name}`);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tools/sim/run.mjs')) main(process.argv.slice(2));
