// Tests for the trial rules (docs/trial-rules.md): board, production, actions, combat, towers and turns.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOARD, COSTS, RESOURCES, TROOPS } from '../source/src/config.js';
import { createRng } from '../source/src/core/rng.js';
import { applyAction, checkAction, portGoods } from '../source/src/systems/actions.js';
import {
  BASE_CELLS,
  CELL_COUNT,
  POINT_COUNT,
  cellNeighbors,
  generateCells,
  neighborPairsAt,
  pointCells,
  pointKind,
  quadrantOf,
  sharedSideEnds
} from '../source/src/systems/board.js';
import { winChance } from '../source/src/systems/combat.js';
import { createState, majorityGain } from '../source/src/systems/state.js';
import { endTurn, newGame, produce, rollDice, startTurn } from '../source/src/systems/turn.js';

// Board layout used below (6 x 6): cell id = row * 6 + col; intersection id = row * 7 + col.
// Inner intersection 24 = (3,3) touches cells 14, 15, 20, 21. Coast intersection 3 = (0,3) touches cells 2 and 3.
const P = 24;
const AROUND_P = [14, 15, 20, 21];

/** Fake rng with fixed dice values. @param {number[]} dice */
const fixedDice = (dice) => ({ int: () => /** @type {number} */ (dice.shift()), shuffle: (/** @type {any[]} */ l) => [...l] });

/** A state in the actions phase with no troops anywhere and the given resources for every player. */
function setup(playerCount = 2, resources = {}) {
  const state = createState(createRng(1), playerCount);
  for (const cell of state.cells) cell.troops.fill(0);
  for (const p of state.players) Object.assign(p.resources, resources);
  state.phase = 'actions';
  return state;
}

/** @param {any} state @param {number} cell @param {number[]} troops */
const put = (state, cell, troops) => troops.forEach((n, p) => (state.cells[cell].troops[p] = n));

const rich = { wood: 20, stone: 20, grain: 20, iron: 20, gold: 0 };

// ---- Board ----

test('board geometry: neighbors, intersection kinds and shared sides', () => {
  assert.deepEqual(cellNeighbors(0).sort(), [1, 6]);
  assert.equal(cellNeighbors(14).length, 4);
  const kinds = { inner: 0, coast: 0, corner: 0 };
  for (let p = 0; p < POINT_COUNT; p++) kinds[pointKind(p)]++;
  assert.deepEqual(kinds, { inner: 25, coast: 20, corner: 4 });
  assert.deepEqual(pointCells(P).sort((a, b) => a - b), AROUND_P);
  assert.deepEqual(sharedSideEnds(14, 15).sort((a, b) => a - b), [17, 24]);
  assert.equal(neighborPairsAt(P).length, 4);
  assert.equal(neighborPairsAt(3).length, 1);
  assert.equal(neighborPairsAt(0).length, 0);
});

test('generation: every quadrant has each number once and 2 cells of each resource', () => {
  for (const seed of [1, 2, 3]) {
    const cells = generateCells(createRng(seed), 4);
    for (let q = 0; q < 4; q++) {
      const normal = cells.filter((c) => quadrantOf(c.id) === q && c.kind === 'normal');
      assert.equal(normal.length, 8);
      assert.deepEqual(normal.map((c) => c.number).sort((a, b) => /** @type {number} */ (a) - /** @type {number} */ (b)), BOARD.numbers);
      for (const r of RESOURCES) assert.equal(normal.filter((c) => c.resource === r).length, 2);
    }
  }
});

