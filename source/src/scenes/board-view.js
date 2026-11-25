// Draws the board on the canvas: cells, numbers, towers, troops, buildings and highlights. Greybox shapes only.

import { BOARD_VIEW, PLAYERS, VIEW } from '../config.js';
import { CELL_COUNT } from '../systems/board.js';
import { capacity } from '../systems/state.js';
import { cellCenter, cellRect, pointPos, troopSlot } from './board-layout.js';

const C = BOARD_VIEW.colors;
const OUTLINE = '#0d0e13';

/**
 * @typedef {object} Highlights
 * @property {number[]} [moves] Cells the selected troops can move to.
 * @property {number[]} [attacks] Cells the selected troops can attack.
 * @property {number[]} [points] Intersections with something to do (circles).
 * @property {number | null} [source] Selected cell with your troops.
 * @property {number | null} [sourcePoint] Settlement being moved.
 * @property {number | null} [selectedCell]
 * @property {number | null} [hoverCell]
 * @property {number | null} [hoverPoint] Circle under the pointer.
 * @property {{from: number, to: number, count: number, player: number} | null} [preview] Move being chosen:
 *   the troops that leave are drawn faded in the source, and the ones that arrive as ghosts in the destination.
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

  for (const cell of state.cells) drawCell(ctx, cell);
  for (const id of hl.moves ?? []) fillCell(ctx, id, C.target);
  for (const id of hl.attacks ?? []) fillCell(ctx, id, C.attack);
  for (const cell of state.cells) drawTroops(ctx, state, cell, hl.preview ?? null);
  for (const [point, b] of Object.entries(state.buildings)) drawBuilding(ctx, Number(point), b);
  for (const id of hl.points ?? []) drawPointCircle(ctx, id, id === hl.hoverPoint, id in state.buildings);

  if (hl.hoverCell != null && hl.hoverPoint == null) strokeCell(ctx, hl.hoverCell, 'rgba(255,255,255,0.5)', 2);
  if (hl.selectedCell != null) strokeCell(ctx, hl.selectedCell, C.select, 3);
  if (hl.source != null) strokeCell(ctx, hl.source, C.select, 4);
  if (hl.sourcePoint != null) ringPoint(ctx, hl.sourcePoint, C.select, 3);
}

/**
 * Clickable circle on an intersection: build, promote, conquer, trade or move a settlement.
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

/** @param {CanvasRenderingContext2D} ctx @param {import('../systems/board.js').Cell} cell */
function drawCell(ctx, cell) {
  const r = cellRect(cell.id);
  ctx.fillStyle = cell.kind === 'empty' ? C.empty : C[/** @type {keyof typeof C} */ (cell.resource ?? 'empty')];
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  const c = cellCenter(cell.id);
  if (cell.kind === 'normal' && cell.number !== null) drawNumber(ctx, c.x, c.y, cell.number);
  if (cell.kind === 'tower') drawTower(ctx, c.x, c.y, ownerColor(cell.towerOwner));
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

/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {string} color */
function drawTower(ctx, x, y, color) {
  const w = 22;
  const h = 26;
  ctx.fillStyle = color;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y + h / 2);
  ctx.lineTo(x - w / 2, y - h / 2);
  for (let i = 0; i < 3; i++) {
    const left = x - w / 2 + (i * w) / 3;
    ctx.lineTo(left + w / 6, y - h / 2);
    ctx.lineTo(left + w / 6, y - h / 2 + 5);
    ctx.lineTo(left + w / 3, y - h / 2 + 5);
    ctx.lineTo(left + w / 3, y - h / 2);
  }
  ctx.lineTo(x + w / 2, y + h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x - 3, y + h / 2 - 9, 6, 9);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../systems/state.js').GameState} state
 * @param {import('../systems/board.js').Cell} cell
 */
function drawTroops(ctx, state, cell, preview) {
  const slots = capacity(state, cell.id);
  const leaving = preview && preview.from === cell.id ? preview.count : 0;
  const arriving = preview && preview.to === cell.id ? preview.count : 0;
  let slot = 0;
  cell.troops.forEach((n, player) => {
    // The last `leaving` troops of the mover in the source are the ones that go.
    const firstLeaving = preview && player === preview.player ? n - leaving : n;
    for (let i = 0; i < n && slot < slots; i++, slot++) drawTroop(ctx, troopSlot(cell.id, slot, slots), PLAYERS.colors[player], i >= firstLeaving ? 'leaving' : 'solid');
  });
  for (let i = 0; i < arriving && slot < slots; i++, slot++) drawTroop(ctx, troopSlot(cell.id, slot, slots), PLAYERS.colors[/** @type {number} */ (preview?.player)], 'arriving');
}

/**
 * One troop token. Previews: 'leaving' is faded, 'arriving' is a ghost with a dashed outline.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x: number, y: number}} p
 * @param {string} color
 * @param {'solid' | 'leaving' | 'arriving'} look
 */
function drawTroop(ctx, p, color, look) {
  ctx.save();
  ctx.globalAlpha = look === 'solid' ? 1 : look === 'leaving' ? 0.3 : 0.55;
  ctx.beginPath();
  ctx.arc(p.x, p.y, BOARD_VIEW.troopRadius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = look === 'arriving' ? '#ffffff' : OUTLINE;
  if (look === 'arriving') ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.restore();
}

/** @param {CanvasRenderingContext2D} ctx @param {number} point @param {import('../systems/state.js').Building} b */
function drawBuilding(ctx, point, b) {
  const { x, y } = pointPos(point);
  const s = BOARD_VIEW.buildingSize;
  ctx.fillStyle = ownerColor(b.owner);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  if (b.type === 'settlement') {
    // House: square with a roof.
    ctx.moveTo(x - s * 0.8, y + s * 0.8);
    ctx.lineTo(x - s * 0.8, y - s * 0.1);
    ctx.lineTo(x, y - s);
    ctx.lineTo(x + s * 0.8, y - s * 0.1);
    ctx.lineTo(x + s * 0.8, y + s * 0.8);
  } else if (b.type === 'castle') {
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
  if (b.type === 'port') {
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.6);
    ctx.lineTo(x, y + s * 0.55);
    ctx.moveTo(x - s * 0.55, y + s * 0.15);
    ctx.quadraticCurveTo(x, y + s * 0.95, x + s * 0.55, y + s * 0.15);
    ctx.stroke();
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {number} id @param {string} color */
function fillCell(ctx, id, color) {
  const r = cellRect(id);
  ctx.fillStyle = color;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

/** @param {CanvasRenderingContext2D} ctx @param {number} id @param {string} color @param {number} width */
function strokeCell(ctx, id, color, width) {
  if (id < 0 || id >= CELL_COUNT) return;
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
