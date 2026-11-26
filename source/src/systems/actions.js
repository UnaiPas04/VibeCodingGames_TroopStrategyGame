// Player actions (pure): validation and effects of every action.
// checkAction() returns null or an i18n error key; applyAction() applies a valid action and returns
// a result for the log. Missing resources are paid with gold, 1:1, automatically (except trades).
// Rules: docs/trial-rules.md; costs in config.js (COSTS).

import { COSTS, GOLD, MOVE, PORT_TRADE, RESOURCES, TROOPS } from '../config.js';
import {
  areNeighbors,
  cellCorners,
  cellDistance,
  edgeBetween,
  edgeEnds,
  isCell,
  isEdge,
  isPoint,
  pointCells,
  pointKind,
  pointNeighbors,
  pointsShareCell
} from './board.js';
import { buildingBonus, resolveFight } from './combat.js';
import {
  alivePlayers,
  buildingAt,
  buildingsOf,
  canPay,
  canPayWithGold,
  cellTouchesOwnRoad,
  emptyPurse,
  freeSlots,
  pay,
  payWithGold,
  roadAt,
  touchesOwnRoad,
  troopsOf
} from './state.js';

/**
 * @typedef {{type: 'place-start', point: number}
 *   | {type: 'build-road', edge: number}
 *   | {type: 'build-settlement', point: number}
 *   | {type: 'move-settlement', from: number, to: number}
 *   | {type: 'promote', point: number}
 *   | {type: 'port-trade', point: number, pay: Record<string, number>}
 *   | {type: 'exchange-gold', resource: string}
 *   | {type: 'recruit', cell: number}
 *   | {type: 'move', from: number, to: number, count: number}
 *   | {type: 'attack', from: number, target: number, defender: number, count: number}
 *   | {type: 'attack-building', from: number, target: number}} Action
 */

/** @typedef {import('./state.js').GameState} GameState */

/** What a big building at this intersection is: a port on the coast (and corners), a castle inside. */
export const bigBuildingAt = (/** @type {number} */ point) => /** @type {'castle' | 'port'} */ (pointKind(point) === 'inner' ? 'castle' : 'port');

/**
 * Grain to move some troops some cells: troops x cells x MOVE.grainPerTroopCell, rounded up.
 * @param {number} count
 * @param {number} cells
 * @returns {Record<string, number>}
 */
export function moveCost(count, cells) {
  return { grain: Math.ceil(count * cells * MOVE.grainPerTroopCell) };
}

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
    case 'recruit':
      return COSTS.recruit;
    case 'move':
      return moveCost(action.count, isCell(action.from) && isCell(action.to) ? cellDistance(action.from, action.to) : 0);
    case 'attack':
      return COSTS.attack;
    case 'attack-building':
      return COSTS.attackBuilding;
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

/** True if one of the player's castles stands on a corner of the cell (they can recruit there). */
export const touchesOwnCastle = (/** @type {GameState} */ state, /** @type {number} */ player, /** @type {number} */ cell) =>
  cellCorners(cell).some((p) => state.buildings[p]?.type === 'castle' && state.buildings[p].owner === player);

/**
 * Troops a move of `wanted` troops actually carries: no more than the source has or the destination fits.
 * @param {GameState} state
 * @param {number} wanted
 * @param {number} from
 * @param {number} to
 */
export function fittingCount(state, wanted, from, to) {
  return Math.max(0, Math.min(wanted, troopsOf(state, from, state.current), freeSlots(state, to)));
}

/** Building bonuses of both sides in a troop fight: their own buildings on the 4 corners of the attacked cell. */
export function attackBonuses(/** @type {GameState} */ state, /** @type {number} */ target, /** @type {number} */ defender) {
  const points = cellCorners(target);
  return { attackerBonus: buildingBonus(state.buildings, state.current, points), defenderBonus: buildingBonus(state.buildings, defender, points) };
}

/**
 * Strength of both sides in a building attack, without the dice: each building's bonus, plus 1 for
 * every cell around the attacked building where that side has more troops than the other.
 * @param {GameState} state
 * @param {number} from Attacking building.
 * @param {number} target Attacked building.
 */
export function buildingFight(state, from, target) {
  const attacker = state.current;
  const defender = state.buildings[target].owner;
  let attackerSupport = 0;
  let defenderSupport = 0;
  for (const cell of pointCells(target)) {
    const mine = troopsOf(state, cell, attacker);
    const theirs = troopsOf(state, cell, defender);
    if (mine > theirs) attackerSupport++;
    else if (theirs > mine) defenderSupport++;
  }
  return {
    defender,
    attackerBonus: buildingBonus(state.buildings, attacker, [from]),
    defenderBonus: buildingBonus(state.buildings, defender, [target]),
    attackerSupport,
    defenderSupport
  };
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
    case 'recruit':
      if (!isCell(action.cell)) return 'error.invalid-target';
      if (!touchesOwnCastle(state, me, action.cell)) return 'error.no-castle';
      if (freeSlots(state, action.cell) < 1) return 'error.cell-full';
      return affordable();
    case 'move': {
      if (!isCell(action.from) || !isCell(action.to) || action.from === action.to) return 'error.invalid-target';
      if (cellDistance(action.from, action.to) > MOVE.maxCells) return 'error.too-far';
      if (!isCount(action.count)) return 'error.bad-count';
      if (troopsOf(state, action.from, me) < action.count) return 'error.not-enough-troops';
      if (!cellTouchesOwnRoad(state, me, action.to)) return 'error.move-needs-road';
      if (freeSlots(state, action.to) < action.count) return 'error.cell-full';
      return affordable();
    }
    case 'attack': {
      const { from, target, defender, count } = action;
      if (!isCell(from) || !isCell(target)) return 'error.invalid-target';
      if (!areNeighbors(from, target)) return 'error.not-neighbor';
      if (!Number.isInteger(defender) || defender === me || !state.players[defender] || troopsOf(state, target, defender) < 1) {
        return 'error.no-defender';
      }
      if (!isCount(count) || count > troopsOf(state, from, me)) return 'error.not-enough-troops';
      return affordable();
    }
    case 'attack-building': {
      if (!isPoint(action.from) || !isPoint(action.target)) return 'error.invalid-target';
      if (buildingAt(state, action.from)?.owner !== me) return 'error.not-your-building';
      const target = buildingAt(state, action.target);
      if (!target || target.owner === me) return 'error.no-rival-building';
      if (!pointsShareCell(action.from, action.target)) return 'error.building-too-far';
      return affordable();
    }
    default:
      return 'error.unknown-action';
  }
}

