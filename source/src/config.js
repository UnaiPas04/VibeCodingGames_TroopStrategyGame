// Every tunable value lives here, so a retune is a one-line change.
// Rules under test: docs/trial-rules.md (buildings, roads, and troops that help or harm them). Every cost and number is a placeholder.

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
  troopRing: 33, // radius of the circle of troop slots around the cell center
  troopRadius: 9,
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
    target: 'rgba(255, 255, 255, 0.28)', // move destinations
    attack: 'rgba(229, 72, 77, 0.45)', // cells you can attack
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

/** Troops live in cells. A cell full of one player's troops is blocked: rival buildings around it collect nothing from it. */
export const TROOPS = {
  maxPerCell: 8, // all players together
  recruitBatch: 4 // troops added by one recruit (fewer if the cell has less room)
};

/** Moving troops: the player picks how many troops and how far; only grain is paid. */
export const MOVE = {
  grainPerTroopCell: 0.5, // cost = troops x cells x this, rounded up (2 troops 1 cell = 1, 8 troops 2 cells = 8)
  maxCells: Infinity // farthest destination in orthogonal steps (Infinity: any, as long as you can pay); it must touch one of your buildings
};

/** Fight bonus of each building: in a troop fight, the buildings on the corners of the attacked cell; in a building attack, the two buildings. */
export const BUILDING_BONUS = { settlement: 1, castle: 2, port: 1 };

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
  road: { wood: 2 }, // early expansion runs on wood...
  settlement: { wood: 2, stone: 1 },
  moveSettlement: { grain: 2 }, // one step along a road
  recruit: { grain: 2 }, // TROOPS.recruitBatch troops in a cell next to one of your castles
  attack: { iron: 2 }, // troops attack a neighboring cell, or rivals inside their own cell
  castle: { stone: 4, wood: 1 }, // ...and the late promotions on stone
  port: { stone: 3, wood: 2 },
  attackBuilding: { iron: 2 } // a building attacks a nearby rival building
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
  'troops:moved': 'select',
  'fight:won': 'explosion',
  'fight:lost': 'hit',
  'building:changed': 'powerup',
  'game:over': 'coin'
};

/** @type {Record<string, string>} */
export const AUDIO_FILES = {};
