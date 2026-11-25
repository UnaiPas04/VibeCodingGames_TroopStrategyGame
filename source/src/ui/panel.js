// Side panel (HTML): active player, dice, resources, help or cell details, players and log.
// Plays happen on the board (clicks and the popup menu); the panel only shows state and ends the turn.

import { BOARD_VIEW, GOLD, PLAYERS, RESOURCES } from '../config.js';
import { capacity, towersOf, troopsOnBoard } from '../systems/state.js';

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

/** @typedef {(key: string, params?: Record<string, string | number>) => string} Translate */
/** @typedef {{key: string, params?: Record<string, any>}} Message */

/**
 * @typedef {object} PanelModel
 * @property {import('../systems/state.js').GameState} state
 * @property {number | null} infoCell Cell whose details are shown.
 * @property {Message | null} message Last error or hint.
 * @property {Message[]} log
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

  const dice = state.dice ? `${state.dice[0]} + ${state.dice[1]} = <b>${state.dice[0] + state.dice[1]}</b>` : '–';
  const primary = state.phase === 'roll' ? ['roll', 'action.roll'] : ['end-turn', 'action.end-turn'];

  const resources = [...RESOURCES, GOLD]
    .map((r) => `<span class="res" style="--res:${BOARD_VIEW.colors[/** @type {keyof typeof BOARD_VIEW.colors} */ (r)]}">${esc(resourceName(t, r))} <b>${purse[r]}</b></span>`)
    .join('');

  const exchange = RESOURCES.map(
    (r) =>
      `<button class="small" data-action="exchange" data-resource="${r}" ${acting && purse[GOLD] > 0 ? '' : 'disabled'}>${esc(resourceName(t, r))}</button>`
  ).join('');

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

  const context = [
    model.message ? `<p class="message">${esc(formatMessage(t, model.message))}</p>` : '',
    model.infoCell !== null ? cellInfo(state, model.infoCell, t) : `<p class="muted">${esc(t('help.play'))}</p><p class="muted">${esc(t('help.build'))}</p>`
  ].join('');

  root.innerHTML = `
    <header class="turn" style="--player:${PLAYERS.colors[me]}">
      <span class="chip"></span><b>${esc(playerName(t, me))}</b>
      <span class="muted">${esc(t('panel.turn', { turn: state.turn }))}</span>
    </header>
    <div class="row"><span class="muted">${esc(t('panel.dice'))}</span> <span class="dice">${dice}</span></div>
    <button class="primary" data-action="${primary[0]}">${esc(t(primary[1]))}</button>
    <section><h3>${esc(t('panel.resources'))}</h3><div class="resources">${resources}</div>
      <div class="exchange"><span class="muted">${esc(t('panel.exchange'))}</span>${exchange}</div></section>
    <section class="context">${context}</section>
    <section><h3>${esc(t('panel.players'))}</h3><ul class="players">${players}</ul></section>
    <section><h3>${esc(t('panel.log'))}</h3><ul class="log">${log}</ul></section>`;
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
  lines.push(`<span class="muted">${esc(t('info.capacity', { n: capacity(state, id) }))}</span>`);
  return `<h3>${esc(t('info.title'))}</h3>${lines.map((l) => `<p>${l}</p>`).join('')}`;
}
