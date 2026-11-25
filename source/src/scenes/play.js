// Hot-seat match: every player takes turns on the same screen.
// Plays need as few clicks as possible: click one of your cells (all its troops are picked; change the
// number with the mouse wheel or the − + buttons on the cell), then click where they go (up to
// MOVE.maxCells away): a box shows the price, and Accept (or a second click on the same cell) moves;
// clicking another cell changes the destination. Red cells can be attacked; click the selected cell
// again to cancel. Click an
// intersection circle to build. Choices open in a popup next to the click. The rules live in systems/
// (pure); this scene wires input, log, sounds and drawing.

import { AUTO_ROLL, BOARD_VIEW, LOG_LINES, VIEW } from '../config.js';
import { applyAction, attackBonuses, checkAction, costOf } from '../systems/actions.js';
import { cellDistance } from '../systems/board.js';
import { activePoints, cellChoices, moveTo, pointChoices, settlementDestinations, sourceTargets } from '../systems/choices.js';
import { troopsOf } from '../systems/state.js';
import { endTurn, newGame, rollDice } from '../systems/turn.js';
import { costText, formatMessage, renderPanel } from '../ui/panel.js';
import { renderHint, renderPopup } from '../ui/popup.js';
import { cellCenter, cellRect, hitTest, pointPos } from './board-layout.js';
import { drawBoard } from './board-view.js';

/** @typedef {import('../ui/panel.js').Message} Message */
/** @typedef {import('../systems/choices.js').Choice} Choice */

