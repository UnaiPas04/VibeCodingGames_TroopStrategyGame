# Troop Strategy

<!-- Prototype brief. Rules under test: trial-rules.md. -->

## Pitch

A board game on a 6 x 6 grid where **buildings are the center**: place a castle or port, spread roads, build and promote settlements to collect resources from the cells around them. Troops will come later, to help your buildings or harm the rivals'.

## Question this prototype answers

Do buildings and roads alone ([trial-rules.md](trial-rules.md)) give interesting choices every turn, with an economy that does not pile up cards the way the troop version did?

## Core verb

Build: roads, then settlements, then promotions.

## Controls

| Action | Mouse | Keyboard |
| ------ | ----- | -------- |
| Place your start building (setup) | Click any free intersection | – |
| Build a road | Click a dashed mark in the middle of a cell side (one click; the pointer shows the cost) | – |
| Build a settlement | Click a circle on an intersection next to your road (one click) | – |
| Promote, trade at a port, move a settlement | Click the ring around your building, then pick in the popup (moving: then click the destination) | Tab, Enter |
| Exchange gold for a card | Panel buttons | Tab, Enter |
| End turn | Panel button | Tab, Enter |
| Cancel, or pause | – | Escape |

The dice are rolled automatically. Hovering a road mark or a circle shows the building in faded color and its cost. Clicking a cell shows its details.

## Core loop

Roll the dice (production) → build → end turn → next player. No end yet.

## Win and lose conditions

None yet (see the open questions in [trial-rules.md](trial-rules.md#open-questions)).

## Players

2 to 4, hot seat (same screen, taking turns). No bots in the game (bots exist only in the simulator, `tools/sim/`).

## Signals

- **Keep if:** players hesitate between several builds most turns, and cards do not pile up.
- **Kill or retune if:** the board fills up early and turns become empty, or one opening always wins.
- **Timebox:** a few playtests per rule change.

## Cut list

Troops (for now), cards (2, 7, 12 are rerolled), victory, bots in the game, online play, art, animations, saves.

## Tuning

Everything is in `source/src/config.js`:

| Value | What it changes |
| ----- | --------------- |
| `COSTS` | Cost of every action. |
| `PRODUCTION` | Cards each building type collects. |
| `BOARD.numbers`, `extraNumbers`, `goldCells` | Numbers per quadrant and gold cell places. |
| `AUTO_ROLL` | Roll the dice automatically at the start of each turn. |
| `PORT_TRADE` | Port goods paid for 1 gold. |
| `BOARD.rerollSums` | Dice sums rolled again. |

Debug: `?debug` shows the overlay; `?seed=N` repeats a board; `?scene=play&players=3` skips the menu. `window.__game.play` has `act(action)`, `roll()`, `endTurn()`, `click({point} | {edge} | {cell})`, `choose(index)` and `state()`.

Simulation: `npm run simulate -- 20 expander builder 100` (games, two bot styles, turns) prints income, spending, leftover cards and what was built.

## Log

| Date | Change or playtest | Result (keep / kill / retune) |
| ---- | ------------------ | ----------------------------- |
| 2026-11-25 | Troop version (see the `trial-rules-grid` branch): bot simulations show huge card surpluses and games that never end. | Kill troops as the center. |
| 2026-11-26 | Buildings first: start castle or port, roads, settlements next to roads, production per building (1 / 2 / 2), numbered gold cells; no troops. Bots: ~30–40 cards in hand at turn 25, but the board is nearly full by turn 50 and then cards pile up (~600–900 by turn 100); grain and iron barely used. | Pending playtest. |
