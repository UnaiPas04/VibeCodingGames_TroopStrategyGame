// Side panel (HTML): active player, dice, resources, tools, the current form, players and log.
// It only renders; its buttons use data-action and are handled by the play scene through game.actions.

import { BOARD_VIEW, COSTS, GOLD, PLAYERS, PORT_TRADE, RESOURCES } from '../config.js';
import { winChance } from '../systems/combat.js';
import { towersOf, troopsOnBoard } from '../systems/state.js';
import { TOOL_IDS } from '../systems/tools.js';

/** i18n keys of the player names, by player index (same order as PLAYERS.colors). */
const PLAYER_KEYS = ['player.red', 'player.blue', 'player.green', 'player.yellow'];

/** @type {Record<string, string>} */
const RESOURCE_KEYS = {
  wood: 'resource.wood',
  stone: 'resource.stone',
  grain: 'resource.grain',
  iron: 'resource.iron',
  gold: 'resource.gold'
};

/** Cost entries shown on each tool button (several when the cost depends on the target). */
/** @type {Record<string, string[]>} */
const TOOL_COSTS = {
  move: ['move'],
  'wagon-group': ['wagon'],
  'wagon-long': ['wagon'],
  recruit: ['recruit'],
  attack: ['attackInside', 'attackOutside'],
  build: ['settlement'],
  'move-settlement': ['moveSettlement'],
  promote: ['castle', 'port'],
  conquer: ['conquer'],
  trade: []
};

/** @typedef {(key: string, params?: Record<string, string | number>) => string} Translate */
/** @typedef {{key: string, params?: Record<string, any>}} Message */

/**
 * @typedef {object} PanelModel
 * @property {import('../systems/state.js').GameState} state
 * @property {string | null} tool
 * @property {number | null} source
 * @property {number} count
 * @property {null | {kind: 'attack', from: number, target: number, defender: number, enemies: number[], max: number, attackerBonus: number, defenderBonus: number} | {kind: 'trade', point: number, options: {pay: Record<string, number>, ok: boolean}[]}} form
 * @property {number | null} selectedCell
 * @property {Message | null} message
 * @property {Message[]} log
 * @property {number} countMax Upper limit of the count stepper for the current tool.
 */

