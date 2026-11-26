// Every tunable value lives here, so a retune is a one-line change.
// Rules under test: docs/trial-rules.md (buildings and roads; troops come later). Every cost and number is a placeholder.

/** Unique id of this game: storage prefix. */
export const GAME_ID = 'troop-strategy-q7m2';
export const TITLE = 'Troop Strategy';

/** Logical canvas size (game units). The board is drawn inside it, the side panel is HTML. */
export const VIEW = {
  width: 700,
  height: 700,
  pixelArt: false,
  background: '#15161d' // same as --bg in style.css
};

/** Board drawing, in game units. */
export const BOARD_VIEW = {
  margin: 50, // space around the board
  cell: 100, // cell side
  numberRadius: 17,
  buildingSize: 13, // half size of a building at an intersection
  roadWidth: 7, // thickness of a road on a cell side
  pointCircle: 8, // radius of the circle drawn on intersections with something to do
  pointPick: 18, // max distance to click an intersection circle
  edgePick: 16, // max distance to click the middle of a cell side (roads)
  colors: {
    wood: '#2f6b3a',
    stone: '#6f727c',
    grain: '#9a9a3c', // olive wheat field, kept apart from gold
    iron: '#4d5f7d',
    gold: '#d39a10',
    grid: '#0d0e13',
    number: '#f3efe2',
    numberHot: '#c0392b', // 6 and 8, the most likely numbers
    numberText: '#1b1b22',
    select: '#ffffff',
    point: 'rgba(255, 255, 255, 0.9)' // intersection circles and road slots
  }
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

/** The four resources found on normal cells. Gold is separate (gold cells, ports). */
export const RESOURCES = /** @type {const} */ (['wood', 'stone', 'grain', 'iron']);
export const GOLD = 'gold';

export const BOARD = {
  size: 6, // cells per side; quadrants are size/2 x size/2
  numbers: [3, 4, 5, 6, 8, 9, 10, 11], // every quadrant gets each number once...
  extraNumbers: [4, 5, 9, 10], // ...plus one of these (a different one per quadrant), so its 9 cells all have a number
  // Gold cells [row, col], one per quadrant (quadrant centers). They have a number and produce gold.
  goldCells: [
    [1, 1],
    [1, 4],
    [4, 4],
    [4, 1]
  ],
  rerollSums: [2, 7, 12] // dice sums that are rolled again
};

export const PLAYERS = {
  min: 2,
  max: 4,
  colors: ['#e5484d', '#3e8ef7', '#30a46c', '#f5c542'], // red, blue, green, yellow (by player index)
  grey: '#8b8d98' // buildings and roads with no owner
};

/** Cards a building gets when a cell it touches produces (one per building: several buildings add up). */
export const PRODUCTION = { settlement: 1, castle: 2, port: 2 };

/** Roll the dice automatically at the start of each turn (it is never a choice). */
export const AUTO_ROLL = true;

export const PORT_TRADE = { give: 2, gold: 1 }; // port goods paid -> gold received

/**
 * Cost of every action, in resource cards. Missing cards are paid with gold, 1:1.
 * @type {Record<string, Record<string, number>>}
 */
export const COSTS = {
  road: { wood: 1 },
  settlement: { stone: 1, wood: 1 },
  moveSettlement: { grain: 2 }, // one step along a road
  castle: { stone: 4, wood: 2 },
  port: { stone: 2, wood: 3 }
};

export const LOG_LINES = 14; // entries shown in the side panel log

/**
 * What each game event sounds like: the only place that links gameplay to sound.
 * @type {Record<string, import('./core/audio.js').SoundRef>}
 */
export const SOUND_EVENTS = {
  'ui:action': 'select',
  'dice:rolled': 'jump',
  'road:built': 'select',
  'building:changed': 'powerup',
  'game:over': 'coin'
};

/** @type {Record<string, string>} */
export const AUDIO_FILES = {};
