// Hot-seat match: every player takes turns on the same screen.
// Plays need as few clicks as possible: click one of your cells, then a highlighted cell (cart next to it,
// horse 2 steps away, red = attack); click an intersection circle to build. Choices open in a popup
// next to the click. The rules live in systems/ (pure); this scene wires input, log, sounds and drawing.

import { AUTO_ROLL, BOARD_VIEW, LOG_LINES, VIEW } from '../config.js';
import { applyAction, attackBonuses, checkAction } from '../systems/actions.js';
import { activePoints, cellChoices, moveTypeFor, pointChoices, settlementDestinations, sourceTargets } from '../systems/choices.js';
import { troopsOf } from '../systems/state.js';
import { endTurn, newGame, rollDice } from '../systems/turn.js';
import { formatMessage, renderPanel } from '../ui/panel.js';
import { renderPopup } from '../ui/popup.js';
import { cellCenter, hitTest, pointPos } from './board-layout.js';
import { drawBoard } from './board-view.js';

/** @typedef {import('../ui/panel.js').Message} Message */
/** @typedef {import('../systems/choices.js').Choice} Choice */

/** @param {import('../main.js').Game} game */
export function createPlayScene(game) {
  const panelRoot = /** @type {HTMLElement} */ (document.getElementById('panel'));
  const popupRoot = /** @type {HTMLElement} */ (document.getElementById('popup'));
  /** @type {import('../systems/state.js').GameState} */
  let state; // created in enter()
  let playerCount = 2;

  /** No highlights. */
  const noHighlights = () => ({ moves: /** @type {number[]} */ ([]), farMoves: /** @type {number[]} */ ([]), attacks: /** @type {number[]} */ ([]), points: /** @type {number[]} */ ([]) });

  const ctl = {
    /** Selected cell with your troops. @type {number | null} */ source: null,
    /** Settlement being moved. @type {number | null} */ sourcePoint: null,
    /** @type {import('../ui/popup.js').PopupModel | null} */ popup: null,
    /** Game position the popup points at. */ popupAt: { x: 0, y: 0 },
    /** @type {number | null} */ infoCell: null,
    /** @type {Message | null} */ message: null,
    /** @type {Message[]} */ log: [],
    /** @type {{cell: number | null, point: number | null}} */ hover: { cell: null, point: null },
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

  /** Position inside #ui (CSS pixels) of a point in game units, just right of it. */
  function toUi(/** @type {{x: number, y: number}} */ g) {
    const canvas = game.view.canvas.getBoundingClientRect();
    const ui = /** @type {HTMLElement} */ (popupRoot.parentElement).getBoundingClientRect();
    return {
      left: canvas.left - ui.left + (g.x / VIEW.width) * canvas.width + 16,
      top: canvas.top - ui.top + (g.y / VIEW.height) * canvas.height - 16
    };
  }

  /** Recompute highlights and redraw the panel and the popup after any change. */
  function refresh() {
    const acting = state.phase === 'actions';
    ctl.hl = noHighlights();
    if (acting) {
      ctl.hl.points = ctl.sourcePoint !== null ? settlementDestinations(state, ctl.sourcePoint) : activePoints(state);
      if (ctl.source !== null) {
        const targets = sourceTargets(state, ctl.source);
        ctl.hl.attacks = targets.attacks;
        for (const cell of targets.moves) (moveTypeFor(ctl.source, cell) === 'cart' ? ctl.hl.moves : ctl.hl.farMoves).push(cell);
      }
    }
    renderPanel(panelRoot, { state, infoCell: ctl.infoCell, message: ctl.message, log: ctl.log }, game.t);
    renderPopup(popupRoot, ctl.popup, toUi(ctl.popupAt), state, game.t);
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
      case 'cart':
      case 'horse':
        log(r.type === 'cart' ? 'log.cart' : 'log.horse', { player, count: r.count });
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

  /** Keep the selection on the cell the troops arrived at (or drop it if none of yours are left there). */
  function followTo(/** @type {number} */ cell) {
    ctl.source = troopsOf(state, cell, state.current) > 0 ? cell : null;
    ctl.infoCell = cell;
  }

  /** @param {Extract<Choice, {kind: 'attack'}>} choice */
  function openAttack(choice) {
    const defender = choice.enemies[0];
    const max = troopsOf(state, choice.from, state.current);
    ctl.popup = { ...choice, defender, count: max, max, ...attackBonuses(state, choice.from, choice.target, defender) };
    ctl.popupAt = cellCenter(choice.target);
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
    if (action.type === 'cart' || action.type === 'horse') followTo(action.to);
  }

  /** @param {Choice[]} choices @param {{x: number, y: number}} at */
  function openMenu(choices, at) {
    ctl.popup = { kind: 'menu', choices };
    ctl.popupAt = at;
  }

  /** @param {{cell: number | null, point: number, pointDistance: number}} hit */
  function onBoardClick(hit) {
    if (ctl.popup) {
      ctl.popup = null; // a click outside the popup closes it
      return;
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
    const choices = cellChoices(state, ctl.source, cell);
    if (ctl.source !== null && choices.length === 1) {
      const [only] = choices;
      // The most common play, a move, needs no confirmation.
      if (only.kind === 'action' && (only.action.type === 'cart' || only.action.type === 'horse')) return runChoice(only);
      if (only.kind === 'attack') return openAttack(only);
    }
    if (choices.length > 0 && (ctl.source !== null || troopsOf(state, cell, me) === 0)) return openMenu(choices, cellCenter(cell));
    // Nothing to do there: select it if it has your troops, otherwise show its details.
    ctl.infoCell = cell;
    ctl.source = troopsOf(state, cell, me) > 0 && cell !== ctl.source ? cell : null;
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
    count: (button) => {
      if (ctl.popup?.kind !== 'attack') return;
      ctl.popup.count = Math.max(1, Math.min(ctl.popup.max, ctl.popup.count + Number(button.dataset.delta)));
    },
    defender: (button) => {
      if (ctl.popup?.kind !== 'attack') return;
      const defender = Number(button.dataset.player);
      ctl.popup = { ...ctl.popup, defender, ...attackBonuses(state, ctl.popup.from, ctl.popup.target, defender) };
    },
    fight: () => {
      if (ctl.popup?.kind !== 'attack') return;
      const { from, target, defender, count } = ctl.popup;
      ctl.popup = null;
      if (perform({ type: 'attack', from, target, defender, count })) followTo(from);
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
      if (input.pointer.pressed) {
        onBoardClick(hit);
        refresh();
      }
    },
    render(/** @type {CanvasRenderingContext2D} */ ctx) {
      const attack = ctl.popup?.kind === 'attack' ? ctl.popup : null;
      drawBoard(ctx, state, {
        ...ctl.hl,
        source: attack ? attack.from : ctl.source,
        sourcePoint: ctl.sourcePoint,
        selectedCell: attack ? attack.target : ctl.infoCell !== ctl.source ? ctl.infoCell : null,
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
