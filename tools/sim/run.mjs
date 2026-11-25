// Headless simulation: bots play many games with the real rules and print statistics
// (results, game length, economy: income, spending and leftover cards, strategies, sieges).
// Usage: npm run simulate -- [games] [styleA] [styleB] [maxTurns]
//   e.g. npm run simulate -- 20 aggressive economic 200
// Styles: see STYLES in tools/sim/bot.mjs. Two players; seats alternate so both styles start first.

import { GOLD, RESOURCES, TROOPS } from '../../source/src/config.js';
import { createRng } from '../../source/src/core/rng.js';
import { towersOf, troopsOnBoard } from '../../source/src/systems/state.js';
import { endTurn, newGame, rollDice } from '../../source/src/systems/turn.js';
import { STYLES, playTurn } from './bot.mjs';

const CARDS = [...RESOURCES, GOLD];
const SAMPLE_TURNS = [10, 50, 100, 200];

/** Statistics of one style over all its games. */
function emptyStats() {
  return {
    games: 0,
    wins: 0,
    /** @type {Record<string, number>} cards received, by resource (dice, towers, ports) */ income: Object.fromEntries(CARDS.map((r) => [r, 0])),
    /** gold from towers only */ towerGold: 0,
    /** @type {Record<string, Record<string, number>>} cards spent, by action then resource */ spent: {},
    /** @type {Record<string, number>} actions played, by type */ actions: {},
    /** @type {Record<string, number>} cards left at the end */ leftover: Object.fromEntries(CARDS.map((r) => [r, 0])),
    /** @type {Record<number, number>} troops on the board at sample turns (sum over games) */ troopsAt: {},
    /** @type {Record<number, number>} games that reached each sample turn */ reachedAt: {},
    attacksWon: 0,
    /** turns this style started with its tower full of enemies (besieged) */ besiegedTurns: 0,
    /** turns this style started with 4 of its troops in an enemy tower */ besiegingTurns: 0
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
  const { state } = newGame(rng, styles.length);
  for (const st of stats) st.games++;
  let turns = 0;
  while (state.phase !== 'over' && turns < maxTurns) {
    const me = state.current;
    const my = stats[me];
    // Siege state at the start of the turn.
    for (const cell of state.cells) {
      if (cell.kind !== 'tower' || cell.towerOwner === null) continue;
      const enemies = cell.troops.reduce((s, n, p) => s + (p === cell.towerOwner ? 0 : n), 0);
      if (cell.towerOwner === me && enemies >= TROOPS.maxPerTower) my.besiegedTurns++;
      if (cell.towerOwner !== me && cell.troops[me] >= TROOPS.maxPerTower) my.besiegingTurns++;
    }
    const roll = rollDice(state, rng);
    for (const g of roll.gains) stats[g.player].income[g.resource] += g.amount;
    playTurn(state, rng, styles[me], 25, (type, change, result) => {
      my.actions[type] = (my.actions[type] ?? 0) + 1;
      if (type === 'attack' && result.attackerWins) my.attacksWon++;
      my.spent[type] ??= {};
      for (const [r, n] of Object.entries(change)) {
        if (n < 0) my.spent[type][r] = (my.spent[type][r] ?? 0) - n;
        else if (n > 0) my.income[r] += n; // gold from port trades
      }
    });
    const start = endTurn(state);
    turns++;
    if (start.winner === null) {
      stats[start.player].income[GOLD] += start.gold;
      stats[start.player].towerGold += start.gold;
    }
    if (SAMPLE_TURNS.includes(turns)) {
      state.players.forEach((p) => {
        stats[p.id].troopsAt[turns] = (stats[p.id].troopsAt[turns] ?? 0) + troopsOnBoard(state, p.id);
        stats[p.id].reachedAt[turns] = (stats[p.id].reachedAt[turns] ?? 0) + 1;
      });
    }
  }
  state.players.forEach((p) => {
    for (const r of CARDS) stats[p.id].leftover[r] += p.resources[r];
  });
  if (state.winner !== null) stats[state.winner].wins++;
  return { winner: state.winner, turns, towers: state.players.map((p) => towersOf(state, p.id).length) };
}

/** Per-game average of a record of numbers. @param {Record<string, number>} rec @param {number} games */
const perGame = (rec, games) => Object.fromEntries(Object.entries(rec).map(([k, n]) => [k, +(n / games).toFixed(1)]));

/** @param {ReturnType<typeof emptyStats>} s @param {string} label */
function report(s, label) {
  const g = s.games;
  /** @type {Record<string, number>} */
  const spentTotal = Object.fromEntries(CARDS.map((r) => [r, 0]));
  for (const byRes of Object.values(s.spent)) for (const [r, n] of Object.entries(byRes)) spentTotal[r] += n;
  console.log(`\n== ${label}: ${s.wins}/${g} wins ==`);
  console.log('Income per game (cards):', perGame(s.income, g), `(tower gold ${(s.towerGold / g).toFixed(1)})`);
  console.log('Spent per game (cards):  ', perGame(spentTotal, g));
  console.log('Left at the end (cards): ', perGame(s.leftover, g));
  console.log('Actions per game:', perGame(s.actions, g), `attacks won: ${s.actions.attack ? Math.round((s.attacksWon / s.actions.attack) * 100) : 0}%`);
  console.log(
    'Spending by action (cards per game):',
    Object.fromEntries(Object.entries(s.spent).map(([type, byRes]) => [type, perGame(byRes, g)]))
  );
  console.log(
    'Troops on board at turn:',
    Object.fromEntries(SAMPLE_TURNS.filter((t) => s.reachedAt[t]).map((t) => [t, +(s.troopsAt[t] / s.reachedAt[t]).toFixed(1)]))
  );
  console.log(`Turns besieged (own tower full of enemies): ${(s.besiegedTurns / g).toFixed(1)} per game; besieging an enemy tower: ${(s.besiegingTurns / g).toFixed(1)}`);
}

/** @param {string[]} argv */
function main(argv) {
  const games = Number(argv[0] ?? 20);
  const [a, b] = [STYLES[argv[1] ?? 'balanced'], STYLES[argv[2] ?? 'balanced']];
  const maxTurns = Number(argv[3] ?? 200);
  if (!a || !b) throw new Error(`Unknown style. Use one of: ${Object.keys(STYLES).join(', ')}`);

  const statsA = emptyStats();
  const statsB = emptyStats();
  let firstSeatWins = 0;
  let timeouts = 0;
  /** @type {number[]} */
  const lengths = [];
  const started = Date.now();
  for (let g = 0; g < games; g++) {
    const aFirst = g % 2 === 0;
    const r = playGame(1000 + g, aFirst ? [a, b] : [b, a], aFirst ? [statsA, statsB] : [statsB, statsA], maxTurns);
    if (r.winner === null) timeouts++;
    else {
      lengths.push(r.turns);
      if (r.winner === 0) firstSeatWins++;
    }
  }
  lengths.sort((x, y) => x - y);
  const finished = games - timeouts;
  console.log(`Games: ${games} (${((Date.now() - started) / 1000).toFixed(1)} s), max ${maxTurns} turns each (both players' turns counted)`);
  console.log(`Finished: ${finished}, timeouts: ${timeouts}. First player won ${finished ? Math.round((firstSeatWins / finished) * 100) : 0}% of finished games.`);
  if (lengths.length) console.log(`Game length: min ${lengths[0]}, median ${lengths[Math.floor(lengths.length / 2)]}, max ${lengths.at(-1)} turns`);
  report(statsA, `A ${a.name}`);
  report(statsB, `B ${b.name}`);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tools/sim/run.mjs')) main(process.argv.slice(2));
