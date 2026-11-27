// Popup menu (HTML) shown next to the click, so a play needs little mouse travel.
// It lists the choices of that click, or a form: move troops (price and Accept), troop attack, building
// attack. Buttons use data-action (handled by the play scene).

import { COSTS, PLAYERS } from '../config.js';
import { bigBuildingAt, costOf } from '../systems/actions.js';
import { cellDistance } from '../systems/board.js';
import { winChance } from '../systems/combat.js';
import { costText, playerName } from './panel.js';

/** @typedef {import('./panel.js').Translate} Translate */
/** @typedef {import('../systems/choices.js').Choice} Choice */

/**
 * @typedef {{kind: 'menu', choices: Choice[], compact?: boolean, count?: number, max?: number}
 *   | {kind: 'move', from: number, to: number, count: number, max: number}
 *   | {kind: 'attack', from: number, target: number, enemies: number[], defender: number, count: number, max: number, helpers: number, attackerBonus: number, defenderBonus: number}
 *   | {kind: 'attack-building', from: number, target: number, defender: number, building: string, attackerBonus: number, defenderBonus: number, attackerSupport: number, defenderSupport: number}} PopupModel
 */

const esc = (/** @type {unknown} */ s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Label and cost of a choice.
 * @param {Translate} t
 * @param {Choice} choice
 * @param {boolean} [short] Short labels for the compact menu on a selected cell.
 */
export function describeChoice(t, choice, short = false) {
  if (choice.kind === 'move-settlement') return { label: t('choice.move-settlement'), cost: costText(t, COSTS.moveSettlement) };
  if (choice.kind === 'attack') return { label: t(choice.from === choice.target ? 'choice.attack-inside' : 'choice.attack'), cost: costText(t, COSTS.attack) };
  if (choice.kind === 'attack-building') return { label: t('choice.attack-building'), cost: costText(t, COSTS.attackBuilding) };
  const a = choice.action;
  const cost = costText(t, costOf(a));
  switch (a.type) {
    case 'place-start':
      return { label: t(bigBuildingAt(a.point) === 'castle' ? 'choice.start-castle' : 'choice.start-port'), cost };
    case 'build-road':
      return { label: t('choice.road'), cost };
    case 'build-settlement':
      return { label: t('choice.build'), cost };
    case 'promote':
      return { label: t(bigBuildingAt(a.point) === 'castle' ? 'choice.castle' : 'choice.port'), cost };
    case 'port-trade':
      return { label: t('choice.trade', { pay: costText(t, a.pay) }), cost: '' };
    case 'recruit':
      return { label: t(short ? 'choice.recruit-short' : 'choice.recruit'), cost };
    case 'move':
      return { label: t('choice.move', { count: a.count, cells: cellDistance(a.from, a.to) }), cost };
    default:
      return { label: a.type, cost };
  }
}

/** − n + buttons. @param {string} action @param {number} count @param {number} max @param {string} [title] */
const stepper = (action, count, max, title = '') => `<div class="row stepper" title="${esc(title)}">
  <button class="small" data-action="${action}" data-delta="-1" ${count <= 1 ? 'disabled' : ''}>−</button>
  <b>${count}</b>
  <button class="small" data-action="${action}" data-delta="1" ${count >= max ? 'disabled' : ''}>+</button></div>`;

/** @param {Translate} t @param {string} fightAction */
const fightButtons = (t, fightAction) => `<div class="row">
  <button class="primary" data-action="${fightAction}">${esc(t('attack.fight'))}</button>
  <button data-action="cancel">${esc(t('action.cancel'))}</button></div>`;

/**
 * @param {HTMLElement} root The popup element.
 * @param {PopupModel | null} model
 * @param {{left: number, top: number}} at Position inside #ui, in CSS pixels.
 * @param {import('../systems/state.js').GameState} state
 * @param {Translate} t
 */
export function renderPopup(root, model, at, state, t) {
  if (!model) {
    root.hidden = true;
    root.innerHTML = '';
    return;
  }
  root.hidden = false;
  const compact = model.kind === 'menu' && !!model.compact;
  root.classList.toggle('compact', compact);
  if (model.kind === 'menu') {
    // The compact menu on a selected cell starts with the number of troops to move.
    const count = compact && (model.max ?? 0) > 1 ? stepper('move-count', model.count ?? 1, model.max ?? 1, t('move.wheel')) : '';
    root.innerHTML =
      count +
      model.choices
        .map((c, i) => {
          const { label, cost } = describeChoice(t, c, compact);
          return `<button data-action="choose" data-index="${i}"><span>${esc(label)}</span>${cost ? `<small>${esc(cost)}</small>` : ''}</button>`;
        })
        .join('');
  } else if (model.kind === 'move') {
    const action = /** @type {const} */ ({ type: 'move', from: model.from, to: model.to, count: model.count });
    root.innerHTML = `
      <b>${esc(t('choice.move', { count: model.count, cells: cellDistance(model.from, model.to) }))}</b>
      <span>${esc(t('move.price', { cost: costText(t, costOf(action)) }))}</span>
      ${model.max > 1 ? stepper('move-count', model.count, model.max) : ''}
      <div class="row">
        <button class="primary" data-action="confirm-move">${esc(t('action.accept'))}</button>
        <button data-action="cancel">${esc(t('action.cancel'))}</button>
      </div>
      <span class="muted">${esc(t('move.retarget'))}</span>`;
  } else if (model.kind === 'attack') {
    const defenderTroops = state.cells[model.target].troops[model.defender];
    const inside = model.from === model.target;
    const edge = model.count + model.helpers + model.attackerBonus - (defenderTroops + model.defenderBonus);
    const defenders =
      model.enemies.length > 1
        ? `<div class="row">${model.enemies
            .map(
              (p) =>
                `<button class="small" style="--player:${PLAYERS.colors[p]}" data-action="defender" data-player="${p}" aria-pressed="${p === model.defender}">${esc(playerName(t, p))}</button>`
            )
            .join('')}</div>`
        : '';
    root.innerHTML = `
      <b>${esc(t(inside ? 'choice.attack-inside' : 'choice.attack'))} <small>${esc(costText(t, COSTS.attack))}</small></b>
      <span class="muted">${esc(t('attack.versus', { defender: playerName(t, model.defender), troops: defenderTroops }))}</span>
      ${defenders}
      ${inside ? `<span>${esc(t('attack.inside-all', { count: model.count }))}</span>` : `<div class="row"><span>${esc(t('attack.troops'))}</span>${stepper('count', model.count, model.max)}</div>`}
      ${model.helpers ? `<span class="muted">${esc(t('attack.helpers', { count: model.helpers }))}</span>` : ''}
      <span class="muted">${esc(t('attack.bonus', { mine: model.attackerBonus, theirs: model.defenderBonus }))}</span>
      <b>${esc(t('attack.odds', { pct: Math.round(winChance(edge) * 100) }))}</b>
      ${fightButtons(t, 'fight')}`;
  } else {
    const edge = model.attackerBonus + model.attackerSupport - (model.defenderBonus + model.defenderSupport);
    root.innerHTML = `
      <b>${esc(t('choice.attack-building'))} <small>${esc(costText(t, COSTS.attackBuilding))}</small></b>
      <span class="muted">${esc(t('siege.versus', { defender: playerName(t, model.defender), building: t('building.' + model.building) }))}</span>
      <span class="muted">${esc(t('siege.parts', { mine: model.attackerBonus, mySupport: model.attackerSupport, theirs: model.defenderBonus, theirSupport: model.defenderSupport }))}</span>
      <b>${esc(t('attack.odds', { pct: Math.round(winChance(edge) * 100) }))}</b>
      <span class="muted">${esc(t(model.building === 'settlement' ? 'siege.destroy' : 'siege.downgrade'))}</span>
      ${fightButtons(t, 'fight-building')}`;
  }
  // Keep the popup inside the window.
  const parent = root.parentElement?.getBoundingClientRect();
  const w = root.offsetWidth;
  const h = root.offsetHeight;
  const left = parent ? Math.min(at.left, parent.width - w - 8) : at.left;
  const top = parent ? Math.min(at.top, parent.height - h - 8) : at.top;
  root.style.left = `${Math.max(8, left)}px`;
  root.style.top = `${Math.max(8, top)}px`;
  // Compact menus never take the keyboard focus: the board keeps the wheel and the clicks.
  if (!compact) /** @type {HTMLElement | null} */ (root.querySelector('.primary') ?? root.querySelector('button'))?.focus({ preventScroll: true });
}

/**
 * Small text next to the pointer (what a click there does, and its cost). Never takes clicks.
 * @param {HTMLElement} root The hint element.
 * @param {string | null} text
 * @param {{left: number, top: number}} at Position inside #ui, in CSS pixels.
 */
export function renderHint(root, text, at) {
  root.hidden = !text;
  if (!text) return;
  root.textContent = text;
  root.style.left = `${at.left}px`;
  root.style.top = `${at.top}px`;
}
