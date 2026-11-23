// Single-player demo: move the square, collect items before the timer runs out.
// The rules live in systems/match.js (shared with online play); this scene wires input, sound and HUD.

import { VIEW } from '../config.js';
import { playSfx } from '../core/sfx.js';
import { createMatch, stepMatch } from '../systems/match.js';
import { drawMatch, matchToView } from './match-view.js';

const LOCAL_ID = 'local';

/** @param {import('../main.js').Game} game */
export function createPlayScene(game) {
  const bounds = { w: VIEW.width, h: VIEW.height };
  /** @type {import('../systems/match.js').Match} */
  let match; // created in enter()
  /** @type {Map<string, {x: number, y: number}>} */
  const inputs = new Map();
  let shownTime = -1;

  return {
    name: 'play',
    enter() {
      match = createMatch({ players: [{ id: LOCAL_ID, name: 'You' }], rng: game.rng, bounds });
      shownTime = -1;
      game.ui.show(null);
      game.ui.hud(true);
      game.ui.set('score', 0);
    },
    exit() {
      game.ui.hud(false);
    },
    update(/** @type {number} */ dt) {
      const { input } = game;
      if (input.pressed('pause')) {
        game.scenes.push(game.sceneList.pause);
        return;
      }
      inputs.set(LOCAL_ID, { x: input.axis('left', 'right', 'x'), y: input.axis('up', 'down', 'y') });
      const { collected } = stepMatch(match, inputs, dt);

      const me = match.players[0];
      if (collected.length > 0) {
        game.ui.set('score', me.score);
        game.events.emit('item:collected', { score: me.score });
        playSfx(game.audio, 'coin');
      }
      const seconds = Math.ceil(match.timeLeft);
      if (seconds !== shownTime) game.ui.set('time', (shownTime = seconds));

      if (match.ended) {
        playSfx(game.audio, 'lose');
        game.scenes.switch(game.sceneList.gameover, { score: me.score });
      }
    },
    render(/** @type {CanvasRenderingContext2D} */ ctx) {
      drawMatch(ctx, matchToView(match), game.debug);
    },
    debugState() {
      const { body, score } = match.players[0];
      return {
        player: { x: Math.round(body.x), y: Math.round(body.y) },
        score,
        timeLeft: Number(match.timeLeft.toFixed(2)),
        items: match.items.length
      };
    }
  };
}
