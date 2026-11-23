// Tests for the optional physics module (delete together with source/src/physics/).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampToBounds, penetration, resolveCollisions, separate } from '../source/src/physics/collisions.js';

/** @returns {import('../source/src/physics/collisions.js').Body} */
const box = (x, y, w = 10, h = 10, extra = {}) => ({ x, y, w, h, ...extra });

test('box penetration pushes out along the shortest axis', () => {
  assert.deepEqual(penetration(box(8, 0), box(0, 0)), { x: 2, y: 0 });
  assert.deepEqual(penetration(box(0, 0), box(8, 0)), { x: -2, y: 0 });
  assert.equal(penetration(box(20, 0), box(0, 0)), null);
  assert.equal(penetration(box(10, 0), box(0, 0)), null, 'touching edges do not overlap');
});

test('circle penetrations', () => {
  const v = penetration({ x: 8, y: 0, r: 5 }, { x: 0, y: 0, r: 5 });
  assert.ok(v && Math.abs(v.x - 2) < 1e-9 && v.y === 0);
  const c = penetration({ x: -3, y: 5, r: 4 }, box(0, 0));
  assert.ok(c && c.x < 0 && c.y === 0, 'circle left of a box is pushed left');
  const inside = penetration({ x: 1, y: 5, r: 2 }, box(0, 0));
  assert.deepEqual(inside, { x: -3, y: 0 }, 'center inside: exit through the nearest side');
  const reverse = penetration(box(0, 0), { x: -3, y: 5, r: 4 });
  assert.ok(reverse && reverse.x > 0, 'box vs circle is the opposite of circle vs box');
});

test('equal masses share the push; a static body never moves', () => {
  const a = box(8, 0);
  const b = box(0, 0);
  separate(a, b);
  assert.equal(a.x, 9);
  assert.equal(b.x, -1);

  const wall = box(0, 0, 10, 10, { mass: 0 });
  const p = box(8, 0);
  separate(p, wall);
  assert.equal(wall.x, 0);
  assert.equal(p.x, 10);
});

test('moving into a body: equal masses share the velocity, a static body stops it', () => {
  const a = box(8, 0, 10, 10, { vx: -50, vy: 3 });
  const b = box(0, 0, 10, 10, { vx: 0, vy: 0 });
  separate(a, b);
  assert.equal(a.vx, -25, 'pusher slows to half');
  assert.equal(b.vx, -25, 'pushed body gets the other half');
  assert.equal(a.vy, 3, 'tangential velocity is kept');

  const wall = box(0, 0, 10, 10, { mass: 0, vx: 0, vy: 0 });
  const c = box(8, 0, 10, 10, { vx: -50, vy: 0 });
  separate(c, wall);
  assert.equal(c.vx, 0);
  assert.equal(wall.vx, 0);
});

test('resolveCollisions settles a pushed body against the world bounds', () => {
  const bounds = { w: 30, h: 10 };
  const pusher = box(12, 0);
  const pushed = box(20, 0);
  pusher.x = 15; // moved into the pushed box, which is already at the right edge
  resolveCollisions([pusher, pushed], { bounds, iterations: 4 });
  assert.equal(pushed.x, 20, 'pushed box stays inside the bounds');
  assert.ok(pusher.x <= 10 + 1e-9, 'pusher is blocked');
  assert.equal(penetration(pusher, pushed), null);
});

test('clampToBounds keeps boxes and circles inside', () => {
  const b = box(-5, 25);
  clampToBounds(b, { w: 100, h: 30 });
  assert.deepEqual([b.x, b.y], [0, 20]);
  const c = { x: 99, y: 0, r: 3 };
  clampToBounds(c, { w: 100, h: 30 });
  assert.deepEqual([c.x, c.y], [97, 3]);
});
