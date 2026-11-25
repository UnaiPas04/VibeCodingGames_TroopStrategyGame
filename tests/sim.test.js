// Smoke test for the headless simulation bots (tools/sim): a short game runs with the real rules.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STYLES } from '../tools/sim/bot.mjs';
import { playGame } from '../tools/sim/run.mjs';

test('bots play a short game with the real rules without errors', () => {
  const stats = () => ({ games: 0, wins: 0, income: {}, towerGold: 0, spent: {}, actions: {}, leftover: {}, troopsAt: {}, reachedAt: {}, attacksWon: 0, besiegedTurns: 0, besiegingTurns: 0 });
  const s = [stats(), stats()];
  const r = playGame(7, [STYLES.balanced, STYLES.aggressive], /** @type {any} */ (s), 12);
  assert.ok(r.turns > 0 && r.turns <= 12);
  assert.ok(Object.values(s[0].actions).reduce((a, b) => a + b, 0) > 0, 'the bots act');
});
