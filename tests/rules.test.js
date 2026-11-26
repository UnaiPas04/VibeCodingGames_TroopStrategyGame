// Tests for the trial rules (docs/trial-rules.md): board, setup, production, roads, buildings and turns.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOARD, COSTS, GOLD, PRODUCTION, RESOURCES } from '../source/src/config.js';
import { createRng } from '../source/src/core/rng.js';
import { applyAction, checkAction, portGoods } from '../source/src/systems/actions.js';
import {
  CELL_COUNT,
  EDGE_COUNT,
  GOLD_CELLS,
  POINT_COUNT,
  edgeBetween,
  edgeEnds,
  generateCells,
  pointCells,
  pointEdges,
  pointKind,
  quadrantOf
} from '../source/src/systems/board.js';
import { createState } from '../source/src/systems/state.js';
import { endTurn, newGame, placeStart, produce, rollDice } from '../source/src/systems/turn.js';

// Board layout used below (6 x 6): cell id = row * 6 + col; intersection id = row * 7 + col.
// Inner intersection 24 = (3,3) touches cells 14, 15, 20, 21. Its neighbors: 17 (up), 25 (right), 31 (down), 23 (left).
// Coast intersection 3 = (0,3) touches cells 2 and 3. Corner intersection 0 touches cell 0.
const P = 24;

/** Fake rng with fixed dice values. @param {number[]} dice */
const fixedDice = (dice) => ({ int: () => /** @type {number} */ (dice.shift()), shuffle: (/** @type {any[]} */ l) => [...l] });

/** A state in the actions phase with no buildings and the given resources for every player. */
function setup(playerCount = 2, resources = {}) {
  const state = createState(createRng(1), playerCount);
  for (const p of state.players) Object.assign(p.resources, resources);
  state.phase = 'actions';
  state.turn = 1;
  return state;
}

const road = (/** @type {number} */ a, /** @type {number} */ b) => /** @type {number} */ (edgeBetween(a, b));

test('board: gold cells in place, every cell numbered, balanced quadrants with one extra number each', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const cells = generateCells(createRng(seed));
    assert.equal(cells.length, CELL_COUNT);
    for (const id of GOLD_CELLS) assert.deepEqual([cells[id].kind, cells[id].resource], ['gold', GOLD]);
    /** @type {number[]} */
    const extras = [];
    for (let q = 0; q < 4; q++) {
      const quadrant = cells.filter((c) => quadrantOf(c.id) === q);
      const numbers = quadrant.map((c) => c.number).sort((a, b) => a - b);
      const extra = [...numbers];
      for (const n of BOARD.numbers) extra.splice(extra.indexOf(n), 1);
      assert.equal(extra.length, 1, 'each number once plus one extra');
      extras.push(extra[0]);
      for (const r of RESOURCES) assert.equal(quadrant.filter((c) => c.resource === r).length, 2, `quadrant ${q}: two ${r}`);
    }
    assert.deepEqual(extras.sort((a, b) => a - b), [...BOARD.extraNumbers].sort((a, b) => a - b), 'a different extra number per quadrant');
  }
});

test('edges: ends and lookup agree; 4 edges inside, 3 on the coast, 2 at a corner', () => {
  assert.equal(EDGE_COUNT, 84);
  for (let e = 0; e < EDGE_COUNT; e++) {
    const [a, b] = edgeEnds(e);
    assert.equal(edgeBetween(a, b), e);
    assert.equal(edgeBetween(b, a), e);
  }
  assert.equal(edgeBetween(0, 8), null, 'diagonal points are not joined');
  assert.equal(pointEdges(P).length, 4);
  assert.equal(pointEdges(3).length, 3);
  assert.equal(pointEdges(0).length, 2);
  assert.deepEqual(pointCells(P), [14, 15, 20, 21]);
  assert.equal(POINT_COUNT, 49);
});