/**
 * Apply a valid action for the active player. Throws if the action is not valid.
 * The setup placement does not pass the turn: placeStart in turn.js does.
 * @param {GameState} state
 * @param {Action} action
 * @param {{int: (min: number, max: number) => number}} [rng] Dice for the fights.
 * @returns {Record<string, any>} What happened, for the log and sounds. Always has `type`, `player`, `goldUsed` and `eliminated`.
 */
export function applyAction(state, action, rng) {
  const error = checkAction(state, action);
  if (error) throw new Error(`Invalid action ${JSON.stringify(action)}: ${error}`);
  const me = state.current;
  const purse = state.players[me].resources;
  const trade = action.type === 'port-trade' || action.type === 'exchange-gold';
  const goldUsed = trade ? 0 : payWithGold(purse, costOf(action));
  const dice = () => {
    if (!rng) throw new Error(`${action.type} needs dice`);
    return rng;
  };

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
    case 'recruit': {
      const count = Math.min(TROOPS.recruitBatch, freeSlots(state, action.cell));
      state.cells[action.cell].troops[me] += count;
      result = { cell: action.cell, count };
      break;
    }
    case 'move':
      state.cells[action.from].troops[me] -= action.count;
      state.cells[action.to].troops[me] += action.count;
      result = { from: action.from, to: action.to, count: action.count, cells: cellDistance(action.from, action.to) };
      break;
    case 'attack':
      result = troopFight(state, action, dice());
      break;
    case 'attack-building':
      result = buildingAttack(state, action, dice());
      break;
  }
  return { type: action.type, player: me, goldUsed, ...result, eliminated: eliminateBeaten(state) };
}

/**
 * Troops attack a neighboring cell. Each side: troops + buildings on the attacked cell's corners + a die;
 * the defender wins ties. A win kills the defender's troops there and moves the attackers in;
 * a loss kills the attackers.
 * @param {GameState} state
 * @param {Extract<Action, {type: 'attack'}>} action
 * @param {{int: (min: number, max: number) => number}} rng
 */
function troopFight(state, { from, target, defender, count }, rng) {
  const me = state.current;
  const defenderTroops = troopsOf(state, target, defender);
  const fight = {
    attackerTroops: count,
    defenderTroops,
    ...attackBonuses(state, target, defender),
    attackerDie: rng.int(1, 6),
    defenderDie: rng.int(1, 6)
  };
  const outcome = resolveFight(fight);
  let moved = 0;
  if (outcome.attackerWins) {
    state.cells[target].troops[defender] = 0;
    moved = Math.min(count, freeSlots(state, target));
    state.cells[from].troops[me] -= moved;
    state.cells[target].troops[me] += moved;
  } else {
    state.cells[from].troops[me] -= count;
  }
  return { from, target, defender, ...fight, ...outcome, moved, attackerLost: outcome.attackerWins ? 0 : count, defenderLost: outcome.attackerWins ? defenderTroops : 0 };
}

/**
 * A building attacks a nearby rival building (they share a cell). Each side: its building's bonus +
 * troop support (see buildingFight) + a die; the defender wins ties. A win topples the attacked
 * building: a castle or port becomes a settlement, a settlement is destroyed.
 * @param {GameState} state
 * @param {Extract<Action, {type: 'attack-building'}>} action
 * @param {{int: (min: number, max: number) => number}} rng
 */
function buildingAttack(state, { from, target }, rng) {
  const f = buildingFight(state, from, target);
  const outcome = resolveFight({
    attackerTroops: f.attackerSupport,
    attackerBonus: f.attackerBonus,
    defenderTroops: f.defenderSupport,
    defenderBonus: f.defenderBonus,
    attackerDie: rng.int(1, 6),
    defenderDie: rng.int(1, 6)
  });
  const building = state.buildings[target].type;
  let toppled = null;
  if (outcome.attackerWins) {
    if (building === 'settlement') delete state.buildings[target];
    else state.buildings[target].type = 'settlement';
    toppled = building;
  }
  return { from, target, ...f, ...outcome, building, toppled };
}

/**
 * Players who have no building left are out: their troops, roads and cards go. When one player is
 * left with buildings, they win.
 * @param {GameState} state
 * @returns {number[]} Players eliminated now.
 */
export function eliminateBeaten(state) {
  if (state.phase === 'setup') return [];
  /** @type {number[]} */
  const out = [];
  for (const p of state.players) {
    if (p.eliminated || buildingsOf(state, p.id).length > 0) continue;
    p.eliminated = true;
    p.resources = emptyPurse();
    for (const cell of state.cells) cell.troops[p.id] = 0;
    for (const [edge, owner] of Object.entries(state.roads)) if (owner === p.id) delete state.roads[Number(edge)];
    out.push(p.id);
  }
  const alive = alivePlayers(state);
  if (alive.length <= 1) {
    state.phase = 'over';
    state.winner = alive[0] ?? null;
  }
  return out;
}
