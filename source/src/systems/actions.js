// Player actions (pure): validation and effects of every action.
// checkAction() returns null or an i18n error key; applyAction() applies a valid action and returns
// a result for the log. Missing resources are paid with gold, 1:1, automatically (except trades).
// Rules: docs/trial-rules.md; costs in config.js (COSTS).

import { COSTS, GOLD, PORT_TRADE, RESOURCES } from '../config.js';
import { edgeBetween, edgeEnds, isEdge, isPoint, pointCells, pointKind, pointNeighbors } from './board.js';
import { buildingAt, canPay, canPayWithGold, pay, payWithGold, roadAt, touchesOwnRoad } from './state.js';

/**
 * @typedef {{type: 'place-start', point: number}
 *   | {type: 'build-road', edge: number}
 *   | {type: 'build-settlement', point: number}
 *   | {type: 'move-settlement', from: number, to: number}
 *   | {type: 'promote', point: number}
 *   | {type: 'port-trade', point: number, pay: Record<string, number>}
 *   | {type: 'exchange-gold', resource: string}} Action
 */

/** @typedef {import('./state.js').GameState} GameState */

/** What a big building at this intersection is: a port on the coast (and corners), a castle inside. */
export const bigBuildingAt = (/** @type {number} */ point) => /** @type {'castle' | 'port'} */ (pointKind(point) === 'inner' ? 'castle' : 'port');

/**
 * Cost of an action (the start building is free; trades are paid with cards, not here).
 * @param {Action} action
 * @returns {Record<string, number>}
 */
export function costOf(action) {
  switch (action.type) {
    case 'build-road':
      return COSTS.road;
    case 'build-settlement':
      return COSTS.settlement;
    case 'move-settlement':
      return COSTS.moveSettlement;
    case 'promote':
      return isPoint(action.point) ? COSTS[bigBuildingAt(action.point)] : {};
    default:
      return {};
  }
}

/** Resources a port can trade: those of the normal cells it touches. */
export const portGoods = (/** @type {GameState} */ state, /** @type {number} */ point) =>
  [...new Set(pointCells(point).map((c) => state.cells[c].resource))].filter((r) => RESOURCES.includes(/** @type {any} */ (r)));

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

/** True if a road on the edge would connect: one of its ends has the player's building or road. */
function connectsRoad(/** @type {GameState} */ state, /** @type {number} */ player, /** @type {number} */ edge) {
  return edgeEnds(edge).some((p) => buildingAt(state, p)?.owner === player || touchesOwnRoad(state, player, p));
}

/**
 * Validate an action for the active player.
 * @param {GameState} state
 * @param {Action} action
 * @returns {string | null} null if valid, otherwise an i18n error key.
 */
export function checkAction(state, action) {
  if (state.phase === 'over') return 'error.game-over';
  if (action.type === 'place-start') {
    if (state.phase !== 'setup' || !isPoint(action.point)) return 'error.invalid-target';
    return buildingAt(state, action.point) ? 'error.point-taken' : null;
  }
  if (state.phase === 'setup') return 'error.place-start-first';
  if (state.phase !== 'actions') return 'error.roll-first';
  const me = state.current;
  const purse = state.players[me].resources;
  const affordable = () => (canPayWithGold(purse, costOf(action)) ? null : 'error.cannot-pay');

  switch (action.type) {
    case 'build-road':
      if (!isEdge(action.edge)) return 'error.invalid-target';
      if (roadAt(state, action.edge) !== undefined) return 'error.road-taken';
      if (!connectsRoad(state, me, action.edge)) return 'error.road-not-connected';
      return affordable();
    case 'build-settlement':
      if (!isPoint(action.point)) return 'error.invalid-target';
      if (buildingAt(state, action.point)) return 'error.point-taken';
      if (!touchesOwnRoad(state, me, action.point)) return 'error.need-road';
      return affordable();
    case 'move-settlement': {
      if (!isPoint(action.from) || !isPoint(action.to)) return 'error.invalid-target';
      const b = buildingAt(state, action.from);
      if (!b || b.type !== 'settlement' || b.owner !== me) return 'error.not-your-settlement';
      if (!pointNeighbors(action.from).includes(action.to)) return 'error.not-neighbor';
      if (roadAt(state, /** @type {number} */ (edgeBetween(action.from, action.to))) === undefined) return 'error.need-road-there';
      if (buildingAt(state, action.to)) return 'error.point-taken';
      return affordable();
    }
    case 'promote': {
      if (!isPoint(action.point)) return 'error.invalid-target';
      const b = buildingAt(state, action.point);
      if (!b || b.type !== 'settlement' || b.owner !== me) return 'error.not-your-settlement';
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
 * The setup placement does not pass the turn: placeStart in turn.js does.
 * @param {GameState} state
 * @param {Action} action
 * @returns {Record<string, any>} What happened, for the log and sounds. Always has `type`, `player` and `goldUsed`.
 */
export function applyAction(state, action) {
  const error = checkAction(state, action);
  if (error) throw new Error(`Invalid action ${JSON.stringify(action)}: ${error}`);
  const me = state.current;
  const purse = state.players[me].resources;
  const trade = action.type === 'port-trade' || action.type === 'exchange-gold';
  const goldUsed = trade ? 0 : payWithGold(purse, costOf(action));

  /** @type {Record<string, any>} */
  let result = {};
  switch (action.type) {
    case 'place-start': {
      const type = bigBuildingAt(action.point);
      state.buildings[action.point] = { type, owner: me };
      result = { point: action.point, building: type };
      break;
    }
    case 'build-road':
      state.roads[action.edge] = me;
      result = { edge: action.edge };
      break;
    case 'build-settlement':
      state.buildings[action.point] = { type: 'settlement', owner: me };
      result = { point: action.point };
      break;
    case 'move-settlement': {
      const edge = /** @type {number} */ (edgeBetween(action.from, action.to));
      const previousRoadOwner = state.roads[edge];
      state.buildings[action.to] = state.buildings[action.from];
      delete state.buildings[action.from];
      state.roads[edge] = me; // the road it travels along becomes the mover's
      result = { from: action.from, to: action.to, edge, previousRoadOwner };
      break;
    }
    case 'promote': {
      const to = bigBuildingAt(action.point);
      state.buildings[action.point].type = to;
      result = { point: action.point, building: to };
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
  return { type: action.type, player: me, goldUsed, ...result };
}
