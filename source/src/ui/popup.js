// Popup menu (HTML) shown next to the clicked intersection, so a play needs little mouse travel.
// It lists the choices of that click. Buttons use data-action (handled by the play scene).

import { COSTS } from '../config.js';
import { bigBuildingAt, costOf } from '../systems/actions.js';
import { costText } from './panel.js';

/** @typedef {import('./panel.js').Translate} Translate */
/** @typedef {import('../systems/choices.js').Choice} Choice */

/** @typedef {{kind: 'menu', choices: Choice[]}} PopupModel */

const esc = (/** @type {unknown} */ s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Label and cost of a choice.
 * @param {Translate} t
 * @param {Choice} choice
 */
export function describeChoice(t, choice) {
  if (choice.kind === 'move-settlement') return { label: t('choice.move-settlement'), cost: costText(t, COSTS.moveSettlement) };
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
    default:
      return { label: a.type, cost };
  }
}

/**
 * @param {HTMLElement} root The popup element.
 * @param {PopupModel | null} model
 * @param {{left: number, top: number}} at Position inside #ui, in CSS pixels.
 * @param {Translate} t
 */
export function renderPopup(root, model, at, t) {
  if (!model) {
    root.hidden = true;
    root.innerHTML = '';
    return;
  }
  root.hidden = false;
  root.innerHTML = model.choices
    .map((c, i) => {
      const { label, cost } = describeChoice(t, c);
      return `<button data-action="choose" data-index="${i}"><span>${esc(label)}</span>${cost ? `<small>${esc(cost)}</small>` : ''}</button>`;
    })
    .join('');
  // Keep the popup inside the window.
  const parent = root.parentElement?.getBoundingClientRect();
  const w = root.offsetWidth;
  const h = root.offsetHeight;
  const left = parent ? Math.min(at.left, parent.width - w - 8) : at.left;
  const top = parent ? Math.min(at.top, parent.height - h - 8) : at.top;
  root.style.left = `${Math.max(8, left)}px`;
  root.style.top = `${Math.max(8, top)}px`;
  /** @type {HTMLElement | null} */ (root.querySelector('button'))?.focus({ preventScroll: true });
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
