// Popup menu (HTML) shown next to the clicked cell or intersection, so a play needs little mouse travel.
// It lists the choices of that click, or the attack form. Buttons use data-action (handled by the play scene).

import { COSTS, PLAYERS } from '../config.js';
import { costOf } from '../systems/actions.js';
import { cellDistance, pointKind } from '../systems/board.js';
import { winChance } from '../systems/combat.js';
import { costText, playerName } from './panel.js';

/** @typedef {import('./panel.js').Translate} Translate */
/** @typedef {import('../systems/choices.js').Choice} Choice */

/**
 * @typedef {{kind: 'menu', choices: Choice[], compact?: boolean, count?: number, max?: number}
 *   | {kind: 'move', from: number, to: number, count: number, max: number}
 *   | {kind: 'attack', from: number, target: number, enemies: number[], defender: number, count: number, max: number, attackerBonus: number, defenderBonus: number}} PopupModel
 */

const esc = (/** @type {unknown} */ s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Label and cost of a choice.
 * @param {Translate} t
 * @param {import('../systems/state.js').GameState} state
 * @param {Choice} choice
 * @param {boolean} [short] Short labels for the compact menu on a selected cell.
 */
export function describeChoice(t, state, choice, short = false) {
  if (choice.kind === 'attack') {
    const inside = choice.from === choice.target;
    const label = inside ? (short ? 'choice.attack-inside-short' : 'choice.attack-inside') : 'choice.attack-outside';
    return { label: t(label), cost: costText(t, inside ? COSTS.attackInside : COSTS.attackOutside) };
  }
  if (choice.kind === 'move-settlement') return { label: t('choice.move-settlement'), cost: costText(t, COSTS.moveSettlement) };
  const a = choice.action;
  const cost = costText(t, costOf(state, a));
  switch (a.type) {
    case 'move':
      return { label: t('choice.move', { count: a.count, cells: cellDistance(a.from, a.to) }), cost };
    case 'recruit':
      return { label: t(short ? 'choice.recruit-short' : 'choice.recruit'), cost };
    case 'build-settlement':
      return { label: t('choice.build'), cost };
    case 'promote':
      return { label: t(pointKind(a.point) === 'coast' ? 'choice.port' : 'choice.castle'), cost };
    case 'conquer':
      return { label: t('choice.conquer'), cost };
    case 'port-trade':
      return { label: t('choice.trade', { pay: costText(t, a.pay) }), cost: '' };
    default:
      return { label: a.type, cost };
  }
}

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
    const stepper =
      compact && (model.max ?? 0) > 1
        ? `<div class="row stepper" title="${esc(t('move.wheel'))}">
            <button class="small" data-action="move-count" data-delta="-1" ${(model.count ?? 1) <= 1 ? 'disabled' : ''}>−</button>
            <b>${model.count}</b>
            <button class="small" data-action="move-count" data-delta="1" ${(model.count ?? 1) >= (model.max ?? 1) ? 'disabled' : ''}>+</button></div>`
        : '';
    root.innerHTML = stepper + model.choices
      .map((c, i) => {
        const { label, cost } = describeChoice(t, state, c, compact);
        return `<button data-action="choose" data-index="${i}"><span>${esc(label)}</span>${cost ? `<small>${esc(cost)}</small>` : ''}</button>`;
      })
      .join('');
  } else if (model.kind === 'move') {
    const action = /** @type {const} */ ({ type: 'move', from: model.from, to: model.to, count: model.count });
    const stepper =
      model.max > 1
        ? `<div class="row stepper"><span>${esc(t('attack.troops'))}</span>
        <button class="small" data-action="move-count" data-delta="-1" ${model.count <= 1 ? 'disabled' : ''}>−</button>
        <b>${model.count}</b>
        <button class="small" data-action="move-count" data-delta="1" ${model.count >= model.max ? 'disabled' : ''}>+</button></div>`
        : '';
    root.innerHTML = `
      <b>${esc(t('choice.move', { count: model.count, cells: cellDistance(model.from, model.to) }))}</b>
      <span>${esc(t('move.price', { cost: costText(t, costOf(state, action)) }))}</span>
      ${stepper}
      <div class="row">
        <button class="primary" data-action="confirm-move">${esc(t('action.accept'))}</button>
        <button data-action="cancel">${esc(t('action.cancel'))}</button>
      </div>
      <span class="muted">${esc(t('move.retarget'))}</span>`;
  } else {
    const defenderTroops = state.cells[model.target].troops[model.defender];
    const edge = model.count + model.attackerBonus - (defenderTroops + model.defenderBonus);
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
      <b>${esc(t(model.from === model.target ? 'choice.attack-inside' : 'choice.attack-outside'))}</b>
      <span class="muted">${esc(t('attack.versus', { defender: playerName(t, model.defender), troops: defenderTroops }))}</span>
      ${defenders}
      <div class="row stepper"><span>${esc(t('attack.troops'))}</span>
        <button class="small" data-action="count" data-delta="-1" ${model.count <= 1 ? 'disabled' : ''}>−</button>
        <b>${model.count}</b>
        <button class="small" data-action="count" data-delta="1" ${model.count >= model.max ? 'disabled' : ''}>+</button></div>
      <span class="muted">${esc(t('attack.bonus', { mine: model.attackerBonus, theirs: model.defenderBonus }))}</span>
      <b>${esc(t('attack.odds', { pct: Math.round(winChance(edge) * 100) }))}</b>
      <div class="row">
        <button class="primary" data-action="fight">${esc(t('attack.fight'))}</button>
        <button data-action="cancel">${esc(t('action.cancel'))}</button>
      </div>`;
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
 * Small text next to the pointer (the cost of the move under it). Never takes clicks.
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
