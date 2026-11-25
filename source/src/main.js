// Boot: build the shared game context, register scenes and start the loop.
// URL flags: ?debug  ?seed=123  ?scene=play (skip menus, useful for automated checks)  ?players=3  ?lang=es

import { AUDIO_FILES, GAME_ID, KEYS, PAD, SOUND_EVENTS, TITLE, VIEW } from './config.js';
import { createAudio } from './core/audio.js';
import { createView } from './core/canvas.js';
import { createDebug } from './core/debug.js';
import { createEvents } from './core/events.js';
import { createInput } from './core/input.js';
import { createLoop } from './core/loop.js';
import { createRng } from './core/rng.js';
import { createScenes } from './core/scenes.js';
import { createStorage } from './core/storage.js';
import { createI18n } from './i18n/i18n.js';
import { createGameOverScene, createPauseScene, createTitleScene } from './scenes/menus.js';
import { createPlayScene } from './scenes/play.js';
import { createUi } from './ui/ui.js';

const params = new URLSearchParams(location.search);
document.title = TITLE;

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
const view = createView({ canvas, width: VIEW.width, height: VIEW.height, pixelArt: VIEW.pixelArt });
const seed = params.has('seed') ? Number(params.get('seed')) : Date.now();
const storage = createStorage(GAME_ID);
// Load the UI language before anything is shown (only that language's dictionary is fetched).
const i18n = await createI18n({ storage });

const game = {
  params,
  view,
  input: createInput({ keys: KEYS, pad: PAD, target: canvas, toGame: view.toGame }),
  audio: createAudio({ storage }),
  events: createEvents(),
  rng: createRng(seed),
  storage,
  i18n,
  /** Translate a UI text key: game.t('panel.turn', { turn }). */
  t: i18n.t,
  scenes: createScenes(),
  ui: createUi({ root: /** @type {HTMLElement} */ (document.getElementById('ui')), onAction: handleUiAction }),
  debug: /** @type {import('./core/debug.js').DebugHandle} */ (/** @type {unknown} */ (null)),
  /** @type {Record<string, import('./core/scenes.js').Scene>} */
  sceneList: {},
  /** UI actions by name: buttons in index.html declare data-action="name". Optional modules add their own. */
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
    language: i18n.language,
    ...game.scenes.current?.debugState?.()
  })
});

const playScene = createPlayScene(game);
game.sceneList = {
  title: createTitleScene(game),
  play: playScene,
  pause: createPauseScene(game),
  gameover: createGameOverScene(game)
};

game.actions = {
  ...playScene.actions,
  'new-game': (button) => game.scenes.switch(game.sceneList.play, { players: Number(button.dataset.players) }),
  restart: () => game.scenes.switch(game.sceneList.play),
  resume: () => game.scenes.pop(),
  menu: () => game.scenes.switch(game.sceneList.title),
  mute: (button) => button.setAttribute('aria-pressed', String(game.audio.toggleMuted())),
  fullscreen: () => game.ui.toggleFullscreen(),
  language: () => i18n.setLanguage(i18n.nextLanguage())
};

// Sound: gameplay emits events; SOUND_EVENTS (config.js) decides what each one sounds like.
game.audio.bindEvents(game.events, SOUND_EVENTS);
game.audio.load(AUDIO_FILES);
document.querySelector('[data-action="mute"]')?.setAttribute('aria-pressed', String(game.audio.muted));

// Texts built in JS (not marked with data-i18n) refresh here when the language changes.
const showLanguage = () => game.ui.set('language', i18n.languageName);
i18n.onChange(showLanguage);
showLanguage();

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
  game.events.emit('ui:action', { action });
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

// Single-player auto-pause: hiding the tab opens the pause menu. (Online matches never pause.)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.scenes.current === game.sceneList.play) game.scenes.push(game.sceneList.pause);
});

const startScene = game.sceneList[params.get('scene') ?? ''] ?? game.sceneList.title;
game.scenes.switch(startScene, { players: Number(params.get('players') ?? 2) });
loop.start();