test('generation: towers in the players bases (quadrant centers), empty bases for missing players', () => {
  assert.deepEqual(BASE_CELLS.map(quadrantOf), [0, 1, 2, 3]);
  const cells = generateCells(createRng(1), 3);
  const kinds = BASE_CELLS.map((id) => cells[id].kind);
  assert.deepEqual(kinds, ['tower', 'tower', 'tower', 'empty']);
  assert.deepEqual(BASE_CELLS.slice(0, 3).map((id) => cells[id].towerOwner), [0, 1, 2]);
  for (const id of BASE_CELLS) assert.equal(cells[id].number, null);
  assert.equal(cells[BASE_CELLS[0]].resource, 'gold');
  assert.equal(cells[BASE_CELLS[3]].resource, null);
  const two = generateCells(createRng(1), 2);
  assert.equal(two[BASE_CELLS[2]].towerOwner, 1, '2 players take opposite corners');
  assert.equal(cells.length, CELL_COUNT);
});

// ---- Production ----

test('majority gain follows the trial rule table', () => {
  const state = setup(3);
  const cases = [
    [[3, 0, 0], { player: 0, amount: 3 }],
    [[5, 1, 2], { player: 0, amount: 2 }],
    [[3, 3, 0], null],
    [[3, 2, 2], null],
    [[0, 0, 0], null],
    [[1, 4, 0], { player: 1, amount: 3 }]
  ];
  for (const [troops, expected] of cases) {
    put(state, 14, /** @type {number[]} */ (troops));
    assert.deepEqual(majorityGain(state, 14), expected, JSON.stringify(troops));
  }
});

test('production: cells with the rolled number pay their majority player', () => {
  const state = setup(2);
  const cell = state.cells.find((c) => c.kind === 'normal');
  if (!cell || cell.number === null || cell.resource === null) throw new Error('no normal cell');
  put(state, cell.id, [3, 1]);
  const before = state.players[0].resources[cell.resource];
  const gains = produce(state, cell.number);
  assert.ok(gains.some((g) => g.cell === cell.id && g.amount === 2));
  assert.equal(state.players[0].resources[cell.resource], before + 2);
});

// ---- Turns ----

test('first turn: the starting troops give their gold, then troops spawn', () => {
  const { state, start } = newGame(createRng(5), 2);
  assert.equal(start.gold, TROOPS.start);
  assert.equal(state.players[0].resources.gold, TROOPS.start);
  assert.equal(state.cells[BASE_CELLS[0]].troops[0], Math.min(TROOPS.maxPerCell, TROOPS.start + TROOPS.spawnPerTower));
  assert.equal(state.phase, 'roll');
});

test('dice: sums 2, 7 and 12 are rolled again', () => {
  const { state } = newGame(createRng(5), 2);
  const roll = rollDice(state, fixedDice([1, 1, 3, 4, 6, 6, 2, 3]));
  assert.deepEqual(roll.rerolled, [2, 7, 12]);
  assert.equal(roll.sum, 5);
  assert.equal(state.phase, 'actions');
});

test('tower gold counts every tower where the active player has the majority', () => {
  const state = setup(2);
  put(state, BASE_CELLS[0], [4, 1]); // own tower: 3 gold
  put(state, BASE_CELLS[2], [2, 0]); // rival tower: 2 gold
  state.current = 0;
  const start = startTurn(state);
  assert.equal(start.gold, 5);
});

test('spawn: up to 2 per owned tower, never over the cell limit', () => {
  const state = setup(2);
  state.cells[BASE_CELLS[2]].towerOwner = 0; // player 0 owns both towers
  put(state, BASE_CELLS[0], [7, 0]);
  put(state, BASE_CELLS[2], [1, 0]);
  const start = startTurn(state);
  assert.equal(start.spawned, 1 + Math.min(TROOPS.spawnPerTower, 7));
  assert.equal(state.cells[BASE_CELLS[0]].troops[0], 8);
});

// ---- Movement ----

test('move: 1 grain, neighbors only, never into a full cell', () => {
  const state = setup(2, { grain: 5 });
  put(state, 14, [2, 0]);
  assert.equal(checkAction(state, { type: 'move', from: 14, to: 16 }), 'error.not-neighbor');
  applyAction(state, { type: 'move', from: 14, to: 15 }, fixedDice([]));
  assert.equal(state.cells[15].troops[0], 1);
  assert.equal(state.players[0].resources.grain, 4);
  put(state, 20, [0, 8]);
  assert.equal(checkAction(state, { type: 'move', from: 14, to: 20 }), 'error.cell-full');
  state.players[0].resources.grain = 0;
  assert.equal(checkAction(state, { type: 'move', from: 14, to: 13 }), 'error.cannot-pay');
});

