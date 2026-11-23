// Draws the demo match. Shared by the single-player scene and the online scene, so both look the same.

import { ITEMS, VIEW } from '../config.js';

/**
 * @typedef {object} MatchView
 * @property {{x: number, y: number, w: number, h: number, color: string}[]} players
 * @property {{x: number, y: number, w: number, h: number}[]} items
 */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {MatchView} view
 * @param {import('../core/debug.js').DebugHandle} debug
 */
export function drawMatch(ctx, view, debug) {
  ctx.fillStyle = VIEW.background;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  ctx.fillStyle = ITEMS.color;
  for (const item of view.items) ctx.fillRect(Math.round(item.x), Math.round(item.y), item.w, item.h);

  for (const p of view.players) {
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.w, p.h);
  }

  for (const p of view.players) debug.box(ctx, p);
  for (const item of view.items) debug.box(ctx, item, '#00ffff');
  debug.setEntityCount(view.players.length + view.items.length);
}

/**
 * Adapt a simulated match to the view shape.
 * @param {import('../systems/match.js').Match} match
 * @returns {MatchView}
 */
export function matchToView(match) {
  return { players: match.players.map((p) => ({ ...p.body, color: p.color })), items: match.items };
}
