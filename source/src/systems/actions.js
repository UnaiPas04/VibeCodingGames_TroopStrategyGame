// Player actions (pure): validation and effects of every action bought during the actions phase.
// checkAction() returns null or an i18n error key; applyAction() applies a valid action and returns
// a result for the log. Missing resources are paid with gold, 1:1, automatically (except port trades). Trial rules T2, T4-T8; costs in config.js (COSTS).

import { CONQUER_SETTLEMENT_INNER, COSTS, GOLD, PORT_TRADE, RESOURCES, WAGON } from '../config.js';
import { areNeighbors, cellCorners, cellDistance, isCell, isPoint, neighborPairsAt, pointCells, pointKind, pointNeighbors, sharedSideEnds } from './board.js';
import { buildingBonus, resolveFight } from './combat.js';
import { buildingAt, canPay, canPayWithGold, freeSlots, heldCellsAround, holds, pay, payWithGold, touchesOwnCastle, troopsOf } from './state.js';
import { claimGreyTowers } from './towers.js';

/**
 * @typedef {{type: 'move', from: number, to: number}
 *   | {type: 'wagon-group', from: number, to: number, count: number}
 *   | {type: 'wagon-long', from: number, to: number}
 *   | {type: 'recruit', cell: number}
 *   | {type: 'attack', from: number, target: number, defender: number, count: number}
 *   | {type: 'build-settlement', point: number}
 *   | {type: 'move-settlement', from: number, to: number}
 *   | {type: 'promote', point: number}
 *   | {type: 'conquer', point: number}
 *   | {type: 'port-trade', point: number, pay: Record<string, number>}
 *   | {type: 'exchange-gold', resource: string}} Action
 */

/** @typedef {import('./state.js').GameState} GameState */

/**
 * Cost of an action in its current context (attack inside/outside, promotion to castle/port).
 * @param {GameState} state
 * @param {Action} action
 * @returns {Record<string, number>}
 */
export function costOf(state, action) {
  switch (action.type) {
    case 'move':
      return COSTS.move;
    case 'wagon-group':
    case 'wagon-long':
      return COSTS.wagon;
    case 'recruit':
      return COSTS.recruit;
    case 'attack':
      return action.from === action.target ? COSTS.attackInside : COSTS.attackOutside;
    case 'build-settlement':
      return COSTS.settlement;
    case 'move-settlement':
      return COSTS.moveSettlement;
    case 'promote':
      return isPoint(action.point) && pointKind(action.point) === 'coast' ? COSTS.port : COSTS.castle;
    case 'conquer':
      return COSTS.conquer;
    default:
      return {};
  }
}

/** Resources a port can trade: those of the normal cells it touches. */
export const portGoods = (/** @type {GameState} */ state, /** @type {number} */ point) =>
  /** @type {string[]} */ ([...new Set(pointCells(point).map((c) => state.cells[c].resource))].filter((r) => r !== null && RESOURCES.includes(/** @type {any} */ (r))));

/**
 * Every way to pay a port trade with the port's goods (e.g. 2 wood, 2 stone, 1 wood + 1 stone).
 * @param {GameState} state
 * @param {number} point
 * @returns {Record<string, number>[]}
 */
export function portTradeOptions(state, point) {
  const goods = portGoods(state, point);
  /** @type {Record<string, number>[]} */
  const options = [];
  /** @param {number} index @param {number} left @param {Record<string, number>} acc */
  const walk = (index, left, acc) => {
    if (index === goods.length - 1) {
      options.push({ ...acc, [goods[index]]: left });
      return;
    }
    for (let n = left; n >= 0; n--) walk(index + 1, left - n, n > 0 ? { ...acc, [goods[index]]: n } : acc);
  };
  if (goods.length > 0) walk(0, PORT_TRADE.give, {});
  return options.map((o) => Object.fromEntries(Object.entries(o).filter(([, n]) => n > 0)));
}

/** True if the player meets the conquest condition of the building at this intersection (T7). */
export function meetsConquerCondition(/** @type {GameState} */ state, /** @type {number} */ player, /** @type {number} */ point) {
  const building = buildingAt(state, point);
  if (!building) return false;
  const held = heldCellsAround(state, player, point);
  const touching = pointCells(point).length;
  if (building.type === 'settlement' && touching === 4) return held >= CONQUER_SETTLEMENT_INNER;
  return held === touching;
}

