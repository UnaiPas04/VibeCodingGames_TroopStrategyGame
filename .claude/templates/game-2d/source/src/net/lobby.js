// Lobby: create or join a room, share the invite link, mark ready, host starts the match.
// The room stays open between matches; it is left only through leaveRoom() (Leave, main menu, Esc in a match).

import { VIEW } from '../config.js';
import { createRoom, joinRoom } from './room.js';
import { APP_ID, NET, leaveRoom, session } from './session.js';

const MESSAGES = {
  'room-full': 'That room is full.',
  'room-not-found': 'Room not found. Check the code, or ask the host to keep the game open.',
  'host-left': 'The host left the room.',
  'load-failed': 'Online play unavailable: could not load the network library.',
  'relay-failed': 'Could not reach the matchmaking relays. Check your connection.',
  'peer-connect-failed': 'Could not connect to the other player (the network blocks direct connections).'
};

/** @param {import('../main.js').Game} game */
export function createLobbyScene(game) {
  const ui = game.ui;
  const root = /** @type {HTMLElement} */ (document.querySelector('[data-screen="lobby"]'));
  const $ = (/** @type {string} */ sel) => /** @type {HTMLElement} */ (root.querySelector(sel));
  const nameInput = /** @type {HTMLInputElement} */ ($('[data-field="name"]'));
  const codeInput = /** @type {HTMLInputElement} */ ($('[data-field="code"]'));
  const readyButton = $('[data-action="room-ready"]');
  const startButton = /** @type {HTMLButtonElement} */ ($('[data-action="room-start"]'));
  let busy = false;

  /** @param {string} text */
  const status = (text) => ui.set('lobby-status', text);

  function showRoomView() {
    const room = session.room;
    $('[data-lobby-start]').hidden = !!room;
    $('[data-lobby-room]').hidden = !room;
    if (!room) return;
    ui.set('room-code', room.code);
    $('[data-players]').replaceChildren(
      ...room.players.map((p) => {
        const li = document.createElement('li');
        li.style.setProperty('--player', p.color);
        const tags = [p.id === room.hostId && 'host', p.id === room.selfId && 'you'].filter(Boolean).join(', ');
        li.textContent = `${p.name}${tags ? ` (${tags})` : ''}${p.ready || p.id === room.hostId ? ' ✓' : ''}`;
        return li;
      })
    );
    const guests = room.players.filter((p) => p.id !== room.hostId);
    startButton.hidden = !room.isHost;
    startButton.disabled = guests.length === 0 || guests.some((p) => !p.ready);
    readyButton.hidden = room.isHost;
    const me = room.players.find((p) => p.id === room.selfId);
    readyButton.setAttribute('aria-pressed', String(!!me?.ready));
  }

  /** Each player's color follows their seat in the roster. @param {import('./room.js').Room} room */
  function syncSeatColor(room) {
    const seat = room.players.findIndex((p) => p.id === room.selfId);
    const color = NET.colors[seat % NET.colors.length];
    const me = room.players[seat];
    if (me && color && me.color !== color) room.setProfile({ color });
  }

  /** Listeners that live as long as the room. @param {import('./room.js').Room} room */
  function attach(room) {
    session.room = room;
    syncSeatColor(room);
    room.onRoster(() => {
      syncSeatColor(room);
      if (game.scenes.current === lobby) showRoomView();
    });
    room.onClosed((reason) => {
      if (session.room === room) session.room = null;
      if (reason === 'left') return; // we left on purpose: the caller already changed the screen
      game.scenes.switch(lobby);
      status(MESSAGES[reason] ?? `Room closed (${reason}).`);
    });
    room.onError((err) => status(MESSAGES[err.code ?? ''] ?? err.message));
    // Guests follow the host into the match from any screen (lobby or results).
    room.on('start', (data, from) => {
      if (from === room.hostId) game.scenes.switch(game.sceneList.online, data);
    });
    showRoomView();
    status(room.isHost ? 'Share the code or the invite link.' : 'Joined. Press Ready.');
  }

  /** @param {() => Promise<import('./room.js').Room>} open */
  async function connect(open) {
    if (busy) return;
    busy = true;
    game.storage.set('name', nameInput.value.trim());
    status('Connecting...');
    try {
      attach(await open());
    } catch (err) {
      const e = /** @type {{code?: string, message: string}} */ (err);
      status(MESSAGES[e.code ?? ''] ?? e.message);
    } finally {
      busy = false;
    }
  }

  const options = () => ({ appId: APP_ID, name: nameInput.value.trim() || 'Player', maxUsers: NET.maxUsers });

  const lobby = {
    name: 'lobby',
    /** @param {{join?: string}} [data] */
    enter(data) {
      nameInput.value = game.storage.get('name', '');
      ui.show('lobby');
      // Back from a match: guests must confirm again for the next one.
      const room = session.room;
      if (room && !room.isHost && room.players.find((p) => p.id === room.selfId)?.ready) room.setProfile({ ready: false });
      showRoomView();
      if (data?.join) {
        codeInput.value = data.join;
        connect(() => joinRoom(data.join ?? '', options()));
      }
    },
    update() {
      ui.navigate(game.input);
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
      'room-ready': () => {
        const room = session.room;
        const me = room?.players.find((p) => p.id === room.selfId);
        if (room && me) room.setProfile({ ready: !me.ready });
      },
      'room-start': () => {
        const room = session.room;
        if (!room?.isHost) return;
        // The player order fixes everyone's slot in the match and in the snapshots.
        const data = { seed: Math.floor(Math.random() * 2 ** 31), order: room.players.map((p) => p.id) };
        room.send('start', data);
        game.scenes.switch(game.sceneList.online, data);
      },
      'room-leave': () => {
        leaveRoom();
        showRoomView();
        status('');
      }
    }
  };
  return lobby;
}
