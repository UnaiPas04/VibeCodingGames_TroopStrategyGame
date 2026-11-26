// Hot-seat match: every player takes turns on the same screen.
// Plays need as few clicks as possible. Setup: each player clicks a free intersection to place their
// castle (or port on the coast). Then, each turn: the dice roll automatically; click a road slot (middle
// of a cell side) to build a road, or an intersection circle to build a settlement (one click), promote,
// trade or move a settlement (a menu next to the click). The rules live in systems/ (pure); this scene
// wires input, log, sounds and drawing.

import { AUTO_ROLL, BOARD_VIEW, LOG_LINES, VIEW } from '../config.js';
import { applyAction, bigBuildingAt, checkAction } from '../systems/actions.js';
import { activePoints, pointChoices, roadSlots, settlementDestinations } from '../systems/choices.js';
import { endTurn, newGame, placeStart, rollDice } from '../systems/turn.js';
import { formatMessage, renderPanel } from '../ui/panel.js';
import { describeChoice, renderHint, renderPopup } from '../ui/popup.js';
import { hitTest, pointPos } from './board-layout.js';
import { drawBoard } from './board-view.js';

/** @typedef {import('../ui/panel.js').Message} Message */
/** @typedef {import('../systems/choices.js').Choice} Choice */
/** @typedef {import('../systems/actions.js').Action} Action */

/** Choices a single click plays without a menu (cheap and common). */
const DIRECT = ['place-start', 'build-settlement'];

