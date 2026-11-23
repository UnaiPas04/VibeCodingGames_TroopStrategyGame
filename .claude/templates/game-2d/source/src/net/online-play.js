// Online demo match, host-authoritative:
// - the host runs systems/match.js (movement, pushing, items, score, timer) with everyone's input
//   and broadcasts binary snapshots at NET.sendHz;
// - guests send only their input when it changes, and draw the snapshots smoothly.
// Everyone builds the same match from the host's seed and player order, so guests can use it as
// their display model. Esc leaves the room.

import { ITEMS, VIEW } from '../config.js';
import { clamp, damp } from '../core/math.js';
import { createRng } from '../core/rng.js';
import { drawMatch, matchToView } from '../scenes/match-view.js';
import { createMatch, ranking, stepMatch } from '../systems/match.js';
import { NET, leaveRoom, session } from './session.js';
import { decodeSnapshot, encodeSnapshot } from './snapshot.js';

/** @typedef {{seed: number, order: string[]}} StartData */

/** @param {import('../main.js').Game} game */
export function createOnlinePlayScene(game) {
  const bounds = { w: VIEW.width, h: VIEW.height };
  const hud = /** @type {HTMLElement} */ (document.querySelector('[data-net-hud]'));
  const scoreList = /** @type {HTMLElement} */ (hud.querySelector('[data-net-scores]'));

  /** @type {import('./room.js').Room} */ let room;
  /** @type {import('../systems/match.js').Match} */ let match;
  /** @type {Map<string, {x: number, y: number}>} Host: latest input per player. */
  const inputs = new Map();
  /** @type {{x: number, y: number}[]} Guests: latest snapshot position per player slot. */
  let targets = [];
  /** @type {(() => void)[]} */ let unsubscribe = [];
  let tick = 0;
  let lastTick = -1;
  let sendTimer = 0;
  let sentInput = { x: 0, y: 0 };
  let hudKey = '';
  let finished = false;

  /** @param {ReturnType<typeof ranking>} results */
  function finish(results) {
    if (finished) return;
    finished = true;
    game.events.emit('round:over', { ranking: results });
    game.scenes.switch(game.sceneList.results, { ranking: results });
  }

  /**
   * Guests: apply a snapshot from the host.
   * @param {import('./snapshot.js').Snapshot} snap
   */
  function applySnapshot(snap) {
    if (snap.tick <= lastTick) return; // out of date
    lastTick = snap.tick;
    match.timeLeft = snap.timeLeft;
    snap.players.forEach((s, i) => {
      const p = match.players[i];
      if (!p) return;
      if (p.id === room.selfId && s.score > p.score) game.events.emit('item:collected', { score: s.score });
      p.score = s.score;
      targets[i] = { x: s.x, y: s.y };
    });
    match.items = snap.items.map((it) => ({ x: it.x, y: it.y, w: ITEMS.size, h: ITEMS.size }));
  }

  function updateHud() {
    const time = Math.ceil(match.timeLeft);
    const key = `${time}|${match.players.map((p) => p.score).join(',')}`;
    if (key === hudKey) return;
    hudKey = key;
    game.ui.set('net-time', time);
    scoreList.replaceChildren(
      ...match.players.map((p) => {
        const li = document.createElement('li');
        li.style.setProperty('--player', p.color);
        li.textContent = `${p.id === room.selfId ? game.t('net.player-you', { name: p.name }) : p.name}: ${p.score}`;
        return li;
      })
    );
  }

  return {
    name: 'online',
    /** @param {StartData} data */
    enter(data) {
      const current = session.room;
      if (!current || !data?.order) {
        game.scenes.switch(game.sceneList.lobby);
        return;
      }
      room = current;
      finished = false;
      tick = 0;
      lastTick = -1;
      sendTimer = 0;
      sentInput = { x: 0, y: 0 };
      hudKey = '';
      inputs.clear();
      const players = data.order.map((id) => {
        const p = room.players.find((q) => q.id === id);
        return { id, name: p?.name, color: p?.color };
      });
      match = createMatch({ players, rng: createRng(data.seed), bounds });
      targets = match.players.map((p) => ({ x: p.body.x, y: p.body.y }));

      if (room.isHost) {
        unsubscribe.push(
          room.on('input', (d, from) => inputs.set(from, { x: clamp(Number(d?.x) || 0, -1, 1), y: clamp(Number(d?.y) || 0, -1, 1) }))
        );
      } else {
        unsubscribe.push(room.onBinary((bytes, from) => from === room.hostId && applySnapshot(decodeSnapshot(bytes))));
        unsubscribe.push(room.on('end', (d, from) => from === room.hostId && finish(d.ranking)));
      }
      game.ui.show(null);
      hud.hidden = false;
      updateHud();
    },
    exit() {
      unsubscribe.forEach((off) => off());
      unsubscribe = [];
      hud.hidden = true;
    },
    update(/** @type {number} */ dt) {
      const { input } = game;
      if (input.pressed('pause')) {
        leaveRoom();
        game.scenes.switch(game.sceneList.lobby);
        return;
      }
      const dir = { x: input.axis('left', 'right', 'x'), y: input.axis('up', 'down', 'y') };

      if (room.isHost) {
        inputs.set(room.selfId, dir);
        const { collected } = stepMatch(match, inputs, dt);
        if (collected.includes(room.selfId)) game.events.emit('item:collected', { score: match.players.find((p) => p.id === room.selfId)?.score });
        sendTimer -= dt;
        if (sendTimer <= 0 || match.ended) {
          sendTimer = 1 / NET.sendHz;
          room.sendBinary(encodeSnapshot(match, ++tick));
        }
        if (match.ended) {
          const results = ranking(match);
          room.send('end', { ranking: results });
          finish(results);
          return;
        }
      } else {
        if (dir.x !== sentInput.x || dir.y !== sentInput.y) {
          sentInput = dir;
          room.send('input', dir, room.hostId);
        }
        match.players.forEach((p, i) => {
          const t = targets[i];
          p.body.x = damp(p.body.x, t.x, NET.smoothing, dt);
          p.body.y = damp(p.body.y, t.y, NET.smoothing, dt);
        });
      }
      updateHud();
    },
    render(/** @type {CanvasRenderingContext2D} */ ctx) {
      drawMatch(ctx, matchToView(match), game.debug);
    },
    debugState: () => ({
      room: session.room?.code ?? null,
      isHost: session.room?.isHost ?? false,
      timeLeft: match ? Number(match.timeLeft.toFixed(2)) : null,
      players: match?.players.map((p) => ({ name: p.name, score: p.score, x: Math.round(p.body.x), y: Math.round(p.body.y) })) ?? []
    })
  };
}
