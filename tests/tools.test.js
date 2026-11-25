// Tests for the board tools (clicks -> actions), port trade options and the board layout hit test.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOARD_VIEW } from '../source/src/config.js';
import { createRng } from '../source/src/core/rng.js';
import { hitTest, pointPos, troopSlot, cellCenter } from '../source/src/scenes/board-layout.js';
import { portTradeOptions } from '../source/src/systems/actions.js';
import { createState } from '../source/src/systems/state.js';
import { checkTarget, isValidSource, validTargets } from '../source/src/systems/tools.js';

function setup() {
  const state = createState(createRng(1), 2);
  for (const cell of state.cells) cell.troops.fill(0);
  for (const p of state.players) Object.assign(p.resources, { wood: 9, stone: 9, grain: 9, iron: 9 });
  state.phase = 'actions';
  return state;
}

test('move tool: valid targets are the neighbor cells with room', () => {
  const state = setup();
  state.cells[14].troops[0] = 1;
  state.cells[15].troops[1] = 8;
  assert.equal(isValidSource(state, 'move', 14), true);
  assert.equal(isValidSource(state, 'move', 15), false);
  assert.deepEqual(validTargets(state, 'move', 14, { count: 1 }).sort((a, b) => a - b), [8, 13, 20]);
  assert.deepEqual(validTargets(state, 'move', null, { count: 1 }), [], 'no targets before a source');
});

test('attack tool: a target is valid if any enemy there can be fought', () => {
  const state = setup();
  state.cells[14].troops[0] = 2;
  state.cells[15].troops[1] = 1;
  state.cells[14].troops[1] = 1;
  assert.equal(checkTarget(state, 'attack', 14, 14, { count: 1 }), null, 'inside');
  assert.equal(checkTarget(state, 'attack', 14, 15, { count: 1 }), 'error.not-held', 'outside needs a held cell');
  assert.equal(checkTarget(state, 'attack', 14, 16, { count: 1 }), 'error.no-defender');
});

test('port trade options: every way to pay 2 goods', () => {
  const state = setup();
  state.buildings[3] = { type: 'port', owner: 0 }; // (0,3): touches cells 2 and 3
  const [a, b] = [state.cells[2].resource, state.cells[3].resource];
  const options = portTradeOptions(state, 3).map((o) => JSON.stringify(o));
  if (a === b) assert.deepEqual(options, [JSON.stringify({ [a ?? '']: 2 })]);
  else assert.deepEqual(options.sort(), [{ [a ?? '']: 2 }, { [a ?? '']: 1, [b ?? '']: 1 }, { [b ?? '']: 2 }].map((o) => JSON.stringify(o)).sort());
});

test('layout: clicks pick the cell and the nearest intersection; troop slots stay off the number', () => {
  const c = cellCenter(14);
  assert.deepEqual(hitTest(c.x, c.y), { cell: 14, point: null });
  const p = pointPos(24);
  assert.deepEqual(hitTest(p.x + 3, p.y - 3), { cell: 14 + 1, point: 24 });
  assert.equal(hitTest(5, 5).cell, null);
  for (let k = 0; k < 8; k++) {
    const s = troopSlot(14, k);
    assert.ok(Math.hypot(s.x - c.x, s.y - c.y) - BOARD_VIEW.troopRadius > BOARD_VIEW.numberRadius);
  }
});

test('rng shuffle keeps every item', () => {
  const list = [1, 2, 3, 4, 5, 6];
  const out = createRng(3).shuffle(list);
  assert.deepEqual([...out].sort(), list);
  assert.deepEqual(list, [1, 2, 3, 4, 5, 6], 'the input is not changed');
});