/** @param {unknown} n */
const isCount = (n) => Number.isInteger(n) && /** @type {number} */ (n) >= 1;

/**
 * Validate an action for the active player.
 * @param {GameState} state
 * @param {Action} action
 * @returns {string | null} null if valid, otherwise an i18n error key.
 */
export function checkAction(state, action) {
  if (state.phase === 'over') return 'error.game-over';
  if (state.phase !== 'actions') return 'error.roll-first';
  const me = state.current;
  const purse = state.players[me].resources;
  const affordable = () => (canPayWithGold(purse, costOf(state, action)) ? null : 'error.cannot-pay');

  switch (action.type) {
    case 'move':
    case 'wagon-group':
    case 'wagon-long': {
      if (!isCell(action.from) || !isCell(action.to) || action.from === action.to) return 'error.invalid-target';
      const count = action.type === 'wagon-group' ? action.count : 1;
      if (!isCount(count) || count > WAGON.groupSize) return 'error.bad-count';
      if (action.type === 'wagon-long') {
        if (cellDistance(action.from, action.to) > WAGON.range) return 'error.too-far';
      } else if (!areNeighbors(action.from, action.to)) return 'error.not-neighbor';
      if (troopsOf(state, action.from, me) < count) return 'error.not-enough-troops';
      if (freeSlots(state, action.to) < count) return 'error.cell-full';
      return affordable();
    }
    case 'recruit':
      if (!isCell(action.cell)) return 'error.invalid-target';
      if (!touchesOwnCastle(state, me, action.cell)) return 'error.no-castle';
      if (freeSlots(state, action.cell) < 1) return 'error.cell-full';
      return affordable();
    case 'attack': {
      const { from, target, defender, count } = action;
      if (!isCell(from) || !isCell(target)) return 'error.invalid-target';
      if (!Number.isInteger(defender) || defender === me || !state.players[defender] || troopsOf(state, target, defender) < 1) {
        return 'error.no-defender';
      }
      if (from !== target) {
        if (!areNeighbors(from, target)) return 'error.not-neighbor';
        if (!holds(state, me, from)) return 'error.not-held';
      }
      if (!isCount(count) || count > troopsOf(state, from, me)) return 'error.not-enough-troops';
      return affordable();
    }
    case 'build-settlement': {
      if (!isPoint(action.point)) return 'error.invalid-target';
      if (buildingAt(state, action.point)) return 'error.point-taken';
      const ok = neighborPairsAt(action.point).some(([a, b]) => holds(state, me, a) && holds(state, me, b));
      if (!ok) return 'error.need-two-held';
      return affordable();
    }
    case 'move-settlement': {
      if (!isPoint(action.from) || !isPoint(action.to)) return 'error.invalid-target';
      const b = buildingAt(state, action.from);
      if (!b || b.type !== 'settlement' || b.owner !== me) return 'error.not-your-settlement';
      if (!pointNeighbors(action.from).includes(action.to)) return 'error.not-neighbor';
      if (buildingAt(state, action.to)) return 'error.point-taken';
      return affordable();
    }
    case 'promote': {
      if (!isPoint(action.point)) return 'error.invalid-target';
      const b = buildingAt(state, action.point);
      if (!b || b.type !== 'settlement' || b.owner !== me) return 'error.not-your-settlement';
      if (pointKind(action.point) === 'corner') return 'error.cannot-promote-corner';
      if (heldCellsAround(state, me, action.point) < pointCells(action.point).length) return 'error.need-all-held';
      return affordable();
    }
    case 'conquer': {
      if (!isPoint(action.point)) return 'error.invalid-target';
      const b = buildingAt(state, action.point);
      if (!b) return 'error.no-building';
      if (b.owner === me) return 'error.own-building';
      if (!meetsConquerCondition(state, me, action.point)) return 'error.conquer-condition';
      return affordable();
    }
    case 'port-trade': {
      if (!isPoint(action.point)) return 'error.invalid-target';
      const b = buildingAt(state, action.point);
      if (!b || b.type !== 'port' || b.owner !== me) return 'error.not-your-port';
      const goods = portGoods(state, action.point);
      const entries = Object.entries(action.pay ?? {});
      const total = entries.reduce((sum, [, n]) => sum + n, 0);
      const valid = entries.every(([r, n]) => goods.includes(r) && Number.isInteger(n) && n >= 0);
      if (!valid || total !== PORT_TRADE.give) return 'error.bad-goods';
      return canPay(purse, action.pay) ? null : 'error.cannot-pay';
    }
    case 'exchange-gold':
      if (!RESOURCES.includes(/** @type {any} */ (action.resource))) return 'error.invalid-target';
      return purse[GOLD] >= 1 ? null : 'error.no-gold';
    default:
      return 'error.unknown-action';
  }
}