test('setup: each player places a free castle (inside) or port (coast or corner), then turn 1 starts', () => {
  const state = newGame(createRng(2), 3);
  assert.equal(state.phase, 'setup');
  assert.equal(checkAction(state, { type: 'build-road', edge: 0 }), 'error.place-start-first');
  assert.equal(placeStart(state, P).building, 'castle');
  assert.equal(state.current, 1);
  assert.throws(() => placeStart(state, P), /point-taken/);
  assert.equal(placeStart(state, 3).building, 'port');
  const last = placeStart(state, 0);
  assert.equal(last.building, 'port');
  assert.equal(last.setupDone, true);
  assert.deepEqual([state.phase, state.current, state.turn], ['roll', 0, 1]);
  assert.deepEqual(state.players[0].resources, { wood: 0, stone: 0, grain: 0, iron: 0, gold: 0 }, 'the start building is free');
  assert.equal(checkAction(state, { type: 'place-start', point: 10 }), 'error.invalid-target', 'no more free buildings');
});

test('production: each building on a corner of the rolled cell collects (settlement 1, castle 2, port 2), and they add up', () => {
  const state = setup(2);
  state.cells.forEach((c) => (c.number = 3)); // nothing else produces
  state.cells[14].number = 9;
  state.cells[14].resource = 'wood';
  state.cells[14].kind = 'normal';
  // Cell 14 corners: 16, 17, 24, 23.
  state.buildings[16] = { type: 'castle', owner: 0 };
  state.buildings[17] = { type: 'settlement', owner: 0 };
  state.buildings[24] = { type: 'settlement', owner: 1 };
  const gains = produce(state, 9);
  assert.equal(state.players[0].resources.wood, PRODUCTION.castle + PRODUCTION.settlement);
  assert.equal(state.players[1].resources.wood, PRODUCTION.settlement);
  assert.equal(gains.length, 2);
  assert.equal(PRODUCTION.port, 2);
});

test('production: gold cells give gold; a roll produces only the cells with that number', () => {
  const state = setup(2);
  state.cells.forEach((c) => (c.number = 3));
  const gold = GOLD_CELLS[0]; // cell 7: corners 8, 9, 16, 15
  state.cells[gold].number = 10;
  state.buildings[8] = { type: 'castle', owner: 0 };
  state.phase = 'roll';
  const r = rollDice(state, fixedDice([1, 1, 4, 6])); // 2 is rolled again, then 10
  assert.deepEqual(r.rerolled, [2]);
  assert.equal(state.players[0].resources[GOLD], PRODUCTION.castle);
  assert.equal(state.players[0].resources.wood, 0);
});

test('roads: start at your building or your road, on a free side, paid with cards or gold', () => {
  const state = setup(2, { wood: 9 });
  state.buildings[P] = { type: 'castle', owner: 0 };
  state.buildings[10] = { type: 'castle', owner: 1 };
  assert.equal(checkAction(state, { type: 'build-road', edge: road(1, 2) }), 'error.road-not-connected');
  applyAction(state, { type: 'build-road', edge: road(P, 25) });
  assert.equal(state.roads[road(P, 25)], 0);
  assert.equal(state.players[0].resources.wood, 9 - COSTS.road.wood);
  assert.equal(checkAction(state, { type: 'build-road', edge: road(25, 26) }), null, 'it continues from your road');
  assert.equal(checkAction(state, { type: 'build-road', edge: road(P, 25) }), 'error.road-taken');
  assert.equal(checkAction(state, { type: 'build-road', edge: road(10, 11) }), 'error.road-not-connected', 'not from a rival building');
  state.roads[road(31, 38)] = 1;
  assert.equal(checkAction(state, { type: 'build-road', edge: road(38, 39) }), 'error.road-not-connected', 'not from a rival road');
  state.players[0].resources = { wood: 0, stone: 0, grain: 0, iron: 0, gold: COSTS.road.wood };
  const r = applyAction(state, { type: 'build-road', edge: road(25, 26) });
  assert.equal(r.goldUsed, COSTS.road.wood);
  assert.equal(checkAction(state, { type: 'build-road', edge: road(26, 27) }), 'error.cannot-pay');
});

