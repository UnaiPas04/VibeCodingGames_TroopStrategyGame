// Installs online play into the game: lobby, match HUD and results screens, the "Play online"
// button, the lobby/online/results scenes, their UI actions and #room=CODE invite links.
// Optional module: see .claude/templates/game-2d/MODULES.md to remove it from single-player games.

import { createLobbyScene } from './lobby.js';
import { createOnlinePlayScene } from './online-play.js';
import { createOnlineResultsScene } from './online-results.js';
import { leaveRoom } from './session.js';

const NET_HTML = `
<div class="hud hud-net" data-net-hud hidden>
  <span>Time <b data-bind="net-time"></b></span>
  <ol class="scores" data-net-scores></ol>
  <span class="hint">Esc: leave</span>
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
    <button data-action="room-start">Start</button>
    <button data-action="room-leave">Leave room</button>
  </div>
  <p class="hint" role="status" data-bind="lobby-status"></p>
</section>
<section class="screen" data-screen="results" hidden>
  <h2 data-bind="results-title"></h2>
  <ol class="players" data-net-results></ol>
  <button data-action="room-back">Back to lobby</button>
  <button data-action="menu">Main menu</button>
</section>`;

/** @param {import('../main.js').Game} game */
export function installMultiplayer(game) {
  const root = /** @type {HTMLElement} */ (document.getElementById('ui'));
  root.insertAdjacentHTML('beforeend', NET_HTML);

  // "Play online" right after "Play" on the title screen.
  root.querySelector('[data-screen="title"] [data-action="play"]')?.insertAdjacentHTML('afterend', '<button data-action="online">Play online</button>');

  const lobby = createLobbyScene(game);
  game.sceneList.lobby = lobby;
  game.sceneList.online = createOnlinePlayScene(game);
  game.sceneList.results = createOnlineResultsScene(game);

  const goToMenu = game.actions.menu;
  Object.assign(game.actions, lobby.actions, {
    online: () => game.scenes.switch(lobby),
    'room-back': () => game.scenes.switch(lobby),
    // Going back to the main menu always leaves the room.
    menu: (/** @type {HTMLElement} */ button) => {
      leaveRoom();
      goToMenu(button);
    }
  });

  // Invite links: index.html#room=CODE opens the lobby and joins directly.
  const code = new URLSearchParams(location.hash.slice(1)).get('room');
  if (code) {
    history.replaceState(null, '', location.pathname + location.search);
    queueMicrotask(() => game.scenes.switch(lobby, { join: code }));
  }
}
