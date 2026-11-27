// Smoke test for the headless simulation bots (tools/sim): a short game runs with the real rules.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STYLES } from '../tools/sim/bot.mjs';
import { emptyStats, playGame } from '../tools/sim/run.mjs';

test('bots place their start buildings and play a short game with the real rules', () => {
  const s = [emptyStats(), emptyStats()];
  const r = playGame(7, [STYLES.expander, STYLES.warlord], s, 12);
  assert.ok(r.turns > 0 && r.turns <= 12);
  assert.ok(Object.values(s[0].actions).reduce((a, b) => a + b, 0) > 0, 'the bots act');
});
