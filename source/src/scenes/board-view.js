// Draws the board on the canvas: cells, numbers, roads, buildings and highlights. Greybox shapes only.

import { BOARD_VIEW, PLAYERS, VIEW } from '../config.js';
import { edgeEnds } from '../systems/board.js';
import { cellCenter, cellRect, edgeMid, pointPos } from './board-layout.js';

const C = BOARD_VIEW.colors;
const OUTLINE = '#0d0e13';

/**
 * @typedef {object} Highlights
 * @property {number[]} [points] Intersections with something to do (circles).
 * @property {number[]} [roads] Edges where a road can be built (slots).
 * @property {number | null} [sourcePoint] Settlement being moved.
 * @property {number | null} [selectedCell]
 * @property {number | null} [hoverCell]
 * @property {number | null} [hoverPoint] Circle under the pointer.
 * @property {number | null} [hoverRoad] Road slot under the pointer.
 * @property {{point: number, type: 'settlement' | 'castle' | 'port'} | null} [ghost] Building a click would place, drawn faded.
 * @property {number} [player] Active player (color of slots and ghosts).
 */

/** @param {number | null} owner */
const ownerColor = (owner) => (owner === null ? PLAYERS.grey : PLAYERS.colors[owner]);

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../systems/state.js').GameState} state
 * @param {Highlights} hl
 */
export function drawBoard(ctx, state, hl) {
  ctx.fillStyle = VIEW.background;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const player = hl.player ?? state.current;

  for (const cell of state.cells) drawCell(ctx, cell);
  if (hl.hoverCell != null && hl.hoverPoint == null && hl.hoverRoad == null) strokeCell(ctx, hl.hoverCell, 'rgba(255,255,255,0.5)', 2);
  if (hl.selectedCell != null) strokeCell(ctx, hl.selectedCell, C.select, 3);

  for (const e of hl.roads ?? []) drawRoadSlot(ctx, e, PLAYERS.colors[player], e === hl.hoverRoad);
  for (const [edge, owner] of Object.entries(state.roads)) drawRoad(ctx, Number(edge), ownerColor(owner), 1);
  for (const [point, b] of Object.entries(state.buildings)) drawBuilding(ctx, Number(point), b.type, ownerColor(b.owner), 1);
  for (const id of hl.points ?? []) drawPointCircle(ctx, id, id === hl.hoverPoint, id in state.buildings);
  if (hl.ghost) drawBuilding(ctx, hl.ghost.point, hl.ghost.type, PLAYERS.colors[player], 0.6);
  if (hl.sourcePoint != null) ringPoint(ctx, hl.sourcePoint, C.select, 3);
}

