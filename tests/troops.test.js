// Tests for troops (docs/trial-rules.md): recruit, move, troop fights, blocking, building attacks and victory.
// Cell 14 = (2,2): corners 16, 17, 24, 23. Cell 15: 17, 18, 25, 24. Cell 21: 24, 25, 32, 31. Cell 22: 25, 26, 33, 32.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COSTS } from '../source/src/config.js';
import { applyAction, checkAction } from '../source/src/systems/actions.js';
import { bestAttacker, cellChoices, pointChoices, sourceTargets } from '../source/src/systems/choices.js';
import { canPayWithGold } from '../source/src/systems/state.js';
import { endTurn, produce } from '../source/src/systems/turn.js';
import { P, fixedDice, road, setup } from './helpers.js';

test('gold in a cost is paid with gold, on top of the gold that replaces missing cards', () => {
  assert.equal(canPayWithGold({ iron: 3, gold: 1 }, { iron: 3, gold: 2 }), false);
  assert.equal(canPayWithGold({ iron: 2, gold: 3 }, { iron: 3, gold: 2 }), true);
  assert.equal(canPayWithGold({ iron: 2, gold: 2 }, { iron: 3, gold: 2 }), false);
});

test('recruit: 4 troops in a cell next to your castle, fewer if there is less room', () => {
  const state = setup(2, { grain: 5 });
  state.buildings[P] = { type: 'castle', owner: 0 };
  assert.equal(checkAction(state, { type: 'recruit', cell: 9 }), 'error.no-castle');
  const r = applyAction(state, { type: 'recruit', cell: 14 });
  assert.deepEqual([r.count, state.cells[14].troops[0]], [4, 4]);
  assert.equal(state.players[0].resources.grain, 5 - COSTS.recruit.grain);
  state.cells[15].troops[1] = 6;
  assert.equal(applyAction(state, { type: 'recruit', cell: 15 }).count, 2);
  assert.equal(checkAction(state, { type: 'recruit', cell: 15 }), 'error.cell-full');
  state.buildings[3] = { type: 'port', owner: 0 };
  assert.equal(checkAction(state, { type: 'recruit', cell: 2 }), 'error.no-castle', 'ports do not recruit');
});

test('move: only to cells next to your buildings, at any distance, for grain per troop and cell', () => {
  const state = setup(2, { grain: 20 });
  state.buildings[P] = { type: 'castle', owner: 0 }; // corner of cells 14, 15, 20, 21
  state.cells[14].troops[0] = 4;
  assert.equal(checkAction(state, { type: 'move', from: 14, to: 9, count: 1 }), 'error.move-needs-building');
  assert.deepEqual(sourceTargets(state, 14, 4).moves, [15, 20, 21, 35], 'around the castle, and cell 35 by the far settlement');
  applyAction(state, { type: 'move', from: 14, to: 21, count: 4 });
  assert.equal(state.cells[21].troops[0], 4);
  assert.equal(state.players[0].resources.grain, 20 - 4); // 4 troops x 2 cells x 1/2
  state.buildings[26] = { type: 'castle', owner: 1 }; // a rival building does not count
  assert.equal(checkAction(state, { type: 'move', from: 21, to: 22, count: 1 }), 'error.move-needs-building');
});