test('wagon: 3 troops one cell, or 1 troop up to 3 cells', () => {
  const state = setup(2, rich);
  put(state, 14, [4, 0]);
  applyAction(state, { type: 'wagon-group', from: 14, to: 15, count: 3 }, fixedDice([]));
  assert.equal(state.cells[15].troops[0], 3);
  assert.equal(checkAction(state, { type: 'wagon-group', from: 15, to: 16, count: 4 }), 'error.bad-count');
  assert.throws(() => applyAction(state, { type: 'wagon-long', from: 14, to: 31 }, fixedDice([])), /too-far/); // (2,2) -> (5,1): 4 steps
});

test('wagon long: rejects more than 3 steps', () => {
  const state = setup(2, rich);
  put(state, 14, [1, 0]);
  assert.equal(checkAction(state, { type: 'wagon-long', from: 14, to: 31 }), 'error.too-far');
  assert.equal(checkAction(state, { type: 'wagon-long', from: 14, to: 27 }), null); // (4,3): 3 steps
});

test('recruit: only in a cell touching one of your castles', () => {
  const state = setup(2, rich);
  assert.equal(checkAction(state, { type: 'recruit', cell: 14 }), 'error.no-castle');
  state.buildings[P] = { type: 'castle', owner: 0 };
  applyAction(state, { type: 'recruit', cell: 21 }, fixedDice([]));
  assert.equal(state.cells[21].troops[0], 1);
});

// ---- Combat ----