/**
 * Apply a valid action for the active player. Throws if the action is not valid.
 * @param {GameState} state
 * @param {Action} action
 * @param {{int: (min: number, max: number) => number}} rng Used by attacks.
 * @returns {Record<string, any>} What happened, for the log and sounds. Always has `type`, `goldUsed` and `claimed` (grey towers taken).
 */
export function applyAction(state, action, rng) {
  const error = checkAction(state, action);
  if (error) throw new Error(`Invalid action ${JSON.stringify(action)}: ${error}`);
  const me = state.current;
  const purse = state.players[me].resources;
  const goldUsed = action.type === 'port-trade' || action.type === 'exchange-gold' ? 0 : payWithGold(purse, costOf(state, action));

  /** @type {Record<string, any>} */
  let result;
  switch (action.type) {
    case 'move':
    case 'wagon-group':
    case 'wagon-long': {
      const count = action.type === 'wagon-group' ? action.count : 1;
      state.cells[action.from].troops[me] -= count;
      state.cells[action.to].troops[me] += count;
      result = { from: action.from, to: action.to, count };
      break;
    }
    case 'recruit':
      state.cells[action.cell].troops[me] += 1;
      result = { cell: action.cell };
      break;
    case 'attack':
      result = attack(state, action, rng);
      break;
    case 'build-settlement':
      state.buildings[action.point] = { type: 'settlement', owner: me };
      result = { point: action.point };
      break;
    case 'move-settlement':
      state.buildings[action.to] = state.buildings[action.from];
      delete state.buildings[action.from];
      result = { from: action.from, to: action.to };
      break;
    case 'promote': {
      const to = pointKind(action.point) === 'coast' ? 'port' : 'castle';
      state.buildings[action.point].type = to;
      result = { point: action.point, building: to };
      break;
    }
    case 'conquer': {
      const b = state.buildings[action.point];
      result = { point: action.point, building: b.type, previousOwner: b.owner };
      b.owner = me;
      break;
    }
    case 'port-trade':
      pay(purse, action.pay);
      purse[GOLD] += PORT_TRADE.gold;
      result = { point: action.point, paid: action.pay, gold: PORT_TRADE.gold };
      break;
    case 'exchange-gold':
      purse[GOLD] -= 1;
      purse[action.resource] += 1;
      result = { resource: action.resource };
      break;
  }
  return { type: action.type, player: me, goldUsed, ...result, claimed: claimGreyTowers(state) };
}

/**
 * Building bonuses of both sides: the 4 corners of the cell (inside), or the 2 ends of the shared side (outside).
 * @param {GameState} state
 * @param {number} from
 * @param {number} target
 * @param {number} defender
 */
export function attackBonuses(state, from, target, defender) {
  const points = from === target ? cellCorners(target) : sharedSideEnds(from, target);
  return { attackerBonus: buildingBonus(state.buildings, state.current, points), defenderBonus: buildingBonus(state.buildings, defender, points) };
}

/**
 * @param {GameState} state
 * @param {Extract<Action, {type: 'attack'}>} action
 * @param {{int: (min: number, max: number) => number}} rng
 */
function attack(state, { from, target, defender, count }, rng) {
  const me = state.current;
  const inside = from === target;
  const defenderTroops = troopsOf(state, target, defender);
  const fight = {
    attackerTroops: count,
    defenderTroops,
    ...attackBonuses(state, from, target, defender),
    attackerDie: rng.int(1, 6),
    defenderDie: rng.int(1, 6)
  };
  const outcome = resolveFight(fight);
  if (outcome.attackerWins) state.cells[target].troops[defender] = 0;
  else state.cells[from].troops[me] -= count;
  return {
    from,
    target,
    defender,
    inside,
    ...fight,
    ...outcome,
    attackerLost: outcome.attackerWins ? 0 : count,
    defenderLost: outcome.attackerWins ? defenderTroops : 0
  };
}
