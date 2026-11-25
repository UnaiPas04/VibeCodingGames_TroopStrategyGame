// Hot-seat match: every player takes turns on the same screen.
// The rules live in systems/ (pure); this scene turns clicks into actions, keeps the log,
// emits sound events and renders the board (canvas) and the side panel (HTML).

import { LOG_LINES, WAGON } from '../config.js';
import { applyAction, attackBonuses, checkAction, portTradeOptions } from '../systems/actions.js';
import { troopsOf } from '../systems/state.js';
import { TOOLS, checkTarget, enemiesIn, isValidSource, validTargets } from '../systems/tools.js';
import { endTurn, newGame, rollDice } from '../systems/turn.js';
import { formatMessage, renderPanel } from '../ui/panel.js';
import { hitTest } from './board-layout.js';
import { drawBoard } from './board-view.js';

/** @typedef {import('../ui/panel.js').Message} Message */
/** @typedef {import('../ui/panel.js').PanelModel['form']} Form */

/** @param {import('../main.js').Game} game */
export function createPlayScene(game) {
  const panelRoot = /** @type {HTMLElement} */ (document.getElementById('panel'));
  /** @type {import('../systems/state.js').GameState} */
  let state; // created in enter()
  let playerCount = 2;

  const ctl = {
    /** @type {string | null} */ tool: null,
    /** @type {number | null} */ source: null,
    count: 1,
    /** @type {Form} */ form: null,
    /** @type {number | null} */ selectedCell: null,
    /** @type {Message | null} */ message: null,
    /** @type {Message[]} */ log: [],
    /** @type {{cell: number | null, point: number | null}} */ hover: { cell: null, point: null },
    /** @type {number[]} */ targets: []
  };

  function resetTool() {
    ctl.tool = null;
    ctl.source = null;
    ctl.form = null;
    ctl.message = null;
  }

  /** @param {string} key @param {Record<string, any>} [params] */
  function log(key, params) {
    ctl.log.push({ key, params });
    if (ctl.log.length > LOG_LINES) ctl.log.splice(0, ctl.log.length - LOG_LINES);
  }

  /** Largest value for the troop stepper with the current tool and source. */
  function countMax() {
    if (ctl.form?.kind === 'attack') return troopsOf(state, ctl.form.from, state.current);
    if (ctl.tool === 'wagon-group') return ctl.source === null ? WAGON.groupSize : Math.min(WAGON.groupSize, troopsOf(state, ctl.source, state.current));
    return 1;
  }

  const options = () => ({ count: ctl.count, defender: ctl.form?.kind === 'attack' ? ctl.form.defender : undefined });

  /** Recompute highlights and redraw the panel after any change. */
  function refresh() {
    ctl.count = Math.max(1, Math.min(ctl.count, countMax()));
    ctl.targets = ctl.tool && !ctl.form && state.phase === 'actions' ? validTargets(state, ctl.tool, ctl.source, options()) : [];
    renderPanel(panelRoot, { ...ctl, state, countMax: countMax() }, game.t);
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
      case 'wagon-group':
      case 'wagon-long':
        log('log.move', { player, count: r.count });
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

  /** @param {number} from @param {number} target */
  function openAttack(from, target) {
    const enemies = enemiesIn(state, target).filter((d) => !checkAction(state, { type: 'attack', from, target, defender: d, count: 1 }));
    const defender = enemies[0];
    ctl.form = { kind: 'attack', from, target, defender, enemies, max: troopsOf(state, from, state.current), ...attackBonuses(state, from, target, defender) };
    ctl.count = troopsOf(state, from, state.current);
  }

  /** @param {number} point */
  function openTrade(point) {
    const tradeOptions = portTradeOptions(state, point).map((pay) => ({ pay, ok: !checkAction(state, { type: 'port-trade', point, pay }) }));
    ctl.form = { kind: 'trade', point, options: tradeOptions };
  }

  /** @param {{cell: number | null, point: number | null}} hit */
  function onBoardClick(hit) {
    if (state.phase !== 'actions' || !ctl.tool || ctl.form) {
      if (!ctl.form) ctl.selectedCell = hit.cell;
      return;
    }
    const toolId = ctl.tool;
    const tool = TOOLS[toolId];
    const sourceHit = tool.source === 'settlement' ? hit.point : hit.cell;
    const id = tool.target === 'cell' ? hit.cell : hit.point;

    if (tool.source && ctl.source === null) {
      if (sourceHit !== null && isValidSource(state, toolId, sourceHit)) {
        ctl.source = sourceHit;
        ctl.message = null;
        if (toolId === 'wagon-group') ctl.count = WAGON.groupSize;
      } else ctl.message = { key: tool.source === 'troops' ? 'error.pick-your-troops' : 'error.not-your-settlement' };
      return;
    }
    if (id === null) return;
    if (tool.source && id === ctl.source && toolId !== 'attack') {
      ctl.source = null;
      return;
    }
    const error = checkTarget(state, toolId, ctl.source, id, options());
    if (error) {
      if (tool.source && sourceHit !== null && sourceHit !== ctl.source && isValidSource(state, toolId, sourceHit)) {
        ctl.source = sourceHit; // clicking another of your cells switches the source
        ctl.message = null;
      } else ctl.message = { key: error };
      return;
    }
    if (toolId === 'attack') return openAttack(/** @type {number} */ (ctl.source), id);
    if (toolId === 'trade') return openTrade(id);
    if (perform(tool.action(ctl.source, id, options()))) {
      // Keep going from where the troops (or the settlement) arrived.
      if (tool.source === 'troops') ctl.source = troopsOf(state, id, state.current) > 0 ? id : null;
      if (tool.source === 'settlement') ctl.source = id;
    }
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

  function finishTurn() {
    if (state.phase !== 'actions') return;
    resetTool();
    ctl.selectedCell = null;
    const start = endTurn(state);
    logTurnStart(start);
    if (start.winner !== null) {
      game.events.emit('game:over', { winner: state.winner });
      game.scenes.switch(game.sceneList.gameover, { winner: state.winner });
    }
  }

  /** Panel buttons (data-action), merged into game.actions by main.js. Each refreshes the panel. */
  /** @type {Record<string, (button: HTMLElement) => void>} */
  const actions = {
    roll,
    'end-turn': finishTurn,
    tool: (button) => {
      const id = button.dataset.tool ?? '';
      const same = ctl.tool === id;
      resetTool();
      if (!same && TOOLS[id]) {
        ctl.tool = id;
        ctl.selectedCell = null;
        ctl.count = id === 'wagon-group' ? WAGON.groupSize : 1;
      }
    },
    cancel: () => {
      if (ctl.form) ctl.form = null;
      else resetTool();
    },
    count: (button) => {
      ctl.count += Number(button.dataset.delta);
    },
    defender: (button) => {
      if (ctl.form?.kind !== 'attack') return;
      const defender = Number(button.dataset.player);
      ctl.form = { ...ctl.form, defender, ...attackBonuses(state, ctl.form.from, ctl.form.target, defender) };
    },
    fight: () => {
      if (ctl.form?.kind !== 'attack') return;
      const { from, target, defender } = ctl.form;
      ctl.form = null;
      perform({ type: 'attack', from, target, defender, count: ctl.count });
      ctl.source = troopsOf(state, from, state.current) > 0 ? from : null;
    },
    'trade-pay': (button) => {
      if (ctl.form?.kind !== 'trade') return;
      const option = ctl.form.options[Number(button.dataset.index)];
      const { point } = ctl.form;
      ctl.form = null;
      if (option) perform({ type: 'port-trade', point, pay: option.pay });
    },
    exchange: (button) => {
      perform({ type: 'exchange-gold', resource: button.dataset.resource ?? '' });
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
    click: (/** @type {number | null} */ cell, /** @type {number | null} */ point = null) => {
      onBoardClick({ cell, point });
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
      ctl.selectedCell = null;
      resetTool();
      logTurnStart(created.start);
      game.ui.show(null);
      panelRoot.hidden = false;
      refresh();
    },
    exit() {
      panelRoot.hidden = true;
    },
    update() {
      const { input } = game;
      if (input.pressed('pause')) {
        if (ctl.tool || ctl.form) {
          actions.cancel(panelRoot);
        } else {
          game.scenes.push(game.sceneList.pause);
        }
        return;
      }
      const hit = hitTest(input.pointer.x, input.pointer.y);
      ctl.hover = hit;
      if (input.pointer.pressed) {
        onBoardClick(hit);
        refresh();
      }
    },
    render(/** @type {CanvasRenderingContext2D} */ ctx) {
      const tool = ctl.tool ? TOOLS[ctl.tool] : null;
      drawBoard(ctx, state, {
        targetKind: tool?.target,
        targets: ctl.targets,
        sourceKind: tool?.source === 'settlement' ? 'point' : 'cell',
        source: ctl.form?.kind === 'attack' ? ctl.form.from : ctl.source,
        selectedCell: ctl.form?.kind === 'attack' ? ctl.form.target : ctl.selectedCell,
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
        tool: ctl.tool,
        source: ctl.source,
        form: ctl.form?.kind ?? null,
        message: ctl.message?.key ?? null,
        winner: state.winner,
        players: state.players.map((p) => ({ ...p.resources, eliminated: p.eliminated })),
        troops: state.players.map((p) => state.cells.reduce((s, c) => s + c.troops[p.id], 0)),
        lastLog: ctl.log.slice(-3).map((m) => formatMessage(game.t, m))
      };
    }
  };
}