/** @param {CanvasRenderingContext2D} ctx @param {import('../systems/board.js').Cell} cell */
function drawCell(ctx, cell) {
  const r = cellRect(cell.id);
  ctx.fillStyle = C[/** @type {keyof typeof C} */ (cell.resource)];
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  const c = cellCenter(cell.id);
  if (cell.kind === 'gold') {
    // A coin ring marks gold cells.
    ctx.beginPath();
    ctx.arc(c.x, c.y, BOARD_VIEW.numberRadius + 6, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff3c4';
    ctx.stroke();
  }
  drawNumber(ctx, c.x, c.y, cell.number);
}

/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} n */
function drawNumber(ctx, x, y, n) {
  const radius = BOARD_VIEW.numberRadius;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = C.number;
  ctx.fill();
  const hot = n === 6 || n === 8;
  ctx.fillStyle = hot ? C.numberHot : C.numberText;
  ctx.font = `bold ${radius}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), x, y - 2);
  // Pips: how likely the number is (ways to roll it with two dice).
  const pips = 6 - Math.abs(7 - n);
  for (let i = 0; i < pips; i++) {
    ctx.beginPath();
    ctx.arc(x + (i - (pips - 1) / 2) * 4, y + radius * 0.62, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * A road along a cell side, kept clear of the intersections so the buildings stay visible.
 * @param {CanvasRenderingContext2D} ctx @param {number} edge @param {string} color @param {number} alpha
 */
function drawRoad(ctx, edge, color, alpha) {
  const [a, b] = edgeEnds(edge).map(pointPos);
  const inset = BOARD_VIEW.buildingSize + 4;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x + ux * inset, a.y + uy * inset);
  ctx.lineTo(b.x - ux * inset, b.y - uy * inset);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = BOARD_VIEW.roadWidth + 4;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = BOARD_VIEW.roadWidth;
  ctx.stroke();
  ctx.restore();
}

/**
 * Where a road can be built: a small dashed mark in the middle of the side; under the pointer, a faded road.
 * @param {CanvasRenderingContext2D} ctx @param {number} edge @param {string} color @param {boolean} hover
 */
function drawRoadSlot(ctx, edge, color, hover) {
  if (hover) return drawRoad(ctx, edge, color, 0.6);
  // A short dashed stroke along the side, unlike the round intersection circles.
  const m = edgeMid(edge);
  const [a, b] = edgeEnds(edge).map(pointPos);
  const half = 14;
  const ux = Math.sign(b.x - a.x);
  const uy = Math.sign(b.y - a.y);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(m.x - ux * half, m.y - uy * half);
  ctx.lineTo(m.x + ux * half, m.y + uy * half);
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.point;
  ctx.stroke();
  ctx.restore();
}

/**
 * Clickable circle on an intersection: place, build, promote, trade or move a settlement.
 * Around an existing building it is a ring, so the building stays visible.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} id
 * @param {boolean} hover
 * @param {boolean} hasBuilding
 */
function drawPointCircle(ctx, id, hover, hasBuilding) {
  const { x, y } = pointPos(id);
  ctx.beginPath();
  if (hasBuilding) {
    ctx.arc(x, y, BOARD_VIEW.buildingSize + 6, 0, Math.PI * 2);
    ctx.lineWidth = hover ? 4 : 2;
    ctx.strokeStyle = C.point;
    ctx.stroke();
    return;
  }
  ctx.arc(x, y, BOARD_VIEW.pointCircle + (hover ? 3 : 0), 0, Math.PI * 2);
  ctx.fillStyle = hover ? C.point : 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.point;
  ctx.stroke();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} point
 * @param {'settlement' | 'castle' | 'port'} type
 * @param {string} color
 * @param {number} alpha
 */
function drawBuilding(ctx, point, type, color, alpha) {
  const { x, y } = pointPos(point);
  const s = BOARD_VIEW.buildingSize;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  if (type === 'settlement') {
    // House: square with a roof.
    ctx.moveTo(x - s * 0.8, y + s * 0.8);
    ctx.lineTo(x - s * 0.8, y - s * 0.1);
    ctx.lineTo(x, y - s);
    ctx.lineTo(x + s * 0.8, y - s * 0.1);
    ctx.lineTo(x + s * 0.8, y + s * 0.8);
  } else if (type === 'castle') {
    // Keep with three merlons.
    const w = s * 2.2;
    const h = s * 1.9;
    ctx.moveTo(x - w / 2, y + h / 2);
    ctx.lineTo(x - w / 2, y - h / 2);
    for (let i = 0; i < 5; i++) {
      const left = x - w / 2 + (i * w) / 5;
      const top = i % 2 === 0 ? y - h / 2 : y - h / 2 + 6;
      ctx.lineTo(left, top);
      ctx.lineTo(left + w / 5, top);
    }
    ctx.lineTo(x + w / 2, y + h / 2);
  } else {
    // Port: a circle with an anchor mark.
    ctx.arc(x, y, s, 0, Math.PI * 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (type === 'port') {
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.6);
    ctx.lineTo(x, y + s * 0.55);
    ctx.moveTo(x - s * 0.55, y + s * 0.15);
    ctx.quadraticCurveTo(x, y + s * 0.95, x + s * 0.55, y + s * 0.15);
    ctx.stroke();
  }
  ctx.restore();
}

/** @param {CanvasRenderingContext2D} ctx @param {number} id @param {string} color @param {number} width */
function strokeCell(ctx, id, color, width) {
  const r = cellRect(id);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.strokeRect(r.x + width / 2, r.y + width / 2, r.w - width, r.h - width);
}

/** @param {CanvasRenderingContext2D} ctx @param {number} id @param {string} color @param {number} width */
function ringPoint(ctx, id, color, width) {
  const { x, y } = pointPos(id);
  ctx.beginPath();
  ctx.arc(x, y, BOARD_VIEW.buildingSize + 5, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
