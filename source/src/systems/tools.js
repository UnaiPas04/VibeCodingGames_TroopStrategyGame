// Board tools (pure): how each panel tool turns clicks on the board into actions.
// A tool picks a target (a cell or an intersection), sometimes after a source.
// Tools with a form (attack, trade) open it in the side panel before acting.

import { CELL_COUNT, POINT_COUNT } from './board.js';
import { checkAction, portTradeOptions } from './actions.js';
import { buildingAt, playersIn, troopsOf } from './state.js';

/**
 * @typedef {object} ToolOptions
 * @property {number} count Troops for the wagon group and the attack.
 * @property {number} [defender]
 * @property {Record<string, number>} [pay] Port trade goods.
 */

/**
 * @typedef {object} Tool
 * @property {'cell' | 'point'} target
 * @property {'troops' | 'settlement'} [source] What the first click must pick, if the tool needs a source.
 * @property {boolean} [form] Opens a form in the panel instead of acting at once.
 * @property {(source: number | null, target: number, options: ToolOptions) => import('./actions.js').Action} action
 */

/** @type {Record<string, Tool>} */
export const TOOLS = {
  move: { target: 'cell', source: 'troops', action: (s, t) => ({ type: 'move', from: /** @type {number} */ (s), to: t }) },
  'wagon-group': {
    target: 'cell',
    source: 'troops',
    action: (s, t, o) => ({ type: 'wagon-group', from: /** @type {number} */ (s), to: t, count: o.count })
  },
  'wagon-long': { target: 'cell', source: 'troops', action: (s, t) => ({ type: 'wagon-long', from: /** @type {number} */ (s), to: t }) },
  recruit: { target: 'cell', action: (_, t) => ({ type: 'recruit', cell: t }) },
  attack: {
    target: 'cell',
    source: 'troops',
    form: true,
    action: (s, t, o) => ({ type: 'attack', from: /** @type {number} */ (s), target: t, defender: o.defender ?? -1, count: o.count })
  },
  build: { target: 'point', action: (_, t) => ({ type: 'build-settlement', point: t }) },
  'move-settlement': {
    target: 'point',
    source: 'settlement',
    action: (s, t) => ({ type: 'move-settlement', from: /** @type {number} */ (s), to: t })
  },
  promote: { target: 'point', action: (_, t) => ({ type: 'promote', point: t }) },
  conquer: { target: 'point', action: (_, t) => ({ type: 'conquer', point: t }) },
  trade: { target: 'point', form: true, action: (_, t, o) => ({ type: 'port-trade', point: t, pay: o.pay ?? {} }) }
};

export const TOOL_IDS = Object.keys(TOOLS);

/** True if the id can be this tool's source for the active player. */
export function isValidSource(/** @type {import('./state.js').GameState} */ state, /** @type {string} */ toolId, /** @type {number} */ id) {
  const tool = TOOLS[toolId];
  if (tool.source === 'troops') return id >= 0 && id < CELL_COUNT && troopsOf(state, id, state.current) > 0;
  if (tool.source === 'settlement') {
    const b = buildingAt(state, id);
    return !!b && b.type === 'settlement' && b.owner === state.current;
  }
  return false;
}

/**
 * Enemies the active player could fight in a cell.
 * @param {import('./state.js').GameState} state
 * @param {number} cell
 */
export const enemiesIn = (state, cell) => playersIn(state, cell).filter((p) => p !== state.current);

/**
 * Check a click with this tool. Form tools are checked with their first valid form choice,
 * so the board can highlight every target that has at least one valid option.
 * @param {import('./state.js').GameState} state
 * @param {string} toolId
 * @param {number | null} source
 * @param {number} target
 * @param {ToolOptions} options
 * @returns {string | null} null if valid, otherwise an i18n error key.
 */
export function checkTarget(state, toolId, source, target, options) {
  const tool = TOOLS[toolId];
  if (toolId === 'attack') {
    const enemies = enemiesIn(state, target);
    if (enemies.length === 0) return 'error.no-defender';
    let error = null;
    for (const defender of enemies) {
      error = checkAction(state, tool.action(source, target, { count: 1, defender }));
      if (!error) return null;
    }
    return error;
  }
  if (toolId === 'trade') {
    const pays = portTradeOptions(state, target);
    if (pays.length === 0) return checkAction(state, tool.action(source, target, { count: 0, pay: {} }));
    let error = null;
    for (const pay of pays) {
      error = checkAction(state, tool.action(source, target, { count: 0, pay }));
      if (!error) return null;
    }
    return error;
  }
  return checkAction(state, tool.action(source, target, options));
}

/**
 * Every target id that a click would accept right now (for highlighting).
 * @param {import('./state.js').GameState} state
 * @param {string} toolId
 * @param {number | null} source
 * @param {ToolOptions} options
 */
export function validTargets(state, toolId, source, options) {
  const tool = TOOLS[toolId];
  if (tool.source && source === null) return [];
  const count = tool.target === 'cell' ? CELL_COUNT : POINT_COUNT;
  /** @type {number[]} */
  const out = [];
  for (let id = 0; id < count; id++) if (!checkTarget(state, toolId, source, id, options)) out.push(id);
  return out;
}
