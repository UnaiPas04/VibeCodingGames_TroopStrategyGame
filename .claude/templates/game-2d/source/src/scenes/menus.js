// Menu scenes (title, pause, game over). Their UI is HTML in index.html; these scenes
// only pick the screen, draw a background and handle gamepad navigation.

import { VIEW } from '../config.js';

/**
 * Gamepad support for DOM menus: d-pad moves focus, A clicks the focused button.
 * The keyboard already works natively (Tab/arrows via ui.js, Enter/Space on buttons).
 * @param {import('../main.js').Game} game
 */
function navigateWithPad(game) {
  const { input } = game;
  const key = input.padPressed('down') ? 'ArrowDown' : input.padPressed('up') ? 'ArrowUp' : null;
  if (key) window.dispatchEvent(new KeyboardEvent('keydown', { code: key }));
  if (input.padPressed('confirm') && document.activeElement instanceof HTMLButtonElement) {
    document.activeElement.click();
  }
}

/** @param {CanvasRenderingContext2D} ctx */
function clear(ctx) {
  ctx.fillStyle = VIEW.background;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

/** @param {import('../main.js').Game} game */
export function createTitleScene(game) {
  return {
    name: 'title',
    enter() {
      game.ui.set('best', game.storage.get('best', 0));
      game.ui.show('title');
    },
    update() {
      navigateWithPad(game);
    },
    render: clear
  };
}

/** @param {import('../main.js').Game} game */
export function createPauseScene(game) {
  return {
    name: 'pause',
    enter() {
      game.ui.show('pause');
    },
    exit() {
      game.ui.show(null);
    },
    update() {
      if (game.input.pressed('pause')) {
        game.scenes.pop();
        return;
      }
      navigateWithPad(game);
    },
    render(/** @type {CanvasRenderingContext2D} */ ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  };
}

/** @param {import('../main.js').Game} game */
export function createGameOverScene(game) {
  let score = 0;
  return {
    name: 'gameover',
    enter(/** @type {{score: number}} */ data) {
      score = data?.score ?? 0;
      const best = Math.max(score, game.storage.get('best', 0));
      game.storage.set('best', best);
      game.ui.set('final-score', score);
      game.ui.set('best', best);
      game.ui.show('gameover');
    },
    update() {
      navigateWithPad(game);
    },
    render: clear,
    debugState: () => ({ score })
  };
}
