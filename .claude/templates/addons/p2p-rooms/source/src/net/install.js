// Installs online rooms into the game: lobby screen, "Online" button on the title screen,
// lobby/online scenes, UI actions and #room=CODE invite links.
// In main.js:  import { installMultiplayer } from './net/install.js';  installMultiplayer(game);

import { createLobbyScene } from '../scenes/lobby.js';
import { createOnlinePlayScene } from '../scenes/online-play.js';

const LOBBY_HTML = `
<div class="hud" data-net-hud hidden>
  <span>Room <b data-bind="net-room"></b></span>
  <span>Players <b data-bind="net-players"></b></span>
  <span>Esc: leave</span>
</div>
<section class="screen" data-screen="lobby" hidden>
  <h2>Online</h2>
  <div class="stack" data-lobby-start>
    <label>Your name <input data-field="name" maxlength="20" autocomplete="off" /></label>
    <button data-action="room-create">Create room</button>
    <label>Room code <input data-field="code" maxlength="8" autocomplete="off" autocapitalize="characters" /></label>
    <button data-action="room-join">Join room</button>
    <button data-action="menu">Back</button>
  </div>
  <div class="stack" data-lobby-room hidden>
    <p>Room <b class="code" data-bind="room-code"></b></p>
    <button data-action="room-copy">Copy invite link</button>
    <ul class="players" data-players></ul>
    <button data-action="room-ready" aria-pressed="false">Ready</button>
    <button data-action="room-start" data-host-only>Start</button>
    <button data-action="room-leave">Leave room</button>
  </div>
  <p class="hint" role="status" data-bind="lobby-status"></p>
</section>`;

/** @param {import('../main.js').Game} game */
export function installMultiplayer(game) {
  const root = /** @type {HTMLElement} */ (document.getElementById('ui'));
  root.insertAdjacentHTML('beforeend', LOBBY_HTML);

  // "Online" button right after "Play" on the title screen.
  const play = root.querySelector('[data-screen="title"] [data-action="play"]');
  play?.insertAdjacentHTML('afterend', '<button data-action="online">Play online</button>');

  const lobby = createLobbyScene(game);
  game.sceneList.lobby = lobby;
  game.sceneList.online = createOnlinePlayScene(game);

  game.actions.online = () => game.scenes.switch(lobby);
  Object.assign(game.actions, lobby.actions);

  // Invite links: index.html#room=CODE opens the lobby and joins directly.
  const code = new URLSearchParams(location.hash.slice(1)).get('room');
  if (code) {
    history.replaceState(null, '', location.pathname + location.search);
    queueMicrotask(() => game.scenes.switch(lobby, { join: code }));
  }
}
