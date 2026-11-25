// Menu scenes (title, pause, game over). Their UI is HTML in index.html; these scenes
// only pick the screen, draw a background and handle gamepad navigation (ui.navigate).

import { PLAYERS, VIEW } from '../config.js';
import { playerName } from '../ui/panel.js';

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
      game.ui.show('title');
    },
    update() {
      game.ui.navigate(game.input);
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
      game.ui.navigate(game.input);
    },
    render(/** @type {CanvasRenderingContext2D} */ ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  };
}

/** @param {import('../main.js').Game} game */
export function createGameOverScene(game) {
  /** @type {number | null} */
  let winner = null;
  const showWinner = () => game.ui.set('winner', game.t('log.winner', { player: playerName(game.t, winner) }));
  game.i18n.onChange(() => {
    if (game.scenes.current?.name === 'gameover') showWinner();
  });
  return {
    name: 'gameover',
    enter(/** @type {{winner: number | null}} */ data) {
      winner = data?.winner ?? null;
      showWinner();
      const banner = document.querySelector('[data-screen="gameover"]');
      if (banner instanceof HTMLElement) banner.style.setProperty('--player', winner === null ? PLAYERS.grey : PLAYERS.colors[winner]);
      game.ui.show('gameover');
    },
    update() {
      game.ui.navigate(game.input);
    },
    render: clear,
    debugState: () => ({ winner })
  };
}
