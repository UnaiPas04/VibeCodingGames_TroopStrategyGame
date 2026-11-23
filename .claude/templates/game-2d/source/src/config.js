// Every tunable value lives here, so a retune is a one-line change.

/** Unique id of this game: storage prefix and P2P appId. Set by the new-2d-game skill. */
export const GAME_ID = 'demo-game-0000';
export const TITLE = 'Demo Game';

export const VIEW = {
  width: 320,
  height: 180,
  pixelArt: true,
  background: '#14141f'
};

export const KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  confirm: ['Enter', 'Space'],
  pause: ['Escape', 'KeyP']
};

/** Standard gamepad mapping: 0 = A, 1 = B, 9 = Start, 12-15 = d-pad. */
export const PAD = {
  left: [14],
  right: [15],
  up: [12],
  down: [13],
  confirm: [0],
  pause: [9]
};

export const PLAYER = {
  size: 10,
  speed: 110, // units per second
  accel: 900,
  mass: 1, // with physics: equal masses push each other equally
  color: '#f4d35e'
};

export const ITEMS = {
  size: 6,
  count: 5,
  color: '#ffffff' // distinct from every player color in net/session.js
};

export const MATCH = {
  seconds: 20, // round length
  playersCollide: true // solid players that push each other (needs src/physics/)
};
