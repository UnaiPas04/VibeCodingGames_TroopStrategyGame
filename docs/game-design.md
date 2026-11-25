# Troop Strategy

<!-- Prototype brief. Rules under test: trial-rules.md. -->

## Pitch

A board game of troops on a 6 x 6 grid: your troops gather resources by majority, your tower gives free troops and gold, and you expand, build and fight until you are the last player standing.

## Question this prototype answers

Do the trial rules ([trial-rules.md](trial-rules.md)) make a game that develops in an interesting way, with real choices every turn and a winner in a reasonable number of turns?

## Core verb

Move troops (and fight with them) to win cell majorities.

## Controls

| Action | Mouse | Keyboard |
| ------ | ----- | -------- |
| Move troops | Click one of your cells, then a highlighted cell: next to it = cart, 2 steps away = horse | – |
| Attack | With a cell selected, click a red cell (or your selected cell, to attack inside it) | Popup buttons: Tab, Enter |
| Build, promote, conquer, trade, move a settlement | Click a white circle on an intersection, then pick in the popup | Tab, Enter |
| Recruit | Click a cell touching your castle (or your selected cell again) | – |
| End turn | Panel button | Tab, Enter |
| Cancel, or pause | – | Escape |

The dice are rolled automatically. Choices open in a popup next to the click. Clicking a cell with nothing to do there shows its details.

## Core loop

Start of turn (gold, free troops) → roll the dice (production) → buy actions → end turn → next player. A player who can no longer act is eliminated; the last one wins.

## Win and lose conditions

See [T9 in trial-rules.md](trial-rules.md#t9-elimination-and-victory).

## Players

2 to 4, hot seat (same screen, taking turns). No bots, no online play.

## Signals

- **Keep if:** games reach an end in under about 40 turns, and players hesitate between several actions most turns.
- **Kill or retune if:** one strategy (for example, staying home for tower gold) always wins, or games stall with nobody able to break through.
- **Timebox:** a few playtests per rule change.

## Cut list

Cards (2, 7, 12 are rerolled), the ship action, bots, online play, art, animations, saves, board keyboard control.

## Tuning

Everything is in `source/src/config.js`:

| Value | What it changes |
| ----- | --------------- |
| `COSTS` | Cost of every action. |
| `TROOPS.maxPerCell`, `maxPerTower`, `start`, `spawnPerTower` | Cell limits, starting troops, free troops per tower per turn. |
| `BUILDING_BONUS` | Combat bonus of settlements, castles and ports. |
| `MOVES` | Troops and distance of the cart and the horse. |
| `AUTO_ROLL` | Roll the dice automatically at the start of each turn. |
| `PORT_TRADE` | Port goods paid for 1 gold. |
| `CONQUER_SETTLEMENT_INNER` | Cells to hold to conquer an inner settlement. |
| `BOARD.rerollSums` | Dice sums rolled again. |

Debug: `?debug` shows the overlay; `?seed=N` repeats a board; `?scene=play&players=3` skips the menu. `window.__game.play` has `act(action)`, `roll()`, `endTurn()`, `click(cell, point)`, `choose(index)` and `state()`.

## Log

| Date | Change or playtest | Result (keep / kill / retune) |
| ---- | ------------------ | ----------------------------- |
| 2026-11-25 | First playable greybox of the trial rules. | Too slow: retune. |
| 2026-11-25 | Bases moved to quadrant centers, 4 starting troops, spawn 4 per turn, missing cards paid with gold automatically. | Retune movement and controls. |
| 2026-11-25 | Cart (4 troops, 1 cell) and horse (2 troops, 2 cells) replace move and wagon; tower cells hold 4; spawn before gold; board clicks and popups replace the tool buttons; automatic dice roll. | Pending playtest. |
