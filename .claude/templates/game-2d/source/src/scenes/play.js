// Demo gameplay: move the square, collect items before the timer runs out.

import { ITEMS, PLAYER, ROUND_SECONDS, VIEW } from '../config.js';
import { playSfx } from '../core/sfx.js';
import { createPlayer, updatePlayer } from '../entities/player.js';
import { collectItems, spawnItem } from '../systems/items.js';

/** @param {import('../main.js').Game} game */
export function createPlayScene(game) {
  const bounds = { w: VIEW.width, h: VIEW.height };
  let player = createPlayer(0, 0, PLAYER.size);
  /** @type {import('../systems/items.js').Item[]} */
  let items = [];
  let score = 0;
  let timeLeft = ROUND_SECONDS;

  const respawn = () => spawnItem(game.rng, ITEMS.size, bounds);

  return {
    name: 'play',
    enter() {
      player = createPlayer((bounds.w - PLAYER.size) / 2, (bounds.h - PLAYER.size) / 2, PLAYER.size);
      items = Array.from({ length: ITEMS.count }, respawn);
      score = 0;
      timeLeft = ROUND_SECONDS;
      game.ui.show(null);
      game.ui.hud(true);
      game.ui.set('score', score);
      game.ui.set('time', Math.ceil(timeLeft));
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
      const dir = { x: input.axis('left', 'right', 'x'), y: input.axis('up', 'down', 'y') };
      updatePlayer(player, dir, PLAYER, bounds, dt);

      const collected = collectItems(items, player, respawn);
      if (collected > 0) {
        score += collected;
        game.ui.set('score', score);
        game.events.emit('item:collected', { score });
        playSfx(game.audio, 'coin');
      }

      const before = Math.ceil(timeLeft);
      timeLeft -= dt;
      if (Math.ceil(timeLeft) !== before) game.ui.set('time', Math.max(0, Math.ceil(timeLeft)));
      if (timeLeft <= 0) {
        playSfx(game.audio, 'lose');
        game.scenes.switch(game.sceneList.gameover, { score });
      }
    },
    render(/** @type {CanvasRenderingContext2D} */ ctx) {
      ctx.fillStyle = VIEW.background;
      ctx.fillRect(0, 0, bounds.w, bounds.h);
      ctx.fillStyle = ITEMS.color;
      for (const item of items) ctx.fillRect(Math.round(item.x), Math.round(item.y), item.w, item.h);
      ctx.fillStyle = PLAYER.color;
      ctx.fillRect(Math.round(player.x), Math.round(player.y), player.w, player.h);
      game.debug.box(ctx, player);
      for (const item of items) game.debug.box(ctx, item, '#00ffff');
      game.debug.setEntityCount(items.length + 1);
    },
    debugState() {
      return {
        player: { x: Math.round(player.x), y: Math.round(player.y) },
        score,
        timeLeft: Math.max(0, Number(timeLeft.toFixed(2))),
        items: items.length
      };
    }
  };
}