/** @param {import('../main.js').Game} game */
export function createPlayScene(game) {
  const panelRoot = /** @type {HTMLElement} */ (document.getElementById('panel'));
  const popupRoot = /** @type {HTMLElement} */ (document.getElementById('popup'));
  const hintRoot = /** @type {HTMLElement} */ (document.getElementById('hint'));
  /** @type {import('../systems/state.js').GameState} */
  let state; // created in enter()
  let playerCount = 2;

  /** No highlights. */
  const noHighlights = () => ({ moves: /** @type {number[]} */ ([]), attacks: /** @type {number[]} */ ([]), points: /** @type {number[]} */ ([]) });

  const ctl = {
    /** Selected cell with your troops. @type {number | null} */ source: null,
    /** Troops picked to move from the selected cell. */ count: 1,
    /** Settlement being moved. @type {number | null} */ sourcePoint: null,
    /** @type {import('../ui/popup.js').PopupModel | null} */ popup: null,
    /** Game position the popup points at. */ popupAt: { x: 0, y: 0 },
    /** @type {number | null} */ infoCell: null,
    /** @type {Message | null} */ message: null,
    /** @type {Message[]} */ log: [],
    /** @type {{cell: number | null, point: number | null}} */ hover: { cell: null, point: null },
    /** Last move preview shown, to update the hint only when it changes. */ hintKey: '',
    hl: noHighlights()
  };

  function clearSelection() {
    ctl.source = null;
    ctl.sourcePoint = null;
    ctl.popup = null;
    ctl.message = null;
  }

  /** @param {string} key @param {Record<string, any>} [params] */
  function log(key, params) {
    ctl.log.push({ key, params });
    if (ctl.log.length > LOG_LINES) ctl.log.splice(0, ctl.log.length - LOG_LINES);
  }

  /** Position inside #ui (CSS pixels) of a point in game units, moved by `offset` CSS pixels. */
  function toUi(/** @type {{x: number, y: number}} */ g, offset = { x: 0, y: 0 }) {
    const canvas = game.view.canvas.getBoundingClientRect();
    const ui = /** @type {HTMLElement} */ (popupRoot.parentElement).getBoundingClientRect();
    return {
      left: canvas.left - ui.left + (g.x / VIEW.width) * canvas.width + offset.x,
      top: canvas.top - ui.top + (g.y / VIEW.height) * canvas.height + offset.y
    };
  }

  /** Troops of the active player in the selected cell. */
  const sourceTroops = () => (ctl.source === null ? 0 : troopsOf(state, ctl.source, state.current));

  /** Recompute highlights and redraw the panel and the popup after any change. */
  function refresh() {
    ctl.hl = noHighlights();
    if (ctl.source !== null && sourceTroops() === 0) ctl.source = null;
    if (ctl.source !== null) ctl.count = Math.max(1, Math.min(ctl.count, sourceTroops()));
    if (ctl.popup?.kind === 'menu' && ctl.popup.compact) Object.assign(ctl.popup, { count: ctl.count, max: sourceTroops() });
    if (ctl.popup?.kind === 'move') {
      // The pending move follows the troop count; it closes if it is no longer possible.
      const action = moveTo(state, ctl.popup.from, ctl.popup.to, ctl.count);
      ctl.popup = action && action.type === 'move' ? { ...ctl.popup, count: action.count, max: sourceTroops() } : null;
    }
    if (state.phase === 'actions') {
      ctl.hl.points = ctl.sourcePoint !== null ? settlementDestinations(state, ctl.sourcePoint) : activePoints(state);
      if (ctl.source !== null) Object.assign(ctl.hl, sourceTargets(state, ctl.source, ctl.count));
    }
    renderPanel(panelRoot, { state, infoCell: ctl.infoCell, message: ctl.message, log: ctl.log }, game.t);
    const compact = ctl.popup?.kind === 'menu' && ctl.popup.compact;
    renderPopup(popupRoot, ctl.popup, toUi(ctl.popupAt, compact ? undefined : { x: 16, y: -16 }), state, game.t);
    ctl.hintKey = '-'; // force the move preview to refresh (or hide) on the next update
  }

  /** Small text next to the pointer: what clicking the hovered cell would move and cost. */
  function updateHint() {
    const cell = ctl.hover.cell;
    const blocked = ctl.popup && !(ctl.popup.kind === 'menu' && ctl.popup.compact); // other menus hide the preview
    const action = ctl.source !== null && cell !== null && !blocked && ctl.hl.moves.includes(cell) ? moveTo(state, ctl.source, cell, ctl.count) : null;
    const key = action ? `${cell}:${ctl.count}:${game.input.pointer.x | 0}:${game.input.pointer.y | 0}` : '';
    if (key === ctl.hintKey) return;
    ctl.hintKey = key;
    if (!action || action.type !== 'move') return renderHint(hintRoot, null, { left: 0, top: 0 });
    const text = game.t('move.preview', { count: action.count, cells: cellDistance(action.from, action.to), cost: costText(game.t, costOf(state, action)) });
    renderHint(hintRoot, text, toUi(game.input.pointer, { x: 14, y: 14 }));
  }

  /** The move being chosen (open move box, or a move target under the pointer), for the ghost troops. */
  function movePreview() {
    if (ctl.source === null && ctl.popup?.kind !== 'move') return null;
    const pending = ctl.popup?.kind === 'move' ? ctl.popup : null;
    const from = pending ? pending.from : /** @type {number} */ (ctl.source);
    const to = pending ? pending.to : ctl.hover.cell;
    if (to === null || (!pending && (ctl.popup?.kind === 'attack' || !ctl.hl.moves.includes(to)))) return null;
    const action = moveTo(state, from, to, ctl.count);
    return action && action.type === 'move' ? { from, to, count: action.count, player: state.current } : null;
  }

  /** @param {import('../systems/turn.js').TurnStart} start */
  function logTurnStart(start) {
    for (const p of start.eliminated) log('log.eliminated', { player: p });
    if (start.winner !== null) log('log.winner', { player: start.winner });
    else log('log.turn', { turn: state.turn, player: start.player, gold: start.gold, spawned: start.spawned });
  }

  /** @param {import('../systems/actions.js').Action} action */
  function perform(action) {
    const error = checkAction(state, action);
    if (error) {
      ctl.message = { key: error };
      return false;
    }
    const r = applyAction(state, action, game.rng);
    ctl.message = null;
    const player = r.player;
    switch (r.type) {
      case 'move':
        log('log.move', { player, count: r.count, cells: r.cells });
        game.events.emit('troops:moved');
        break;
      case 'recruit':
        log('log.recruit', { player });
        game.events.emit('troops:moved');
        break;
      case 'attack':
        log(r.attackerWins ? 'log.attack-win' : 'log.attack-lose', {
          player,
          defender: r.defender,
          mine: r.attackerTotal,
          theirs: r.defenderTotal,
          lost: r.attackerWins ? r.defenderLost : r.attackerLost
        });
        game.events.emit(r.attackerWins ? 'fight:won' : 'fight:lost', r);
        break;
      case 'build-settlement':
        log('log.build', { player });
        game.events.emit('building:changed');
        break;
      case 'move-settlement':
        log('log.move-settlement', { player });
        game.events.emit('troops:moved');
        break;
      case 'promote':
        log(r.building === 'castle' ? 'log.promote-castle' : 'log.promote-port', { player });
        game.events.emit('building:changed');
        break;
      case 'conquer':
        log('log.conquer', { player, owner: r.previousOwner });
        game.events.emit('building:changed');
        break;
      case 'port-trade':
        log('log.trade', { player, pay: r.paid });
        game.events.emit('building:changed');
        break;
      case 'exchange-gold':
        log('log.exchange', { player, resource: r.resource });
        break;
    }
    if (r.goldUsed > 0) log('log.gold-used', { player, gold: r.goldUsed });
    for (const c of r.claimed) log('log.claim', { player: c.player });
    return true;
  }

  /**
   * Select one of your cells with all its troops picked. A compact menu on the lower part of the cell
   * holds the troop count (− +) and the cell's own choices (recruit, attack inside); it never blocks
   * the neighbor cells.
   * @param {number} cell
   */
  function select(cell) {
    ctl.source = cell;
    ctl.infoCell = cell;
    ctl.count = troopsOf(state, cell, state.current);
    const own = cellChoices(state, cell, cell);
    ctl.popup = null;
    if (own.length === 0 && ctl.count < 2) return;
    const rect = cellRect(cell);
    ctl.popup = { kind: 'menu', choices: own, compact: true, count: ctl.count, max: ctl.count };
    ctl.popupAt = { x: rect.x + 4, y: rect.y + rect.h * 0.45 };
  }

  /** After a move: keep the source if troops are left there (to split them), otherwise follow the troops. */
  function afterMove(/** @type {number} */ from, /** @type {number} */ to) {
    if (troopsOf(state, from, state.current) > 0) select(from);
    else select(to);
  }

  /**
   * Show the price of moving the picked troops to `to`, with Accept. The box does not block the board:
   * another click picks another destination.
   * @param {number} from
   * @param {number} to
   */
  function openMove(from, to) {
    ctl.popup = { kind: 'move', from, to, count: ctl.count, max: sourceTroops() };
    ctl.popupAt = besideCell(to);
  }

  /** Move the picked troops (as many as fit) from `from` to `to`. */
  function confirmMove(/** @type {number} */ from, /** @type {number} */ to) {
    ctl.popup = null;
    const action = moveTo(state, from, to, ctl.count);
    if (!action) return;
    if (perform(action)) afterMove(from, to);
  }

  /** Point just right of a cell, so a box placed there leaves the cell (and its ghost troops) visible. */
  function besideCell(/** @type {number} */ cell) {
    const r = cellRect(cell);
    return { x: r.x + r.w - 12, y: r.y + 14 };
  }

  /** @param {Extract<Choice, {kind: 'attack'}>} choice */
  function openAttack(choice) {
    const defender = choice.enemies[0];
    const max = troopsOf(state, choice.from, state.current);
    ctl.popup = { ...choice, defender, count: Math.min(ctl.count, max), max, ...attackBonuses(state, choice.target, defender) };
    ctl.popupAt = besideCell(choice.target);
  }

  /** @param {Choice} choice */
  function runChoice(choice) {
    ctl.popup = null;
    if (choice.kind === 'attack') return openAttack(choice);
    if (choice.kind === 'move-settlement') {
      ctl.source = null;
      ctl.sourcePoint = choice.point;
      return;
    }
    const { action } = choice;
    if (!perform(action)) return;
    if (action.type === 'move') afterMove(action.from, action.to);
    if (action.type === 'recruit' && ctl.source !== null) select(ctl.source);
  }

  /** @param {Choice[]} choices @param {{x: number, y: number}} at */
  function openMenu(choices, at) {
    ctl.popup = { kind: 'menu', choices };
    ctl.popupAt = at;
  }

  /** @param {{cell: number | null, point: number, pointDistance: number}} hit */
  function onBoardClick(hit) {
    if (ctl.popup) {
      const pending = ctl.popup.kind === 'move' ? ctl.popup : null;
      const passive = pending || (ctl.popup.kind === 'menu' && ctl.popup.compact);
      ctl.popup = null; // a click outside the popup closes it
      if (pending && hit.cell === pending.to) return confirmMove(pending.from, pending.to); // second click on the destination accepts
      if (!passive) return; // compact and move boxes do not block the board: the click also plays
    }
    ctl.message = null;
    if (state.phase !== 'actions') {
      ctl.infoCell = hit.cell;
      return;
    }
    const circle = hit.pointDistance <= BOARD_VIEW.pointPick && ctl.hl.points.includes(hit.point) ? hit.point : null;

    if (ctl.sourcePoint !== null) {
      if (circle !== null) perform({ type: 'move-settlement', from: ctl.sourcePoint, to: circle });
      ctl.sourcePoint = null;
      return;
    }
    if (circle !== null) return openMenu(pointChoices(state, circle), pointPos(circle));

    const cell = hit.cell;
    if (cell === null) {
      ctl.source = null;
      return;
    }
    const me = state.current;
    if (cell === ctl.source) {
      ctl.source = null; // clicking the selected cell again always cancels the selection
      return;
    }
    const choices = cellChoices(state, ctl.source, cell, ctl.count);
    if (ctl.source !== null && choices.length === 1) {
      const [only] = choices;
      // The most common play, a move, needs no confirmation.
      if (only.kind === 'action' && only.action.type === 'move') return openMove(only.action.from, only.action.to);
      if (only.kind === 'attack') return openAttack(only);
    }
    if (choices.length > 0 && (ctl.source !== null || troopsOf(state, cell, me) === 0)) return openMenu(choices, cellCenter(cell));
    // Nothing to do there: select it if it has your troops, otherwise show its details.
    if (troopsOf(state, cell, me) > 0) return select(cell);
    ctl.infoCell = cell;
    ctl.source = null;
  }

  function roll() {
    if (state.phase !== 'roll') return;
    const r = rollDice(state, game.rng);
    log('log.roll', { player: state.current, a: r.dice[0], b: r.dice[1], sum: r.sum });
    if (r.rerolled.length) log('log.rerolled', { sums: r.rerolled });
    for (const g of r.gains) log('log.gain', { player: g.player, amount: g.amount, resource: g.resource });
    if (r.gains.length === 0) log('log.no-gain');
    game.events.emit('dice:rolled', r);
  }

  /** @param {import('../systems/turn.js').TurnStart} start */
  function beginTurn(start) {
    logTurnStart(start);
    if (start.winner !== null) {
      game.events.emit('game:over', { winner: start.winner });
      game.scenes.switch(game.sceneList.gameover, { winner: start.winner });
      return;
    }
    if (AUTO_ROLL) roll();
  }

  function finishTurn() {
    if (state.phase !== 'actions') return;
    clearSelection();
    ctl.infoCell = null;
    beginTurn(endTurn(state));
  }

  /** Panel and popup buttons (data-action), merged into game.actions by main.js. Each refreshes the view. */
  /** @type {Record<string, (button: HTMLElement) => void>} */
  const actions = {
    roll,
    'end-turn': finishTurn,
    exchange: (button) => {
      perform({ type: 'exchange-gold', resource: button.dataset.resource ?? '' });
    },
    choose: (button) => {
      if (ctl.popup?.kind !== 'menu') return;
      const choice = ctl.popup.choices[Number(button.dataset.index)];
      if (choice) runChoice(choice);
    },
    'move-count': (button) => {
      ctl.count += Number(button.dataset.delta);
    },
    'confirm-move': () => {
      if (ctl.popup?.kind === 'move') confirmMove(ctl.popup.from, ctl.popup.to);
    },
    count: (button) => {
      if (ctl.popup?.kind !== 'attack') return;
      ctl.popup.count = Math.max(1, Math.min(ctl.popup.max, ctl.popup.count + Number(button.dataset.delta)));
    },
    defender: (button) => {
      if (ctl.popup?.kind !== 'attack') return;
      const defender = Number(button.dataset.player);
      ctl.popup = { ...ctl.popup, defender, ...attackBonuses(state, ctl.popup.target, defender) };
    },
    cancel: () => {
      ctl.popup = null;
    },
    fight: () => {
      if (ctl.popup?.kind !== 'attack') return;
      const { from, target, defender, count } = ctl.popup;
      ctl.popup = null;
      if (perform({ type: 'attack', from, target, defender, count }) && troopsOf(state, from, state.current) > 0) select(from);
    }
  };
  for (const [name, run] of Object.entries(actions)) {
    actions[name] = (button) => {
      if (game.scenes.current?.name !== 'play') return;
      run(button);
      refresh();
    };
  }

  // The panel is built in JS, so it is redrawn when the language changes.
  game.i18n.onChange(() => {
    if (state && !panelRoot.hidden) refresh();
  });

  // Automated checks (and a remote seat) can act through window.__game.play.
  game.debug.expose('play', {
    act: (/** @type {import('../systems/actions.js').Action} */ action) => {
      const ok = perform(action);
      refresh();
      return ok ? null : ctl.message?.key;
    },
    roll: () => actions.roll(panelRoot),
    endTurn: () => actions['end-turn'](panelRoot),
    /** Click a cell, or an intersection circle when `point` is given. */
    click: (/** @type {number | null} */ cell, /** @type {number | null} */ point = null) => {
      onBoardClick({ cell, point: point ?? 0, pointDistance: point === null ? Infinity : 0 });
      refresh();
    },
    choose: (/** @type {number} */ index) => {
      const button = document.createElement('button');
      button.dataset.index = String(index);
      actions.choose(button);
    },
    setCount: (/** @type {number} */ n) => {
      ctl.count = n;
      refresh();
    },
    state: () => state
  });

  return {
    name: 'play',
    actions,
    enter(/** @type {{players?: number} | undefined} */ data) {
      playerCount = data?.players ?? playerCount;
      const created = newGame(game.rng, playerCount);
      state = created.state;
      ctl.log = [];
      ctl.infoCell = null;
      clearSelection();
      game.ui.show(null);
      panelRoot.hidden = false;
      beginTurn(created.start);
      refresh();
    },
    exit() {
      panelRoot.hidden = true;
      ctl.popup = null;
      renderPopup(popupRoot, null, { left: 0, top: 0 }, state, game.t);
      renderHint(hintRoot, null, { left: 0, top: 0 });
    },
    update() {
      const { input } = game;
      if (input.pressed('pause')) {
        if (ctl.popup || ctl.sourcePoint !== null || ctl.source !== null) {
          clearSelection();
          refresh();
        } else {
          game.scenes.push(game.sceneList.pause);
        }
        return;
      }
      const hit = hitTest(input.pointer.x, input.pointer.y);
      const circle = hit.pointDistance <= BOARD_VIEW.pointPick && ctl.hl.points.includes(hit.point) ? hit.point : null;
      ctl.hover = { cell: hit.cell, point: circle };
      // Mouse wheel: scroll up for more troops, down for fewer.
      if (input.pointer.wheel !== 0 && ctl.source !== null) {
        ctl.count -= input.pointer.wheel;
        refresh();
      }
      if (input.pointer.pressed) {
        onBoardClick(hit);
        refresh();
      }
      updateHint();
    },
    render(/** @type {CanvasRenderingContext2D} */ ctx) {
      const pending = ctl.popup?.kind === 'attack' || ctl.popup?.kind === 'move' ? ctl.popup : null;
      const targetCell = ctl.popup?.kind === 'attack' ? ctl.popup.target : ctl.popup?.kind === 'move' ? ctl.popup.to : null;
      drawBoard(ctx, state, {
        ...ctl.hl,
        preview: movePreview(),
        source: pending ? pending.from : ctl.source,
        sourcePoint: ctl.sourcePoint,
        selectedCell: targetCell ?? (ctl.infoCell !== ctl.source ? ctl.infoCell : null),
        hoverCell: ctl.hover.cell,
        hoverPoint: ctl.hover.point
      });
    },
    debugState() {
      return {
        phase: state.phase,
        current: state.current,
        turn: state.turn,
        dice: state.dice,
        source: ctl.source,
        count: ctl.count,
        popup: ctl.popup?.kind ?? null,
        message: ctl.message?.key ?? null,
        winner: state.winner,
        players: state.players.map((p) => ({ ...p.resources, eliminated: p.eliminated })),
        troops: state.players.map((p) => state.cells.reduce((s, c) => s + c.troops[p.id], 0)),
        lastLog: ctl.log.slice(-3).map((m) => formatMessage(game.t, m))
      };
    }
  };
}
