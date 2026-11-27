// Tests for click choices (what a click on an intersection or a cell side can do) and the board layout hit test.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOARD_VIEW } from '../source/src/config.js';
import { createRng } from '../source/src/core/rng.js';
import { portTradeOptions } from '../source/src/systems/actions.js';
import { edgeBetween } from '../source/src/systems/board.js';
import { activePoints, pointChoices, roadSlots, settlementDestinations } from '../source/src/systems/choices.js';
import { createState } from '../source/src/systems/state.js';
import { edgeMid, hitTest, pointPos } from '../source/src/scenes/board-layout.js';
import { P, setup as setupPlayers } from './helpers.js';

const setup = (/** @type {Record<string, number>} */ resources = {}) => setupPlayers(2, resources);


test('setup: every free intersection offers the start building', () => {
  const state = createState(createRng(1), 2);
  assert.equal(activePoints(state).length, 49);
  assert.deepEqual(pointChoices(state, P).map((c) => c.kind === 'action' && c.action.type), ['place-start']);
  state.buildings[P] = { type: 'castle', owner: 1 };
  assert.deepEqual(pointChoices(state, P), []);
  assert.deepEqual(roadSlots(state), [], 'no roads during the setup');
});

test('road slots: the free sides that connect to your buildings and roads', () => {
  const state = setup({ wood: 5 });
  const corner = roadSlots(state).length; // the far settlement's sides
  state.buildings[P] = { type: 'castle', owner: 0 };
  assert.equal(roadSlots(state).length, corner + 4);
  state.roads[/** @type {number} */ (edgeBetween(P, 25))] = 0;
  assert.equal(roadSlots(state).length, corner + 3 + 3, 'three more from the end of the road');
  state.players[0].resources.wood = 0;
  assert.deepEqual(roadSlots(state), [], 'nothing you cannot pay');
});

test('intersection circles: build next to your road, promote, trade, move a settlement', () => {
  const state = setup({ wood: 9, stone: 9, grain: 9 });
  state.buildings[P] = { type: 'settlement', owner: 0 };
  state.roads[/** @type {number} */ (edgeBetween(P, 25))] = 0;
  const kinds = (/** @type {number} */ p) => pointChoices(state, p).map((c) => (c.kind === 'action' ? c.action.type : c.kind));
  assert.deepEqual(kinds(25), ['build-settlement']);
  assert.deepEqual(kinds(P), ['promote', 'move-settlement']);
  assert.deepEqual(settlementDestinations(state, P), [25]);
  assert.deepEqual(kinds(10), []);
});

test('port trade options: every way to pay 2 goods', () => {
  const state = setup();
  state.cells[2].resource = 'wood';
  state.cells[3].resource = 'stone';
  assert.deepEqual(portTradeOptions(state, 3), [{ wood: 2 }, { wood: 1, stone: 1 }, { stone: 2 }]);
  state.cells[3].resource = 'wood';
  assert.deepEqual(portTradeOptions(state, 3), [{ wood: 2 }]);
});

test('layout: hit test finds the cell, the nearest intersection and the nearest cell side', () => {
  const p = pointPos(P);
  const hit = hitTest(p.x + 3, p.y - 2);
  assert.equal(hit.point, P);
  assert.ok(hit.pointDistance < BOARD_VIEW.pointPick);
  const e = /** @type {number} */ (edgeBetween(P, 25));
  const m = edgeMid(e);
  const side = hitTest(m.x + 2, m.y + 4);
  assert.equal(side.edge, e);
  assert.ok(side.edgeDistance < BOARD_VIEW.edgePick);
  assert.ok(side.pointDistance > BOARD_VIEW.pointPick, 'a side middle is far from the intersections');
  assert.equal(hitTest(5, 5).cell, null);
});

test('rng shuffle keeps every item', () => {
  const list = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = createRng(3).shuffle(list);
  assert.deepEqual([...out].sort((a, b) => a - b), list);
});
