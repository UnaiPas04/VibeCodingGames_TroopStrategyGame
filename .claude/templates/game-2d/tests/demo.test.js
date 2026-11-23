// Tests for the demo game logic. Replace them when the demo is replaced by the real game.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEMS, MATCH } from '../source/src/config.js';
import { createRng } from '../source/src/core/rng.js';
import { createPlayer, updatePlayer } from '../source/src/entities/player.js';
import { collectItems, spawnItem } from '../source/src/systems/items.js';
import { createMatch, ranking, stepMatch } from '../source/src/systems/match.js';

const bounds = { w: 320, h: 180 };
const tuning = { speed: 100, accel: 10000 };
const DT = 1 / 60;

test('player moves right and stays inside bounds', () => {
  const p = createPlayer(300, 10, 10);
  for (let i = 0; i < 120; i++) updatePlayer(p, { x: 1, y: 0 }, tuning, bounds, DT);
  assert.equal(p.x, bounds.w - p.w);
});

test('diagonal movement is not faster', () => {
  const p = createPlayer(100, 100, 10);
  updatePlayer(p, { x: 1, y: 1 }, tuning, bounds, DT);
  assert.ok(Math.hypot(p.vx, p.vy) <= tuning.speed + 1e-9);
});

test('collecting an item respawns it and counts it', () => {
  const rng = createRng(7);
  const items = [
    { x: 0, y: 0, w: 6, h: 6 },
    { x: 100, y: 100, w: 6, h: 6 }
  ];
  const n = collectItems(items, { x: 2, y: 2, w: 10, h: 10 }, () => spawnItem(rng, 6, bounds));
  assert.equal(n, 1);
  assert.equal(items.length, 2);
  assert.notDeepEqual(items[0], { x: 0, y: 0, w: 6, h: 6 });
});

test('the same seed creates the same match (online clients rely on it)', () => {
  const players = [{ id: 'a' }, { id: 'b' }];
  const m1 = createMatch({ players, rng: createRng(99), bounds });
  const m2 = createMatch({ players, rng: createRng(99), bounds });
  assert.deepEqual(m1.items, m2.items);
  assert.equal(m1.items.length, ITEMS.count);
  assert.notEqual(m1.players[0].body.x, m1.players[1].body.x);
});

test('match: collecting scores for the right player, timer ends the match', () => {
  const match = createMatch({ players: [{ id: 'a' }, { id: 'b' }], rng: createRng(1), bounds });
  match.items[0] = { x: match.players[1].body.x, y: match.players[1].body.y, w: 6, h: 6 };
  const { collected } = stepMatch(match, new Map(), DT);
  assert.deepEqual(collected, ['b']);
  assert.equal(ranking(match)[0].id, 'b');

  let steps = 0;
  while (!match.ended && steps++ < (MATCH.seconds + 1) * 60) stepMatch(match, new Map(), DT);
  assert.equal(match.ended, true);
  assert.equal(match.timeLeft, 0);
});

// Skips itself when the physics module is removed (MATCH.playersCollide deleted from config.js).
const playersCollide = /** @type {{playersCollide?: boolean}} */ (MATCH).playersCollide === true;

test('match: players push each other instead of overlapping', { skip: !playersCollide }, () => {
  const match = createMatch({ players: [{ id: 'a' }, { id: 'b' }], rng: createRng(2), bounds });
  const [a, b] = match.players;
  b.body.x = a.body.x + 12; // b just to the right of a
  b.body.y = a.body.y;
  match.items.length = 0; // no pickups in the way
  const bStart = b.body.x;
  const push = new Map([['a', { x: 1, y: 0 }]]);
  for (let i = 0; i < 60; i++) stepMatch(match, push, DT);
  assert.ok(b.body.x > bStart + 10, 'b was pushed to the right');
  assert.ok(a.body.x + a.body.w <= b.body.x + 1e-6, 'they never overlap');
});
