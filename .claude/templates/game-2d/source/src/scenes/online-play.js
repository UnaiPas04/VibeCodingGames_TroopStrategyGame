// Online demo: every player moves their own square and sees the others.
// Pattern used here: each client owns its avatar and sends its position as binary at NET.sendHz;
// receivers smooth towards the latest position. For games with shared rules (collisions between
// players, score, enemies) use the host-authoritative pattern from the p2p-rooms skill instead.

import { PLAYER, VIEW } from '../config.js';
import { damp } from '../core/math.js';
import { createPlayer, updatePlayer } from '../entities/player.js';
import { NET, session } from '../net/session.js';

/** @param {import('../main.js').Game} game */
export function createOnlinePlayScene(game) {
  const bounds = { w: VIEW.width, h: VIEW.height };
  let me = createPlayer(0, 0, PLAYER.size);
  /** @type {Map<string, {x: number, y: number, tx: number, ty: number}>} */
  const others = new Map();
  const packet = new Float32Array(2);
  let sendTimer = 0;
  let leaving = false;
  const hud = /** @type {HTMLElement} */ (document.querySelector('[data-net-hud]'));

  return {
    name: 'online',
    enter() {
      const room = session.room;
      if (!room) {
        game.scenes.switch(game.sceneList.lobby);
        return;
      }
      leaving = false;
      others.clear();
      const seat = Math.max(0, room.players.findIndex((p) => p.id === room.selfId));
      me = createPlayer(20 + seat * 40, bounds.h / 2, PLAYER.size);
      game.ui.show(null);
      hud.hidden = false;
      game.ui.set('net-room', room.code);
      game.ui.set('net-players', room.players.length);
      room.onBinary((bytes, from) => {
        if (bytes.byteLength < 8) return;
        const [x, y] = new Float32Array(bytes.buffer, bytes.byteOffset, 2);
        const o = others.get(from);
        if (o) Object.assign(o, { tx: x, ty: y });
        else others.set(from, { x, y, tx: x, ty: y });
      });
      room.onRoster((players) => {
        game.ui.set('net-players', players.length);
        for (const id of others.keys()) if (!players.some((p) => p.id === id)) others.delete(id);
      });
    },
    exit() {
      hud.hidden = true;
      // Leaving the match (Escape or main menu) leaves the room too.
      if (leaving && session.room) {
        const room = session.room;
        session.room = null;
        room.leave();
      }
    },
    update(/** @type {number} */ dt) {
      const { input } = game;
      const room = session.room;
      if (!room) return;
      if (input.pressed('pause')) {
        leaving = true;
        game.scenes.switch(game.sceneList.lobby);
        return;
      }
      const dir = { x: input.axis('left', 'right', 'x'), y: input.axis('up', 'down', 'y') };
      updatePlayer(me, dir, PLAYER, bounds, dt);

      sendTimer -= dt;
      if (sendTimer <= 0) {
        sendTimer = 1 / NET.sendHz;
        packet[0] = me.x;
        packet[1] = me.y;
        room.sendBinary(packet);
      }
      for (const o of others.values()) {
        o.x = damp(o.x, o.tx, 15, dt);
        o.y = damp(o.y, o.ty, 15, dt);
      }
    },
    render(/** @type {CanvasRenderingContext2D} */ ctx) {
      ctx.fillStyle = VIEW.background;
      ctx.fillRect(0, 0, bounds.w, bounds.h);
      const room = session.room;
      for (const [id, o] of others) {
        ctx.fillStyle = room?.players.find((p) => p.id === id)?.color ?? '#ffffff';
        ctx.fillRect(Math.round(o.x), Math.round(o.y), PLAYER.size, PLAYER.size);
      }
      ctx.fillStyle = room?.players.find((p) => p.id === room.selfId)?.color ?? PLAYER.color;
      ctx.fillRect(Math.round(me.x), Math.round(me.y), PLAYER.size, PLAYER.size);
      game.debug.setEntityCount(others.size + 1);
    },
    debugState: () => ({
      room: session.room?.code ?? null,
      isHost: session.room?.isHost ?? false,
      me: { x: Math.round(me.x), y: Math.round(me.y) },
      others: [...others.entries()].map(([id, o]) => ({ id, x: Math.round(o.x), y: Math.round(o.y) }))
    })
  };
}
