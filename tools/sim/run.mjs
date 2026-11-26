// Headless simulation: bots play many games with the real rules and print statistics
// (economy: income, spending and leftover cards; what they built; actions played).
// There is no winner yet, so every game runs for maxTurns turns.
// Usage: npm run simulate -- [games] [styleA] [styleB] [maxTurns]
//   e.g. npm run simulate -- 20 expander builder 100
// Styles: see STYLES in tools/sim/bot.mjs. Two players; seats alternate so both styles start first.

import { GOLD, RESOURCES } from '../../source/src/config.js';
import { createRng } from '../../source/src/core/rng.js';
import { buildingsOf, roadsOf } from '../../source/src/systems/state.js';
import { endTurn, newGame, placeStart, rollDice } from '../../source/src/systems/turn.js';
import { STYLES, bestStart, playTurn } from './bot.mjs';

const CARDS = [...RESOURCES, GOLD];
const SAMPLE_TURNS = [10, 25, 50, 100];

/** Statistics of one style over all its games. */
export function emptyStats() {
  return {
    games: 0,
    /** @type {Record<string, number>} cards received, by resource (dice and ports) */ income: Object.fromEntries(CARDS.map((r) => [r, 0])),
    /** @type {Record<string, Record<string, number>>} cards spent, by action then resource */ spent: {},
    /** @type {Record<string, number>} actions played, by type */ actions: {},
    /** @type {Record<string, number>} cards left at the end */ leftover: Object.fromEntries(CARDS.map((r) => [r, 0])),
    /** @type {Record<number, {cards: number, settlements: number, big: number, roads: number}>} sums over games at sample turns */ at: {},
    /** @type {Record<number, number>} games that reached each sample turn */ reachedAt: {}
  };
}

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
  while (turns < maxTurns) {
    const me = state.current;
    const my = stats[me];
    const roll = rollDice(state, rng);
    for (const g of roll.gains) stats[g.player].income[g.resource] += g.amount;
    playTurn(state, styles[me], 25, (type, change) => {
      my.actions[type] = (my.actions[type] ?? 0) + 1;
      my.spent[type] ??= {};
      for (const [r, n] of Object.entries(change)) {
        if (n < 0) my.spent[type][r] = (my.spent[type][r] ?? 0) - n;
        else if (n > 0) my.income[r] += n; // gold from trades
      }
    });
    endTurn(state);
    turns++;
    if (SAMPLE_TURNS.includes(turns)) {
      state.players.forEach((p) => {
        const built = buildingsOf(state, p.id);
        const a = (stats[p.id].at[turns] ??= { cards: 0, settlements: 0, big: 0, roads: 0 });
        a.cards += CARDS.reduce((s, r) => s + p.resources[r], 0);
        a.settlements += built.filter(([, b]) => b.type === 'settlement').length;
        a.big += built.filter(([, b]) => b.type !== 'settlement').length;
        a.roads += roadsOf(state, p.id).length;
        stats[p.id].reachedAt[turns] = (stats[p.id].reachedAt[turns] ?? 0) + 1;
      });
    }
  }
  state.players.forEach((p) => {
    for (const r of CARDS) stats[p.id].leftover[r] += p.resources[r];
  });
  return { turns };
}

/** Per-game average of a record of numbers. @param {Record<string, number>} rec @param {number} games */
const perGame = (rec, games) => Object.fromEntries(Object.entries(rec).map(([k, n]) => [k, +(n / games).toFixed(1)]));

/** @param {ReturnType<typeof emptyStats>} s @param {string} label */
function report(s, label) {
  const g = s.games;
  /** @type {Record<string, number>} */
  const spentTotal = Object.fromEntries(CARDS.map((r) => [r, 0]));
  for (const byRes of Object.values(s.spent)) for (const [r, n] of Object.entries(byRes)) spentTotal[r] += n;
  console.log(`\n== ${label} ==`);
  console.log('Income per game (cards):', perGame(s.income, g));
  console.log('Spent per game (cards):  ', perGame(spentTotal, g));
  console.log('Left at the end (cards): ', perGame(s.leftover, g));
  console.log('Actions per game:', perGame(s.actions, g));
  console.log('At turn (cards in hand, settlements, castles+ports, roads):');
  for (const t of SAMPLE_TURNS) {
    const n = s.reachedAt[t];
    if (n) console.log(`  ${t}:`, perGame(s.at[t], n));
  }
}

/** @param {string[]} argv */
function main(argv) {
  const games = Number(argv[0] ?? 20);
  const [a, b] = [STYLES[argv[1] ?? 'balanced'], STYLES[argv[2] ?? 'balanced']];
  const maxTurns = Number(argv[3] ?? 100);
  if (!a || !b) throw new Error(`Unknown style. Use one of: ${Object.keys(STYLES).join(', ')}`);
  const statsA = emptyStats();
  const statsB = emptyStats();
  const started = Date.now();
  for (let g = 0; g < games; g++) {
    const aFirst = g % 2 === 0;
    playGame(1000 + g, aFirst ? [a, b] : [b, a], aFirst ? [statsA, statsB] : [statsB, statsA], maxTurns);
  }
  console.log(`Games: ${games} (${((Date.now() - started) / 1000).toFixed(1)} s), ${maxTurns} turns each (both players' turns counted)`);
  report(statsA, `A ${a.name}`);
  report(statsB, `B ${b.name}`);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tools/sim/run.mjs')) main(process.argv.slice(2));
