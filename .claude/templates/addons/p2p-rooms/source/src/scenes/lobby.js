// Lobby: create or join a room, share the invite link, mark ready, host starts the match.

import { VIEW } from '../config.js';
import { createRoom, joinRoom } from '../net/room.js';
import { APP_ID, NET, session } from '../net/session.js';

const MESSAGES = {
  'room-full': 'That room is full.',
  'room-not-found': 'Room not found. Check the code, or ask the host to keep the game open.',
  'host-left': 'The host left the room.',
  'load-failed': 'Online play unavailable: could not load the network library.',
  'relay-failed': 'Could not reach the matchmaking relays. Check your connection.',
  'peer-connect-failed': 'Could not connect to the other player (network blocks direct connections).'
};

/** @param {import('../main.js').Game} game */
export function createLobbyScene(game) {
  const ui = game.ui;
  const root = /** @type {HTMLElement} */ (document.querySelector('[data-screen="lobby"]'));
  const $ = (/** @type {string} */ sel) => /** @type {HTMLElement} */ (root.querySelector(sel));
  const nameInput = /** @type {HTMLInputElement} */ ($('[data-field="name"]'));
  const codeInput = /** @type {HTMLInputElement} */ ($('[data-field="code"]'));
  let busy = false;
  let keepRoom = false; // true when leaving the lobby to start the match

  /** @param {string} text */
  const status = (text) => ui.set('lobby-status', text);

  function showRoomView() {
    const room = session.room;
    $('[data-lobby-start]').hidden = !!room;
    $('[data-lobby-room]').hidden = !room;
    if (!room) return;
    ui.set('room-code', room.code);
    const list = $('[data-players]');
    list.replaceChildren(
      ...room.players.map((p) => {
        const li = document.createElement('li');
        li.style.setProperty('--player', p.color);
        li.textContent = `${p.name}${p.id === room.hostId ? ' (host)' : ''}${p.id === room.selfId ? ' (you)' : ''}${p.ready || p.id === room.hostId ? ' ✓' : ''}`;
        return li;
      })
    );
    const startButton = /** @type {HTMLButtonElement} */ ($('[data-action="room-start"]'));
    startButton.hidden = !room.isHost;
    const guests = room.players.filter((p) => p.id !== room.hostId);
    startButton.disabled = guests.length === 0 || guests.some((p) => !p.ready);
    $('[data-action="room-ready"]').hidden = room.isHost;
  }

  /** @param {import('../net/room.js').Room} room */
  function attach(room) {
    session.room = room;
    const color = NET.colors[room.players.findIndex((p) => p.id === room.selfId) % NET.colors.length] ?? NET.colors[0];
    if (room.isHost) room.setProfile({ color });
    room.onRoster(() => {
      // Guests pick the color of their seat once they appear in the roster.
      const me = room.players.find((p) => p.id === room.selfId);
      const seat = room.players.findIndex((p) => p.id === room.selfId);
      const seatColor = NET.colors[seat % NET.colors.length];
      if (me && seatColor && me.color !== seatColor && !room.isHost) room.setProfile({ color: seatColor });
      if (game.scenes.current?.name === 'lobby') showRoomView();
    });
    room.onClosed((reason) => {
      if (session.room === room) session.room = null;
      if (reason === 'left') return; // we left on purpose; the caller already changes the screen
      game.scenes.switch(lobby);
      status(MESSAGES[reason] ?? `Room closed (${reason}).`);
    });
    room.onError((err) => status(MESSAGES[err.code ?? ''] ?? err.message));
    room.on('start', (data, from) => {
      if (from !== room.hostId) return;
      keepRoom = true;
      game.scenes.switch(game.sceneList.online, data);
    });
    showRoomView();
    status(room.isHost ? 'Share the code or the invite link.' : 'Joined. Press Ready.');
  }

  /** @param {() => Promise<import('../net/room.js').Room>} open */
  async function connect(open) {
    if (busy) return;
    busy = true;
    game.storage.set('name', nameInput.value.trim());
    status('Connecting...');
    try {
      attach(await open());
    } catch (err) {
      const e = /** @type {any} */ (err);
      status(MESSAGES[e.code] ?? e.message);
    } finally {
      busy = false;
    }
  }

  const options = () => ({ appId: APP_ID, name: nameInput.value.trim() || 'Player', maxUsers: NET.maxUsers });

  const lobby = {
    name: 'lobby',
    /** @param {{join?: string}} [data] */
    enter(data) {
      keepRoom = false;
      nameInput.value = game.storage.get('name', '');
      ui.show('lobby');
      showRoomView();
      if (data?.join) {
        codeInput.value = data.join;
        connect(() => joinRoom(data.join ?? '', options()));
      }
    },
    exit() {
      if (!keepRoom && session.room) {
        const room = session.room;
        session.room = null;
        room.leave();
      }
    },
    render(/** @type {CanvasRenderingContext2D} */ ctx) {
      ctx.fillStyle = VIEW.background;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    },
    debugState: () => ({
      room: session.room?.code ?? null,
      isHost: session.room?.isHost ?? false,
      players: session.room?.players.map((p) => ({ name: p.name, ready: p.ready })) ?? []
    }),
    /** UI actions, merged into game.actions by install.js. */
    actions: {
      'room-create': () => connect(() => createRoom(options())),
      'room-join': () => {
        if (!codeInput.value.trim()) return status('Type a room code first.');
        connect(() => joinRoom(codeInput.value, options()));
      },
      'room-copy': async () => {
        if (!session.room) return;
        try {
          await navigator.clipboard.writeText(session.room.inviteUrl);
          status('Invite link copied.');
        } catch {
          status(session.room.inviteUrl);
        }
      },
      'room-ready': (/** @type {HTMLElement} */ button) => {
        const room = session.room;
        if (!room) return;
        const me = room.players.find((p) => p.id === room.selfId);
        const ready = !me?.ready;
        room.setProfile({ ready });
        button.setAttribute('aria-pressed', String(ready));
      },
      'room-start': () => {
        const room = session.room;
        if (!room?.isHost) return;
        const data = { seed: Math.floor(Math.random() * 2 ** 31) };
        room.send('start', data);
        keepRoom = true;
        game.scenes.switch(game.sceneList.online, data);
      },
      'room-leave': () => {
        const room = session.room;
        session.room = null;
        room?.leave();
        showRoomView();
        status('');
      }
    }
  };
  return lobby;
}