test('settlements: on a free intersection touching your road', () => {
  const state = setup(2, { wood: 5, stone: 5 });
  state.buildings[P] = { type: 'castle', owner: 0 };
  assert.equal(checkAction(state, { type: 'build-settlement', point: 25 }), 'error.need-road');
  state.roads[road(P, 25)] = 0;
  state.roads[road(31, 32)] = 1;
  assert.equal(checkAction(state, { type: 'build-settlement', point: P }), 'error.point-taken');
  assert.equal(checkAction(state, { type: 'build-settlement', point: 32 }), 'error.need-road', 'a rival road does not count');
  applyAction(state, { type: 'build-settlement', point: 25 });
  assert.deepEqual(state.buildings[25], { type: 'settlement', owner: 0 });
  assert.deepEqual([state.players[0].resources.wood, state.players[0].resources.stone], [5 - COSTS.settlement.wood, 5 - COSTS.settlement.stone]);
});

test('moving a settlement: one step along any road to a free intersection; the road becomes yours', () => {
  const state = setup(2, { grain: 10 });
  state.buildings[P] = { type: 'settlement', owner: 0 };
  assert.equal(checkAction(state, { type: 'move-settlement', from: P, to: 25 }), 'error.need-road-there');
  state.roads[road(P, 25)] = 1; // a rival road
  state.buildings[31] = { type: 'castle', owner: 1 };
  state.roads[road(P, 31)] = 0;
  assert.equal(checkAction(state, { type: 'move-settlement', from: P, to: 31 }), 'error.point-taken');
  assert.equal(checkAction(state, { type: 'move-settlement', from: P, to: 26 }), 'error.not-neighbor');
  const r = applyAction(state, { type: 'move-settlement', from: P, to: 25 });
  assert.equal(r.previousRoadOwner, 1);
  assert.equal(state.roads[road(P, 25)], 0);
  assert.equal(state.buildings[P], undefined);
  assert.deepEqual(state.buildings[25], { type: 'settlement', owner: 0 });
  assert.equal(state.players[0].resources.grain, 10 - COSTS.moveSettlement.grain);
  state.buildings[31] = { type: 'castle', owner: 0 };
  state.roads[road(25, 32)] = 0;
  assert.equal(checkAction(state, { type: 'move-settlement', from: 31, to: 32 }), 'error.not-your-settlement', 'only settlements move');
});

test('promote: a settlement becomes a castle inside, a port on the coast', () => {
  const state = setup(2, { wood: 10, stone: 10 });
  state.buildings[P] = { type: 'settlement', owner: 0 };
  state.buildings[3] = { type: 'settlement', owner: 0 };
  state.buildings[4] = { type: 'settlement', owner: 1 };
  applyAction(state, { type: 'promote', point: P });
  applyAction(state, { type: 'promote', point: 3 });
  assert.equal(state.buildings[P].type, 'castle');
  assert.equal(state.buildings[3].type, 'port');
  assert.equal(state.players[0].resources.stone, 10 - COSTS.castle.stone - COSTS.port.stone);
  assert.equal(checkAction(state, { type: 'promote', point: 4 }), 'error.not-your-settlement');
  assert.equal(checkAction(state, { type: 'promote', point: P }), 'error.not-your-settlement', 'a castle is not promoted again');
});

test('ports trade 2 of their goods for 1 gold; gold buys any card', () => {
  const state = setup(2, { wood: 2, stone: 2 });
  state.cells[2].resource = 'wood';
  state.cells[3].resource = 'stone';
  state.buildings[3] = { type: 'port', owner: 0 };
  assert.deepEqual(portGoods(state, 3).sort(), ['stone', 'wood']);
  assert.equal(checkAction(state, { type: 'port-trade', point: 3, pay: { grain: 2 } }), 'error.bad-goods');
  applyAction(state, { type: 'port-trade', point: 3, pay: { wood: 1, stone: 1 } });
  assert.equal(state.players[0].resources[GOLD], 1);
  applyAction(state, { type: 'exchange-gold', resource: 'iron' });
  assert.deepEqual([state.players[0].resources[GOLD], state.players[0].resources.iron], [0, 1]);
});

test('turns: the next player rolls; the turn counter grows', () => {
  const state = setup(3);
  endTurn(state);
  assert.deepEqual([state.current, state.phase, state.turn, state.dice], [1, 'roll', 2, null]);
  assert.equal(checkAction(state, { type: 'build-road', edge: 0 }), 'error.roll-first');
  state.phase = 'actions';
  endTurn(state);
  state.phase = 'actions';
  endTurn(state);
  assert.equal(state.current, 0);
  assert.equal(pointKind(P), 'inner');
});