test('troop attack from a neighbor: troops + your troops inside + buildings on the attacked cell + a die', () => {
  const state = setup(2, { iron: 20 });
  state.buildings[P] = { type: 'castle', owner: 0 }; // a corner of cells 14, 15, 20, 21: +2 for red there
  state.cells[14].troops[0] = 5;
  state.cells[15].troops[1] = 2;
  state.cells[21].troops[1] = 1;
  assert.equal(checkAction(state, { type: 'attack', from: 14, target: 21, defender: 1, count: 1 }), 'error.not-neighbor');
  assert.deepEqual(sourceTargets(state, 14, 5).attacks, [15]);
  const lost = applyAction(state, { type: 'attack', from: 14, target: 15, defender: 1, count: 3 }, fixedDice([1, 6])); // 3+2+1 vs 2+0+6
  assert.equal(lost.attackerWins, false, 'ties and lower totals lose');
  assert.deepEqual([state.cells[14].troops[0], state.cells[15].troops[1]], [2, 2]);
  assert.equal(state.players[0].resources.iron, 20 - COSTS.attack.iron);
  state.cells[15].troops[0] = 1; // one red troop already inside helps
  const won = applyAction(state, { type: 'attack', from: 14, target: 15, defender: 1, count: 2 }, fixedDice([2, 4])); // 2+1+2+2 vs 2+0+4
  assert.deepEqual([won.attackerWins, won.helpers], [true, 1]);
  assert.deepEqual([state.cells[14].troops[0], state.cells[15].troops[0], state.cells[15].troops[1]], [0, 3, 0], 'the winners move in');
});

test('troop attack: a loss kills the attackers from outside and your troops inside too', () => {
  const state = setup(2, { iron: 20 });
  state.cells[14].troops[0] = 2;
  state.cells[20].troops[0] = 1;
  state.cells[20].troops[1] = 4;
  const r = applyAction(state, { type: 'attack', from: 14, target: 20, defender: 1, count: 2 }, fixedDice([1, 6])); // 2+1+1 vs 4+6
  assert.deepEqual([r.attackerWins, r.attackerLost], [false, 3]);
  assert.deepEqual([state.cells[14].troops[0], state.cells[20].troops[0], state.cells[20].troops[1]], [0, 0, 4]);
});

test('troop attack from inside the cell: every troop of yours there fights', () => {
  const state = setup(2, { iron: 20 });
  state.cells[21].troops[0] = 3;
  state.cells[21].troops[1] = 2;
  assert.equal(checkAction(state, { type: 'attack', from: 21, target: 21, defender: 1, count: 2 }), 'error.inside-all');
  assert.deepEqual(cellChoices(state, 21, 21).map((c) => c.kind), ['attack']);
  const r = applyAction(state, { type: 'attack', from: 21, target: 21, defender: 1, count: 3 }, fixedDice([6, 1])); // 3+6 vs 2+1
  assert.deepEqual([r.attackerWins, r.inside, r.moved], [true, true, 0]);
  assert.deepEqual(state.cells[21].troops, [3, 0]);
  state.cells[21].troops[1] = 5;
  applyAction(state, { type: 'attack', from: 21, target: 21, defender: 1, count: 3 }, fixedDice([1, 6]));
  assert.deepEqual(state.cells[21].troops, [0, 5], 'a loss inside kills them all');
});

test('blocking: a cell full of one player troops pays only that player buildings', () => {
  const state = setup(2);
  state.cells.forEach((c) => (c.number = 3));
  Object.assign(state.cells[14], { number: 9, resource: 'wood', kind: 'normal' });
  state.buildings[16] = { type: 'castle', owner: 1 };
  state.buildings[17] = { type: 'settlement', owner: 0 };
  state.cells[14].troops[0] = 7;
  produce(state, 9);
  assert.deepEqual([state.players[0].resources.wood, state.players[1].resources.wood], [1, 2], '7 troops do not block');
  state.cells[14].troops[0] = 8;
  produce(state, 9);
  assert.deepEqual([state.players[0].resources.wood, state.players[1].resources.wood], [2, 2], '8 troops block the rival');
});

