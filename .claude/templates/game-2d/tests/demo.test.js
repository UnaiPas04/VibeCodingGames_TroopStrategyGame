// Tests for the demo game logic. Replace them when the demo is replaced by the real game.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRng } from '../source/src/core/rng.js';
import { createPlayer, updatePlayer } from '../source/src/entities/player.js';
import { collectItems, spawnItem } from '../source/src/systems/items.js';

const bounds = { w: 320, h: 180 };
const tuning = { speed: 100, accel: 10000 };

test('player moves right and stays inside bounds', () => {
  const p = createPlayer(300, 10, 10);
  for (let i = 0; i < 120; i++) updatePlayer(p, { x: 1, y: 0 }, tuning, bounds, 1 / 60);
  assert.equal(p.x, bounds.w - p.w);
});

test('diagonal movement is not faster', () => {
  const p = createPlayer(100, 100, 10);
  updatePlayer(p, { x: 1, y: 1 }, tuning, bounds, 1 / 60);
  assert.ok(Math.hypot(p.vx, p.vy) <= tuning.speed + 1e-9);
});

test('collecting an item respawns it and counts it', () => {
  const rng = createRng(7);
  const items = [
    { x: 0, y: 0, w: 6, h: 6 },
    { x: 100, y: 100, w: 6, h: 6 }
  ];
  const collector = { x: 2, y: 2, w: 10, h: 10 };
  const n = collectItems(items, collector, () => spawnItem(rng, 6, bounds));
  assert.equal(n, 1);
  assert.equal(items.length, 2);
  assert.notDeepEqual(items[0], { x: 0, y: 0, w: 6, h: 6 });
});
