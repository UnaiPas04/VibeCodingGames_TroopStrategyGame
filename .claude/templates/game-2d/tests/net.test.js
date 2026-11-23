// Tests for the optional online module (delete together with source/src/net/).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRng } from '../source/src/core/rng.js';
import { normalizeCode, randomCode } from '../source/src/net/room.js';
import { decodeSnapshot, encodeSnapshot } from '../source/src/net/snapshot.js';
import { createMatch } from '../source/src/systems/match.js';

test('room codes are short, readable and normalized', () => {
  const code = randomCode();
  assert.match(code, /^[A-HJ-NP-Z2-9]{5}$/);
  assert.equal(normalizeCode(' ab-12 c '), 'AB12C');
});

test('snapshots round-trip positions, scores, items and time', () => {
  const match = createMatch({ players: [{ id: 'a' }, { id: 'b' }], rng: createRng(3), bounds: { w: 320, h: 180 } });
  match.players[1].score = 4;
  match.timeLeft = 12.5;
  const bytes = new Uint8Array(encodeSnapshot(match, 7).buffer);
  // Simulate a received chunk that does not start at offset 0 of its buffer.
  const shifted = new Uint8Array(bytes.length + 3);
  shifted.set(bytes, 3);
  const snap = decodeSnapshot(shifted.subarray(3));
  assert.equal(snap.tick, 7);
  assert.equal(snap.timeLeft, 12.5);
  assert.equal(snap.players.length, 2);
  assert.equal(snap.players[1].score, 4);
  assert.ok(Math.abs(snap.players[0].x - match.players[0].body.x) < 1e-3);
  assert.equal(snap.items.length, match.items.length);
});
