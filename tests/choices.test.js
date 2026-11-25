// Tests for click choices (what a click on a cell or intersection can do) and the board layout hit test.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOARD_VIEW } from '../source/src/config.js';
import { createRng } from '../source/src/core/rng.js';
import { cellCenter, hitTest, pointPos, troopSlot } from '../source/src/scenes/board-layout.js';
import { portTradeOptions } from '../source/src/systems/actions.js';
import { activePoints, cellChoices, moveTo, pointChoices, settlementDestinations, sourceTargets } from '../source/src/systems/choices.js';
import { createState } from '../source/src/systems/state.js';

function setup() {
  const state = createState(createRng(1), 2);
  for (const cell of state.cells) cell.troops.fill(0);
  for (const p of state.players) Object.assign(p.resources, { wood: 9, stone: 9, grain: 9, iron: 9 });
  state.phase = 'actions';
  return state;
}

const kinds = (/** @type {import('../source/src/systems/choices.js').Choice[]} */ list) =>
  list.map((c) => (c.kind === 'action' ? c.action.type : c.kind));

test('a click on a destination moves the picked troops, fewer if fewer fit, at any distance', () => {
  const state = setup();
  state.cells[14].troops[0] = 5;
  state.cells[15].troops[1] = 6;
  assert.deepEqual(moveTo(state, 14, 16, 4), { type: 'move', from: 14, to: 16, count: 4 });
  assert.deepEqual(moveTo(state, 14, 15, 4), { type: 'move', from: 14, to: 15, count: 2 }, 'only 2 places left');
  assert.deepEqual(moveTo(state, 14, 31, 1), { type: 'move', from: 14, to: 31, count: 1 }, '4 cells away');
});

test('with a source selected, a click moves or attacks', () => {
  const state = setup();
  state.cells[14].troops[0] = 3;
  state.cells[15].troops[1] = 1;
  assert.deepEqual(kinds(cellChoices(state, 14, 15, 3)), ['move', 'attack'], 'enemy next to a held cell');
  assert.deepEqual(kinds(cellChoices(state, 14, 16, 3)), ['move']);
  assert.deepEqual(kinds(cellChoices(state, 14, 35, 3)), ['move'], 'any distance');
  state.cells[14].troops[1] = 1;
  assert.deepEqual(kinds(cellChoices(state, 14, 14)), ['attack'], 'inside attack on the selected cell');
  const targets = sourceTargets(state, 14, 3);
  assert.ok(targets.moves.includes(15) && targets.moves.includes(16));
  assert.ok(targets.attacks.includes(14));
  assert.ok(!targets.attacks.includes(15), 'outside attacks need a held cell');
});

test('recruit appears on cells touching your castle', () => {
  const state = setup();
  state.buildings[24] = { type: 'castle', owner: 0 }; // touches 14, 15, 20, 21
  assert.deepEqual(kinds(cellChoices(state, null, 21)), ['recruit']);
  assert.deepEqual(kinds(cellChoices(state, null, 22)), []);
});

test('intersection circles: build, promote, trade and move settlements', () => {
  const state = setup();
  state.cells[14].troops[0] = 1;
  state.cells[15].troops[0] = 1;
  assert.deepEqual(kinds(pointChoices(state, 24)), ['build-settlement']);
  assert.ok(activePoints(state).includes(24));
  state.buildings[24] = { type: 'settlement', owner: 0 };
  assert.ok(kinds(pointChoices(state, 24)).includes('move-settlement'));
  assert.equal(settlementDestinations(state, 24).length, 4);
  state.cells[20].troops[0] = 1;
  state.cells[21].troops[0] = 1;
  assert.ok(kinds(pointChoices(state, 24)).includes('promote'));
  state.phase = 'roll';
  assert.deepEqual(activePoints(state), [], 'nothing to click before the roll');
});

test('port trade options: every way to pay 2 goods', () => {
  const state = setup();
  state.buildings[3] = { type: 'port', owner: 0 }; // (0,3): touches cells 2 and 3
  const [a, b] = [state.cells[2].resource ?? '', state.cells[3].resource ?? ''];
  const options = portTradeOptions(state, 3).map((o) => JSON.stringify(o)).sort();
  if (a === b) assert.deepEqual(options, [JSON.stringify({ [a]: 2 })]);
  else assert.deepEqual(options, [{ [a]: 2 }, { [a]: 1, [b]: 1 }, { [b]: 2 }].map((o) => JSON.stringify(o)).sort());
});

test('layout: hit test finds the cell and the nearest intersection; troop slots stay off the number', () => {
  const c = cellCenter(14);
  assert.equal(hitTest(c.x, c.y).cell, 14);
  assert.ok(hitTest(c.x, c.y).pointDistance > BOARD_VIEW.pointPick, 'a cell center never hits a circle');
  const p = pointPos(24);
  const hit = hitTest(p.x + 3, p.y - 3);
  assert.equal(hit.point, 24);
  assert.ok(hit.pointDistance <= BOARD_VIEW.pointPick);
  assert.equal(hitTest(5, 5).cell, null);
  for (const slots of [4, 8]) {
    for (let k = 0; k < slots; k++) {
      const s = troopSlot(14, k, slots);
      assert.ok(Math.hypot(s.x - c.x, s.y - c.y) - BOARD_VIEW.troopRadius > BOARD_VIEW.numberRadius);
    }
  }
});

test('rng shuffle keeps every item', () => {
  const list = [1, 2, 3, 4, 5, 6];
  const out = createRng(3).shuffle(list);
  assert.deepEqual([...out].sort(), list);
  assert.deepEqual(list, [1, 2, 3, 4, 5, 6], 'the input is not changed');
});