test('win odds match the trial rule table', () => {
  const pct = (/** @type {number} */ e) => Math.round(winChance(e) * 100);
  assert.deepEqual([-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map(pct), [3, 8, 17, 28, 42, 58, 72, 83, 92, 97, 100]);
});

test('attack inside: winning removes every defender troop, losing costs only the committed troops', () => {
  const state = setup(2, rich);
  put(state, 14, [5, 3]);
  const win = applyAction(state, { type: 'attack', from: 14, target: 14, defender: 1, count: 3 }, fixedDice([4, 2]));
  assert.equal(win.attackerWins, true);
  assert.deepEqual(state.cells[14].troops, [5, 0]);
  assert.equal(state.players[0].resources.iron, 19);
  assert.equal(state.players[0].resources.grain, 20, 'inside costs only iron');

  put(state, 14, [5, 3]);
  const tie = applyAction(state, { type: 'attack', from: 14, target: 14, defender: 1, count: 3 }, fixedDice([3, 3]));
  assert.equal(tie.attackerWins, false, 'the defender wins ties');
  assert.deepEqual(state.cells[14].troops, [2, 3]);
});

test('attack outside: only from a held cell, all troops can be committed', () => {
  const state = setup(2, rich);
  put(state, 14, [3, 1]);
  put(state, 15, [0, 2]);
  assert.equal(checkAction(state, { type: 'attack', from: 14, target: 15, defender: 1, count: 2 }), 'error.not-held');
  put(state, 14, [3, 0]);
  assert.equal(checkAction(state, { type: 'attack', from: 14, target: 16, defender: 1, count: 1 }), 'error.no-defender');
  applyAction(state, { type: 'attack', from: 14, target: 15, defender: 1, count: 3 }, fixedDice([1, 6]));
  assert.deepEqual(state.cells[14].troops, [0, 0], 'committing everything can empty your cell');
  assert.equal(state.players[0].resources.grain, 19, 'outside costs iron and grain');
});

test('attack outside: only the buildings on the shared side count, each for its owner', () => {
  const state = setup(2, rich);
  put(state, 14, [2, 0]);
  put(state, 15, [0, 2]);
  state.buildings[17] = { type: 'castle', owner: 1 }; // shared side end: +2 for the defender
  state.buildings[16] = { type: 'castle', owner: 1 }; // (2,2): corner of cell 14, not on the shared side
  state.buildings[25] = { type: 'settlement', owner: 0 }; // corner of 15, not on the shared side
  const r = applyAction(state, { type: 'attack', from: 14, target: 15, defender: 1, count: 2 }, fixedDice([6, 1]));
  assert.equal(r.defenderBonus, 2);
  assert.equal(r.attackerBonus, 0);
});

// ---- Buildings ----

test('settlement: needs two neighboring held cells meeting at the intersection', () => {
  const state = setup(2, rich);
  put(state, 14, [1, 0]);
  put(state, 21, [1, 0]); // diagonal: not neighbors
  assert.equal(checkAction(state, { type: 'build-settlement', point: P }), 'error.need-two-held');
  put(state, 15, [1, 0]);
  applyAction(state, { type: 'build-settlement', point: P }, fixedDice([]));
  assert.deepEqual(state.buildings[P], { type: 'settlement', owner: 0 });
  assert.equal(checkAction(state, { type: 'build-settlement', point: P }), 'error.point-taken');
});

test('promotion: castle needs all 4 cells, port needs both coast cells, corners never', () => {
  const state = setup(2, rich);
  state.buildings[P] = { type: 'settlement', owner: 0 };
  for (const c of AROUND_P.slice(0, 3)) put(state, c, [1, 0]);
  assert.equal(checkAction(state, { type: 'promote', point: P }), 'error.need-all-held');
  put(state, 21, [1, 0]);
  applyAction(state, { type: 'promote', point: P }, fixedDice([]));
  assert.equal(state.buildings[P].type, 'castle');
  assert.equal(state.players[0].resources.stone, 20 - COSTS.castle.stone);

  state.buildings[3] = { type: 'settlement', owner: 0 };
  put(state, 2, [1, 0]);
  put(state, 3, [1, 0]);
  applyAction(state, { type: 'promote', point: 3 }, fixedDice([]));
  assert.equal(state.buildings[3].type, 'port');

  state.buildings[48] = { type: 'settlement', owner: 0 };
  assert.equal(checkAction(state, { type: 'promote', point: 48 }), 'error.cannot-promote-corner');
});

test('conquer: a settlement split 2 and 2 cannot be stolen, 3 of 4 can', () => {
  const state = setup(2, rich);
  state.buildings[P] = { type: 'settlement', owner: 1 };
  put(state, 14, [1, 0]);
  put(state, 15, [1, 0]);
  put(state, 20, [0, 1]);
  put(state, 21, [0, 1]);
  assert.equal(checkAction(state, { type: 'conquer', point: P }), 'error.conquer-condition');
  put(state, 20, [1, 0]);
  applyAction(state, { type: 'conquer', point: P }, fixedDice([]));
  assert.equal(state.buildings[P].owner, 0);
});

test('conquer: grey buildings can be taken, own buildings cannot', () => {
  const state = setup(2, rich);
  state.buildings[P] = { type: 'castle', owner: null };
  for (const c of AROUND_P) put(state, c, [1, 0]);
  applyAction(state, { type: 'conquer', point: P }, fixedDice([]));
  assert.equal(state.buildings[P].owner, 0);
  assert.equal(checkAction(state, { type: 'conquer', point: P }), 'error.own-building');
});

// ---- Trade ----

test('port trade: 2 port goods for 1 gold', () => {
  const state = setup(2, rich);
  state.buildings[3] = { type: 'port', owner: 0 }; // (0,3): touches cells 2 and 3
  const goods = portGoods(state, 3);
  assert.deepEqual([...goods].sort(), [...new Set([state.cells[2].resource, state.cells[3].resource])].sort());
  const good = goods[0];
  const other = RESOURCES.find((r) => !goods.includes(r)) ?? '';
  assert.equal(checkAction(state, { type: 'port-trade', point: 3, pay: { [other]: 2 } }), 'error.bad-goods');
  assert.equal(checkAction(state, { type: 'port-trade', point: 3, pay: { [good]: 1 } }), 'error.bad-goods');
  applyAction(state, { type: 'port-trade', point: 3, pay: { [good]: 2 } }, fixedDice([]));
  assert.equal(state.players[0].resources.gold, 1);
});

test('missing cards are paid with gold automatically', () => {
  const state = setup(2, { wood: 0, stone: 1, gold: 1 });
  put(state, 14, [1, 0]);
  put(state, 15, [1, 0]);
  const r = applyAction(state, { type: 'build-settlement', point: P }, fixedDice([]));
  assert.equal(r.goldUsed, 1);
  assert.deepEqual([state.players[0].resources.wood, state.players[0].resources.stone, state.players[0].resources.gold], [0, 0, 0]);
  state.players[0].resources.grain = 0;
  assert.equal(checkAction(state, { type: 'move', from: 14, to: 13 }), 'error.cannot-pay', 'no gold left');
});

test('gold exchange: 1 gold for 1 resource of your choice', () => {
  const state = setup(2, { gold: 1, iron: 0 });
  applyAction(state, { type: 'exchange-gold', resource: 'iron' }, fixedDice([]));
  assert.equal(state.players[0].resources.iron, 1);
  assert.equal(checkAction(state, { type: 'exchange-gold', resource: 'iron' }), 'error.no-gold');
});

// ---- Towers, elimination and victory ----

test('elimination: no troops, tower full of one enemy -> the enemy takes the tower and wins', () => {
  const state = setup(2, rich);
  put(state, BASE_CELLS[0], [0, 8]);
  put(state, 14, [0, 1]);
  state.buildings[P] = { type: 'settlement', owner: 0 };
  state.current = 0;
  const start = startTurn(state);
  assert.deepEqual(start.eliminated, [0]);
  assert.equal(state.cells[BASE_CELLS[0]].towerOwner, 1);
  assert.equal(state.buildings[P].owner, null, 'buildings of the eliminated player turn grey');
  assert.equal(state.winner, 1);
  assert.equal(state.phase, 'over');
});

test('elimination is skipped while the player can still recruit next to a castle', () => {
  const state = setup(2, { iron: 1, grain: 1 });
  put(state, BASE_CELLS[0], [0, 8]);
  state.buildings[P] = { type: 'castle', owner: 0 };
  state.current = 0;
  assert.deepEqual(startTurn(state).eliminated, []);
});

test('elimination with mixed enemies leaves a grey tower; a single player then claims it with any number', () => {
  const state = setup(3, rich);
  put(state, BASE_CELLS[0], [0, 5, 3]);
  put(state, 14, [0, 1, 1]);
  state.current = 0;
  const start = startTurn(state);
  assert.deepEqual(start.eliminated, [0]);
  assert.equal(start.player, 1);
  assert.equal(state.cells[BASE_CELLS[0]].towerOwner, null);
  // Player 1 (active) kills player 2's troops inside the grey tower: the tower becomes theirs.
  state.phase = 'actions';
  const r = applyAction(state, { type: 'attack', from: BASE_CELLS[0], target: BASE_CELLS[0], defender: 2, count: 5 }, fixedDice([1, 1]));
  assert.deepEqual(r.claimed, [{ cell: BASE_CELLS[0], player: 1 }]);
});

test('end turn passes to the next player still in the game', () => {
  const state = setup(3, rich);
  state.players[1].eliminated = true;
  put(state, BASE_CELLS[1], [0, 0, 0]);
  put(state, BASE_CELLS[2], [0, 0, 2]);
  state.current = 0;
  endTurn(state);
  assert.equal(state.current, 2);
  assert.equal(state.turn, 2);
});
