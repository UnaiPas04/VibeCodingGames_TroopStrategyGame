// Every tunable value lives here, so a retune is a one-line change.
// Rules under test: docs/trial-rules.md. Every cost and number is a placeholder.

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
  troopRing: 33, // radius of the circle of troop slots around the cell center
  troopRadius: 9,
  numberRadius: 17,
  buildingSize: 13, // half size of a building at an intersection
  pointCircle: 8, // radius of the circle drawn on intersections with something to do
  pointPick: 18, // max distance to click an intersection circle
  colors: {
    wood: '#2f6b3a',
    stone: '#6f727c',
    grain: '#9a9a3c', // olive wheat field, kept apart from gold
    iron: '#4d5f7d',
    gold: '#d39a10',
    empty: '#23242d',
    grid: '#0d0e13',
    number: '#f3efe2',
    numberHot: '#c0392b', // 6 and 8, the most likely numbers
    numberText: '#1b1b22',
    select: '#ffffff',
    target: 'rgba(255, 255, 255, 0.28)', // move destinations
    attack: 'rgba(229, 72, 77, 0.45)', // cells you can attack
    point: 'rgba(255, 255, 255, 0.9)' // intersection circles
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

/** The four resources found on normal cells. Gold is separate (tower cells, ports). */
export const RESOURCES = /** @type {const} */ (['wood', 'stone', 'grain', 'iron']);
export const GOLD = 'gold';

export const BOARD = {
  size: 6, // cells per side; quadrants are size/2 x size/2
  numbers: [3, 4, 5, 6, 8, 9, 10, 11], // every quadrant gets each number once
  // Base cells [row, col], one per quadrant, in player order: top-left, top-right, bottom-right, bottom-left.
  // Quadrant centers, so the players start close and fight early.
  bases: [
    [1, 1],
    [1, 4],
    [4, 4],
    [4, 1]
  ],
  rerollSums: [2, 7, 12] // dice sums that are rolled again (no cards in the trial)
};

export const PLAYERS = {
  min: 2,
  max: 4,
  // Bases used by each player count, as indexes into BOARD.bases.
  basesByCount: /** @type {Record<number, number[]>} */ ({ 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] }),
  colors: ['#e5484d', '#3e8ef7', '#30a46c', '#f5c542'], // red, blue, green, yellow (by player index)
  grey: '#8b8d98' // eliminated players' towers and buildings
};

export const TROOPS = {
  maxPerCell: 8, // all players together, in a normal cell
  maxPerTower: 4, // all players together, in a tower cell; 4 enemies there besiege the owner
  start: 4, // troops in each player's tower cell at the start
  spawnPerTower: 4 // free troops added to each owned tower cell at the start of the owner's turn (fills it)
};

/** Moving troops: the player picks how many troops and how far; only grain is paid. */
export const MOVE = {
  grainPerTroopCell: 0.5, // cost = troops x cells x this, rounded up (2 troops 1 cell = 1, 8 troops 2 cells = 8)
  maxCells: Infinity // farthest destination in orthogonal steps (Infinity: any, as long as you can pay); troops pass through any cell
};

/** Roll the dice automatically at the start of each turn (it is never a choice). */
export const AUTO_ROLL = true;

/** Combat bonus of each building on the relevant corners (see trial rules T6). */
export const BUILDING_BONUS = { settlement: 1, castle: 2, port: 0 };

export const PORT_TRADE = { give: 2, gold: 1 }; // port goods paid -> gold received

/**
 * Cost of every action, in resource cards.
 * @type {Record<string, Record<string, number>>}
 */
export const COSTS = {
  recruit: { iron: 1, grain: 1 },
  attackInside: { iron: 1 },
  attackOutside: { iron: 1, grain: 1 },
  settlement: { stone: 1, wood: 1 },
  moveSettlement: { grain: 2 }, // a settlement is a +1 combat bonus that never dies: moving it costs as much as 4 troop-steps
  castle: { stone: 4, wood: 2 },
  port: { stone: 2, wood: 3 },
  conquer: { iron: 1, grain: 1 }
};

/** Settlements on an inner intersection need this many of their 4 cells held to be conquered. */
export const CONQUER_SETTLEMENT_INNER = 3;

export const LOG_LINES = 14; // entries shown in the side panel log

/**
 * What each game event sounds like: the only place that links gameplay to sound.
 * @type {Record<string, import('./core/audio.js').SoundRef>}
 */
export const SOUND_EVENTS = {
  'ui:action': 'select',
  'dice:rolled': 'jump',
  'troops:moved': 'select',
  'building:changed': 'powerup',
  'fight:won': 'explosion',
  'fight:lost': 'hit',
  'game:over': 'coin'
};

/** @type {Record<string, string>} */
export const AUDIO_FILES = {};