/** @param {import('../main.js').Game} game */
export function createPlayScene(game) {
  const panelRoot = /** @type {HTMLElement} */ (document.getElementById('panel'));
  const popupRoot = /** @type {HTMLElement} */ (document.getElementById('popup'));
  const hintRoot = /** @type {HTMLElement} */ (document.getElementById('hint'));
  /** @type {import('../systems/state.js').GameState} */
  let state; // created in enter()
  let playerCount = 2;

  const ctl = {
    /** Settlement being moved. @type {number | null} */ sourcePoint: null,
    /** @type {import('../ui/popup.js').PopupModel | null} */ popup: null,
    /** Game position the popup points at. */ popupAt: { x: 0, y: 0 },
    /** @type {number | null} */ infoCell: null,
    /** @type {Message | null} */ message: null,
    /** @type {Message[]} */ log: [],
    /** What is under the pointer. @type {{cell: number | null, point: number | null, road: number | null}} */
    hover: { cell: null, point: null, road: null },
    /** Last hint shown, to update it only when it changes. */ hintKey: '',
    /** Clickable intersections and road slots. */
    hl: { points: /** @type {number[]} */ ([]), roads: /** @type {number[]} */ ([]) }
  };

  function clearSelection() {
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

  /** Recompute highlights and redraw the panel and the popup after any change. */
  function refresh() {
    ctl.hl.points = ctl.sourcePoint !== null ? settlementDestinations(state, ctl.sourcePoint) : activePoints(state);
    ctl.hl.roads = ctl.sourcePoint !== null ? [] : roadSlots(state);
    renderPanel(panelRoot, { state, infoCell: ctl.infoCell, message: ctl.message, log: ctl.log }, game.t);
    renderPopup(popupRoot, ctl.popup, toUi(ctl.popupAt, { x: 16, y: -16 }), game.t);
    ctl.hintKey = '-'; // force the hint to refresh (or hide) on the next update
  }

  /** The action a click on the hovered circle or road slot plays at once, if any. @returns {Action | null} */
  function directAction() {
    if (ctl.popup || ctl.sourcePoint !== null) return null;
    if (ctl.hover.road !== null) return { type: 'build-road', edge: ctl.hover.road };
    if (ctl.hover.point === null) return null;
    const choices = pointChoices(state, ctl.hover.point);
    const [only] = choices;
    return choices.length === 1 && only.kind === 'action' && DIRECT.includes(only.action.type) ? only.action : null;
  }

  /** Small text next to the pointer: what a click there does, and its cost. */
  function updateHint() {
    const action = directAction();
    const key = action ? `${JSON.stringify(action)}:${game.input.pointer.x | 0}:${game.input.pointer.y | 0}` : '';
    if (key === ctl.hintKey) return;
    ctl.hintKey = key;
    if (!action) return renderHint(hintRoot, null, { left: 0, top: 0 });
    const { label, cost } = describeChoice(game.t, { kind: 'action', action });
    renderHint(hintRoot, `${label} · ${cost}`, toUi(game.input.pointer, { x: 14, y: 14 }));
  }

  /** @param {Action} action */
  function perform(action) {
    const error = checkAction(state, action);
    if (error) {
      ctl.message = { key: error };
      return false;
    }
    const r = action.type === 'place-start' ? placeStart(state, action.point) : applyAction(state, action);
    ctl.message = null;
    const player = r.player;
    switch (r.type) {
      case 'place-start':
        log('log.start', { player, building: r.building });
        game.events.emit('building:changed');
        if (r.setupDone) beginTurn();
        break;
      case 'build-road':
        log('log.road', { player });
        game.events.emit('road:built');
        break;
      case 'build-settlement':
        log('log.build', { player });
        game.events.emit('building:changed');
        break;
      case 'move-settlement':
        log(r.previousRoadOwner === player ? 'log.move-settlement' : 'log.move-settlement-road', { player, owner: r.previousRoadOwner });
        game.events.emit('building:changed');
        break;
      case 'promote':
        log('log.promote', { player, building: r.building });
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
    return true;
  }

  /** @param {Choice} choice */
  function runChoice(choice) {
    ctl.popup = null;
    if (choice.kind === 'move-settlement') {
      ctl.sourcePoint = choice.point;
      return;
    }
    perform(choice.action);
  }

  /** @param {ReturnType<typeof hitTest>} hit */
  function onBoardClick(hit) {
    if (ctl.popup) {
      ctl.popup = null; // a click outside the popup only closes it
      return;
    }
    ctl.message = null;
    const circle = hit.pointDistance <= BOARD_VIEW.pointPick && ctl.hl.points.includes(hit.point) ? hit.point : null;
    if (ctl.sourcePoint !== null) {
      if (circle !== null) perform({ type: 'move-settlement', from: ctl.sourcePoint, to: circle });
      ctl.sourcePoint = null;
      return;
    }
    if (circle !== null) {
      const choices = pointChoices(state, circle);
      const [only] = choices;
      if (choices.length === 1 && only.kind === 'action' && DIRECT.includes(only.action.type)) return void perform(only.action);
      ctl.popup = { kind: 'menu', choices };
      ctl.popupAt = pointPos(circle);
      return;
    }
    const road = hit.edgeDistance <= BOARD_VIEW.edgePick && ctl.hl.roads.includes(hit.edge) ? hit.edge : null;
    if (road !== null) return void perform({ type: 'build-road', edge: road });
    ctl.infoCell = hit.cell === ctl.infoCell ? null : hit.cell;
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

  function beginTurn() {
    log('log.turn', { turn: state.turn, player: state.current });
    if (AUTO_ROLL) roll();
  }

  function finishTurn() {
    if (state.phase !== 'actions') return;
    clearSelection();
    ctl.infoCell = null;
    endTurn(state);
    beginTurn();
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
    cancel: () => {
      ctl.popup = null;
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

  /** A fake hit on an intersection, a road slot or a cell, for automated checks. */
  const fakeHit = (/** @type {{point?: number, edge?: number, cell?: number}} */ at) => ({
    cell: at.cell ?? null,
    point: at.point ?? 0,
    pointDistance: at.point === undefined ? Infinity : 0,
    edge: at.edge ?? 0,
    edgeDistance: at.edge === undefined ? Infinity : 0
  });

  // Automated checks (and a remote seat) can act through window.__game.play.
  game.debug.expose('play', {
    act: (/** @type {Action} */ action) => {
      const ok = perform(action);
      refresh();
      return ok ? null : ctl.message?.key;
    },
    roll: () => actions.roll(panelRoot),
    endTurn: () => actions['end-turn'](panelRoot),
    /** Click an intersection ({point}), a road slot ({edge}) or a cell ({cell}). */
    click: (/** @type {{point?: number, edge?: number, cell?: number}} */ at) => {
      onBoardClick(fakeHit(at));
      refresh();
    },
    choose: (/** @type {number} */ index) => {
      const button = document.createElement('button');
      button.dataset.index = String(index);
      actions.choose(button);
    },
    state: () => state
  });

  return {
    name: 'play',
    actions,
    enter(/** @type {{players?: number} | undefined} */ data) {
      playerCount = data?.players ?? playerCount;
      state = newGame(game.rng, playerCount);
      ctl.log = [];
      ctl.infoCell = null;
      clearSelection();
      game.ui.show(null);
      panelRoot.hidden = false;
      log('log.setup');
      refresh();
    },
    exit() {
      panelRoot.hidden = true;
      ctl.popup = null;
      renderPopup(popupRoot, null, { left: 0, top: 0 }, game.t);
      renderHint(hintRoot, null, { left: 0, top: 0 });
    },
    update() {
      const { input } = game;
      if (input.pressed('pause')) {
        if (ctl.popup || ctl.sourcePoint !== null) {
          clearSelection();
          refresh();
        } else {
          game.scenes.push(game.sceneList.pause);
        }
        return;
      }
      const hit = hitTest(input.pointer.x, input.pointer.y);
      const point = hit.pointDistance <= BOARD_VIEW.pointPick && ctl.hl.points.includes(hit.point) ? hit.point : null;
      const road = point === null && hit.edgeDistance <= BOARD_VIEW.edgePick && ctl.hl.roads.includes(hit.edge) ? hit.edge : null;
      ctl.hover = { cell: hit.cell, point, road };
      if (input.pointer.pressed) {
        onBoardClick(hit);
        refresh();
      }
      updateHint();
    },
    render(/** @type {CanvasRenderingContext2D} */ ctx) {
      const direct = directAction();
      const ghost =
        direct && (direct.type === 'place-start' || direct.type === 'build-settlement')
          ? { point: direct.point, type: direct.type === 'place-start' ? bigBuildingAt(direct.point) : /** @type {const} */ ('settlement') }
          : null;
      drawBoard(ctx, state, {
        ...ctl.hl,
        sourcePoint: ctl.sourcePoint,
        selectedCell: ctl.infoCell,
        hoverCell: ctl.hover.cell,
        hoverPoint: ctl.hover.point,
        hoverRoad: ctl.hover.road,
        ghost
      });
    },
    debugState() {
      return {
        phase: state.phase,
        current: state.current,
        turn: state.turn,
        dice: state.dice,
        popup: ctl.popup?.kind ?? null,
        message: ctl.message?.key ?? null,
        players: state.players.map((p) => ({ ...p.resources })),
        buildings: Object.keys(state.buildings).length,
        roads: Object.keys(state.roads).length,
        lastLog: ctl.log.slice(-3).map((m) => formatMessage(game.t, m))
      };
    }
  };
}