test('building attack: buildings sharing a cell; building + troop support + a die; a win topples it', () => {
  const state = setup(2, { iron: 9, gold: 6 });
  state.buildings[P] = { type: 'castle', owner: 0 };
  state.buildings[32] = { type: 'settlement', owner: 1 }; // shares cell 21 with 24
  state.buildings[25] = { type: 'castle', owner: 1 };
  state.buildings[10] = { type: 'settlement', owner: 1 };
  assert.equal(checkAction(state, { type: 'attack-building', from: P, target: 10 }), 'error.building-too-far');
  assert.equal(checkAction(state, { type: 'attack-building', from: 32, target: P }), 'error.not-your-building');
  assert.equal(bestAttacker(state, 32), P);
  assert.deepEqual(pointChoices(state, 32).map((c) => c.kind), ['attack-building']);
  // Around 32: cells 21, 22, 27, 28. Red leads in 21, blue in 27: +1 each.
  state.cells[21].troops[0] = 3;
  state.cells[27].troops[1] = 2;
  const lose = applyAction(state, { type: 'attack-building', from: P, target: 32 }, fixedDice([1, 3])); // 2+1+1 vs 1+1+3
  assert.deepEqual([lose.attackerSupport, lose.defenderSupport, lose.toppled], [1, 1, null]);
  assert.deepEqual([state.players[0].resources.iron, state.players[0].resources.gold], [9 - (COSTS.attackBuilding.iron ?? 0), 6 - (COSTS.attackBuilding.gold ?? 0)]);
  applyAction(state, { type: 'attack-building', from: P, target: 32 }, fixedDice([3, 3])); // 2+1+3 vs 1+1+3
  assert.equal(state.buildings[32], undefined, 'a toppled settlement is destroyed');
  state.players[0].resources = { wood: 0, stone: 0, grain: 0, iron: 3, gold: 3 };
  applyAction(state, { type: 'attack-building', from: P, target: 25 }, fixedDice([6, 1]));
  assert.equal(state.buildings[25].type, 'settlement', 'a toppled castle becomes a settlement');
});

test('victory: a player with no buildings is out (troops and roads go); the last one standing wins', () => {
  const state = setup(3, { iron: 9, gold: 9 });
  delete state.buildings[47]; // blue's far settlement
  state.buildings[P] = { type: 'castle', owner: 0 };
  state.buildings[32] = { type: 'settlement', owner: 1 };
  state.cells[5].troops[1] = 3;
  state.roads[road(32, 33)] = 1;
  const r = applyAction(state, { type: 'attack-building', from: P, target: 32 }, fixedDice([6, 1]));
  assert.deepEqual(r.eliminated, [1]);
  assert.equal(state.players[1].eliminated, true);
  assert.deepEqual([state.cells[5].troops[1], state.roads[road(32, 33)]], [0, undefined]);
  assert.equal(state.phase, 'actions', 'green is still in');
  endTurn(state);
  assert.equal(state.current, 2, 'eliminated players are skipped');
  state.phase = 'actions';
  state.current = 0;
  delete state.buildings[46]; // green's far settlement
  state.buildings[31] = { type: 'settlement', owner: 2 };
  applyAction(state, { type: 'attack-building', from: P, target: 31 }, fixedDice([6, 1]));
  assert.deepEqual([state.phase, state.winner], ['over', 0]);
});

test('cell clicks: recruit on a cell next to your castle; with troops selected, move or attack', () => {
  const state = setup(2, { grain: 5, iron: 5 });
  state.buildings[P] = { type: 'castle', owner: 0 };
  assert.deepEqual(cellChoices(state, null, 14).map((c) => c.kind === 'action' && c.action.type), ['recruit']);
  state.cells[14].troops[0] = 4;
  state.cells[15].troops[1] = 1;
  assert.deepEqual(cellChoices(state, 14, 15, 4).map((c) => c.kind), ['action', 'attack'], 'cell 15 has room and touches your castle');
  assert.deepEqual(cellChoices(state, 14, 14).map((c) => c.kind), ['action'], 'no rivals inside: only recruit');
  state.cells[14].troops[1] = 1;
  assert.deepEqual(cellChoices(state, 14, 14).map((c) => c.kind), ['attack', 'action'], 'rivals inside: attack them, or recruit');
});
