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
| Choose an action | Click a tool in the side panel | Tab to the button, Enter |
| Pick a source and a target | Click a cell or an intersection on the board | – |
| Cancel the action, or pause | – | Escape |
| Roll, end the turn, fight, trade | Panel buttons | Tab, Enter |

Valid targets are highlighted. Clicking a cell without a tool shows its details.

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
| `TROOPS.maxPerCell`, `start`, `spawnPerTower` | Cell limit, starting troops, free troops per tower per turn. |
| `BUILDING_BONUS` | Combat bonus of settlements, castles and ports. |
| `WAGON` | Troops moved together, cells travelled. |
| `PORT_TRADE` | Port goods paid for 1 gold. |
| `CONQUER_SETTLEMENT_INNER` | Cells to hold to conquer an inner settlement. |
| `BOARD.rerollSums` | Dice sums rolled again. |

Debug: `?debug` shows the overlay; `?seed=N` repeats a board; `?scene=play&players=3` skips the menu. `window.__game.play` has `act(action)`, `roll()`, `endTurn()`, `click(cell, point)` and `state()`.

## Log

| Date | Change or playtest | Result (keep / kill / retune) |
| ---- | ------------------ | ----------------------------- |
| 2026-11-25 | First playable greybox of the trial rules. | Too slow: retune. |
| 2026-11-25 | Bases moved to quadrant centers, 4 starting troops, spawn 4 per turn, missing cards paid with gold automatically. | Pending playtest. |
