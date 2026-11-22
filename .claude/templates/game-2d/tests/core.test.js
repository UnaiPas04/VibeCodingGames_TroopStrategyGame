// Unit tests for pure logic. Run with: npm test

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { circleRectOverlap, circlesOverlap, clamp, rectPenetration, rectsOverlap } from '../source/src/core/math.js';
import { createRng } from '../source/src/core/rng.js';
import { createEvents } from '../source/src/core/events.js';

test('clamp keeps values in range', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});

test('rectsOverlap detects overlap and touching edges as separate', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  assert.equal(rectsOverlap(a, { x: 5, y: 5, w: 10, h: 10 }), true);
  assert.equal(rectsOverlap(a, { x: 10, y: 0, w: 10, h: 10 }), false);
});

test('circle overlaps', () => {
  assert.equal(circlesOverlap({ x: 0, y: 0, r: 5 }, { x: 8, y: 0, r: 5 }), true);
  assert.equal(circlesOverlap({ x: 0, y: 0, r: 5 }, { x: 11, y: 0, r: 5 }), false);
  assert.equal(circleRectOverlap({ x: -3, y: 5, r: 4 }, { x: 0, y: 0, w: 10, h: 10 }), true);
});

test('rectPenetration pushes out along the shortest axis', () => {
  const push = rectPenetration({ x: 8, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 10, h: 10 });
  assert.deepEqual(push, { x: 2, y: 0 });
  assert.equal(rectPenetration({ x: 20, y: 0, w: 5, h: 5 }, { x: 0, y: 0, w: 10, h: 10 }), null);
});

test('rng is deterministic for a seed', () => {
  const a = createRng(42);
  const b = createRng(42);
  const seqA = Array.from({ length: 5 }, () => a.next());
  const seqB = Array.from({ length: 5 }, () => b.next());
  assert.deepEqual(seqA, seqB);
  for (const v of seqA) assert.ok(v >= 0 && v < 1);
  const r = createRng(1);
  for (let i = 0; i < 100; i++) {
    const n = r.int(1, 6);
    assert.ok(n >= 1 && n <= 6 && Number.isInteger(n));
  }
});

test('events: on, emit, unsubscribe', () => {
  const events = createEvents();
  let got = 0;
  const off = events.on('hit', (n) => (got += n));
  events.emit('hit', 2);
  off();
  events.emit('hit', 5);
  assert.equal(got, 2);
});
