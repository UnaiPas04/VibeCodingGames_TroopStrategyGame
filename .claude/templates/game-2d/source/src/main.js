// Boot: build the shared game context, register scenes and start the loop.
// URL flags: ?debug  ?seed=123  ?scene=play (skip menus, useful for automated checks)

import { GAME_ID, KEYS, PAD, TITLE, VIEW } from './config.js';
import { createAudio } from './core/audio.js';
import { createView } from './core/canvas.js';
import { createDebug } from './core/debug.js';
import { createEvents } from './core/events.js';
import { createInput } from './core/input.js';
import { createLoop } from './core/loop.js';
import { createRng } from './core/rng.js';
import { createScenes } from './core/scenes.js';
import { playSfx } from './core/sfx.js';
import { createStorage } from './core/storage.js';
import { createGameOverScene, createPauseScene, createTitleScene } from './scenes/menus.js';
import { createPlayScene } from './scenes/play.js';
import { createUi } from './ui/ui.js';

const params = new URLSearchParams(location.search);
document.title = TITLE;

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
const view = createView({ canvas, width: VIEW.width, height: VIEW.height, pixelArt: VIEW.pixelArt });
const seed = params.has('seed') ? Number(params.get('seed')) : Date.now();

const game = {
  params,
  view,
  input: createInput({ keys: KEYS, pad: PAD, target: canvas, toGame: view.toGame }),
  audio: createAudio(),
  events: createEvents(),
  rng: createRng(seed),
  storage: createStorage(GAME_ID),
  scenes: createScenes(),
  ui: createUi({ root: /** @type {HTMLElement} */ (document.getElementById('ui')), onAction: handleUiAction }),
  debug: /** @type {import('./core/debug.js').DebugHandle} */ (/** @type {unknown} */ (null)),
  /** @type {Record<string, import('./core/scenes.js').Scene>} */
  sceneList: {},
  /** UI actions by name: buttons in index.html declare data-action="name". Addons can add more. */
  /** @type {Record<string, (button: HTMLElement) => void>} */
  actions: {}
};

/** @typedef {typeof game} Game */

game.debug = createDebug({
  enabled: params.has('debug'),
  getState: () => ({
    scene: game.scenes.current?.name,
    stack: game.scenes.stack.map((s) => s.name),
    seed,
    muted: game.audio.muted,
    ...game.scenes.current?.debugState?.()
  })
});

game.sceneList = {
  title: createTitleScene(game),
  play: createPlayScene(game),
  pause: createPauseScene(game),
  gameover: createGameOverScene(game)
};

game.actions = {
  play: () => game.scenes.switch(game.sceneList.play),
  restart: () => game.scenes.switch(game.sceneList.play),
  resume: () => game.scenes.pop(),
  menu: () => game.scenes.switch(game.sceneList.title),
  mute(button) {
    game.audio.muted = !game.audio.muted;
    button.setAttribute('aria-pressed', String(game.audio.muted));
  },
  fullscreen: () => game.ui.toggleFullscreen()
};

/**
 * @param {string} action
 * @param {HTMLElement} button
 */
function handleUiAction(action, button) {
  const run = game.actions[action];
  if (!run) {
    console.warn(`Unhandled UI action: ${action}`);
    return;
  }
  playSfx(game.audio, 'select');
  run(button);
}

let lastRender = performance.now();
const loop = createLoop({
  update(dt) {
    game.input.beginStep();
    game.scenes.update(dt);
    game.input.endStep();
  },
  render(alpha) {
    const now = performance.now();
    game.debug.tick((now - lastRender) / 1000);
    lastRender = now;
    game.scenes.render(view.ctx, alpha);
    game.debug.drawOverlay(view.ctx);
  }
});

// Auto-pause: when the tab is hidden during play, open the pause menu.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.scenes.current === game.sceneList.play) game.scenes.push(game.sceneList.pause);
  if (!document.hidden) loop.paused = false;
});

// Addons are installed here (e.g. the P2P addon adds: installMultiplayer(game);).

const startScene = game.sceneList[params.get('scene') ?? ''] ?? game.sceneList.title;
game.scenes.switch(startScene);
loop.start();