const esc = (/** @type {unknown} */ s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** @param {Translate} t @param {number | null} player */
export const playerName = (t, player) => (player === null ? t('player.grey') : t(PLAYER_KEYS[player]));

/** @param {Translate} t @param {string} resource */
export const resourceName = (t, resource) => t(RESOURCE_KEYS[resource]);

/** "1 Iron + 1 Grain" @param {Translate} t @param {Partial<Record<string, number>>} cost */
export function costText(t, cost) {
  const parts = Object.entries(cost)
    .filter(([, n]) => n)
    .map(([r, n]) => `${n} ${resourceName(t, r)}`);
  return parts.length ? parts.join(' + ') : t('cost.free');
}

/**
 * Translate a log or hint message, turning player indexes and resource names into words.
 * @param {Translate} t
 * @param {Message} message
 */
export function formatMessage(t, { key, params = {} }) {
  /** @type {Record<string, string | number>} */
  const out = {};
  for (const [name, value] of Object.entries(params)) {
    if (name === 'player' || name === 'defender' || name === 'owner') out[name] = playerName(t, value);
    else if (name === 'resource') out[name] = resourceName(t, value);
    else if (name === 'pay') out[name] = costText(t, value);
    else if (Array.isArray(value)) out[name] = value.join(', ');
    else out[name] = value;
  }
  return t(key, out);
}

/**
 * @param {HTMLElement} root
 * @param {PanelModel} model
 * @param {Translate} t
 */
export function renderPanel(root, model, t) {
  const { state } = model;
  const me = state.current;
  const purse = state.players[me].resources;
  const acting = state.phase === 'actions';
  const color = PLAYERS.colors[me];

  const dice = state.dice ? `${state.dice[0]} + ${state.dice[1]} = <b>${state.dice[0] + state.dice[1]}</b>` : '–';
  const primary = state.phase === 'roll' ? ['roll', 'action.roll'] : ['end-turn', 'action.end-turn'];

  const resources = [...RESOURCES, GOLD]
    .map((r) => `<span class="res" style="--res:${BOARD_VIEW.colors[/** @type {keyof typeof BOARD_VIEW.colors} */ (r)]}">${esc(resourceName(t, r))} <b>${purse[r]}</b></span>`)
    .join('');

  const exchange = RESOURCES.map(
    (r) =>
      `<button class="small" data-action="exchange" data-resource="${r}" ${acting && purse[GOLD] > 0 ? '' : 'disabled'}>${esc(resourceName(t, r))}</button>`
  ).join('');

  const tools = TOOL_IDS.map((id) => {
    const costs = id === 'trade' ? `${PORT_TRADE.give} → ${PORT_TRADE.gold} ${resourceName(t, GOLD)}` : TOOL_COSTS[id].map((k) => costText(t, COSTS[k])).join(' / ');
    return `<button class="tool" data-action="tool" data-tool="${id}" aria-pressed="${model.tool === id}" ${acting ? '' : 'disabled'}>
      <span>${esc(t(`tool.${id}`))}</span><small>${esc(costs)}</small></button>`;
  }).join('');

  const players = state.players
    .map((p) => {
      const total = RESOURCES.reduce((s, r) => s + p.resources[r], 0);
      const status = p.eliminated
        ? esc(t('panel.out'))
        : `${esc(t('panel.troops'))} ${troopsOnBoard(state, p.id)} · ${esc(t('panel.towers'))} ${towersOf(state, p.id).length} · ${esc(t('panel.cards'))} ${total} · ${esc(resourceName(t, GOLD))} ${p.resources[GOLD]}`;
      return `<li style="--player:${PLAYERS.colors[p.id]}" class="${p.id === me ? 'active' : ''} ${p.eliminated ? 'out' : ''}"><b>${esc(playerName(t, p.id))}</b> <small>${status}</small></li>`;
    })
    .join('');

  const log = model.log
    .slice()
    .reverse()
    .map((m) => `<li>${esc(formatMessage(t, m))}</li>`)
    .join('');

  root.innerHTML = `
    <header class="turn" style="--player:${color}">
      <span class="chip"></span><b>${esc(playerName(t, me))}</b>
      <span class="muted">${esc(t('panel.turn', { turn: state.turn }))}</span>
    </header>
    <div class="row"><span class="muted">${esc(t('panel.dice'))}</span> <span class="dice" data-bind-dice>${dice}</span></div>
    <button class="primary" data-action="${primary[0]}">${esc(t(primary[1]))}</button>
    <section><h3>${esc(t('panel.resources'))}</h3><div class="resources">${resources}</div>
      <div class="exchange"><span class="muted">${esc(t('panel.exchange'))}</span>${exchange}</div></section>
    <section><h3>${esc(t('panel.actions'))}</h3><div class="tools">${tools}</div></section>
    <section class="context">${contextHtml(model, t)}</section>
    <section><h3>${esc(t('panel.players'))}</h3><ul class="players">${players}</ul></section>
    <section><h3>${esc(t('panel.log'))}</h3><ul class="log">${log}</ul></section>`;
}

/** The hint, error, cell info or form shown under the tools. @param {PanelModel} model @param {Translate} t */
function contextHtml(model, t) {
  const { state, form } = model;
  const parts = [];
  if (model.message) parts.push(`<p class="message">${esc(formatMessage(t, model.message))}</p>`);

  if (form?.kind === 'attack') {
    const edge = model.count + form.attackerBonus - (state.cells[form.target].troops[form.defender] + form.defenderBonus);
    const defenders =
      form.enemies.length > 1
        ? `<div class="row">${form.enemies
            .map(
              (p) =>
                `<button class="small" style="--player:${PLAYERS.colors[p]}" data-action="defender" data-player="${p}" aria-pressed="${p === form.defender}">${esc(playerName(t, p))}</button>`
            )
            .join('')}</div>`
        : '';
    parts.push(`
      <h3>${esc(t(form.from === form.target ? 'attack.inside' : 'attack.outside'))}</h3>
      <p>${esc(t('attack.versus', { defender: playerName(t, form.defender), troops: state.cells[form.target].troops[form.defender] }))}</p>
      ${defenders}
      ${stepper(model, t)}
      <p class="muted">${esc(t('attack.bonus', { mine: form.attackerBonus, theirs: form.defenderBonus }))}</p>
      <p><b>${esc(t('attack.odds', { pct: Math.round(winChance(edge) * 100) }))}</b></p>
      <div class="row"><button class="primary" data-action="fight">${esc(t('attack.fight'))}</button>
      <button data-action="cancel">${esc(t('action.cancel'))}</button></div>`);
    return parts.join('');
  }

  if (form?.kind === 'trade') {
    const buttons = form.options
      .map((o, i) => `<button data-action="trade-pay" data-index="${i}" ${o.ok ? '' : 'disabled'}>${esc(t('trade.give', { pay: costText(t, o.pay) }))}</button>`)
      .join('');
    parts.push(`<h3>${esc(t('trade.title'))}</h3><div class="stack">${buttons}</div>
      <button data-action="cancel">${esc(t('action.cancel'))}</button>`);
    return parts.join('');
  }

  if (model.tool) {
    parts.push(`<p>${esc(t(`hint.${model.tool}${model.source === null ? '' : '-target'}`))}</p>`);
    if (model.tool === 'wagon-group') parts.push(stepper(model, t));
    parts.push(`<button data-action="cancel">${esc(t('action.cancel'))}</button>`);
  } else if (model.selectedCell !== null) {
    parts.push(cellInfo(state, model.selectedCell, t));
  } else {
    parts.push(`<p class="muted">${esc(t(state.phase === 'roll' ? 'hint.roll' : 'hint.none'))}</p>`);
  }
  return parts.join('');
}

/** @param {PanelModel} model @param {Translate} t */
function stepper(model, t) {
  return `<div class="row stepper"><span>${esc(t('panel.troops-count'))}</span>
    <button class="small" data-action="count" data-delta="-1" ${model.count <= 1 ? 'disabled' : ''}>−</button>
    <b>${model.count}</b>
    <button class="small" data-action="count" data-delta="1" ${model.count >= model.countMax ? 'disabled' : ''}>+</button></div>`;
}

/** @param {import('../systems/state.js').GameState} state @param {number} id @param {Translate} t */
function cellInfo(state, id, t) {
  const cell = state.cells[id];
  const lines = [];
  if (cell.kind === 'normal') lines.push(`${esc(resourceName(t, /** @type {string} */ (cell.resource)))} · ${esc(t('info.number', { n: /** @type {number} */ (cell.number) }))}`);
  if (cell.kind === 'tower') lines.push(`${esc(t('info.tower', { owner: playerName(t, cell.towerOwner) }))}`);
  if (cell.kind === 'empty') lines.push(esc(t('info.empty')));
  const troops = cell.troops
    .map((n, p) => (n > 0 ? `<span class="chip-text" style="--player:${PLAYERS.colors[p]}">${esc(playerName(t, p))} ${n}</span>` : ''))
    .join(' ');
  lines.push(troops || esc(t('info.no-troops')));
  return `<h3>${esc(t('info.title'))}</h3>${lines.map((l) => `<p>${l}</p>`).join('')}`;
}
