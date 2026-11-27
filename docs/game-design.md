# Troop Strategy

<!-- Prototype brief. Rules under test: trial-rules.md. -->

## Pitch

A board game on a 6 x 6 grid where **buildings are the center**: place a castle or port, spread roads, build and promote settlements to collect resources from the cells around them. Troops help your buildings or harm the rivals': they block rival production and topple rival buildings.

## Question this prototype answers

Do buildings first, with troops that only block and topple ([trial-rules.md](trial-rules.md)), give interesting choices every turn, an economy that does not pile up cards, and games that end?

## Core verb

Build: roads, then settlements, then promotions. Troops protect them and attack the rivals'.

## Controls

| Action | Mouse | Keyboard |
| ------ | ----- | -------- |
| Place your start building (setup) | Click any free intersection | – |
| Build a road | Click a dashed mark in the middle of a cell side (one click; the pointer shows the cost) | – |
| Build a settlement | Click a circle on an intersection next to your road (one click) | – |
| Promote, trade at a port, move a settlement | Click the ring around your building, then pick in the popup (moving: then click the destination) | Tab, Enter |
| Recruit 4 troops | Click a cell next to your castle (one click) | – |
| Move troops | Click one of your cells (all its troops are picked: change the number with − + or the mouse wheel), then a highlighted cell (next to one of your buildings); a box shows the price: Accept, or click the same cell again | Accept: Enter |
| Troop attack | With troops selected, click a red neighboring cell (your troops already there help); or, in the menu of your selected cell, attack the rivals inside it with all your troops. The form shows the odds | Fight: Enter |
| Building attack | Click the ring around a rival building next to yours: the form shows the odds | Fight: Enter |
| Exchange gold for a card | Panel buttons | Tab, Enter |
| End turn | Panel button | Tab, Enter |
| Cancel, or pause | – | Escape |

The dice are rolled automatically. Hovering a road mark or a circle shows the building in faded color and its cost. Clicking a cell shows its details.

## Core loop

Roll the dice (production) → build, recruit, move, attack → end turn → next player. A player with no buildings is out.

## Win and lose conditions

The last player with buildings standing wins ([B10](trial-rules.md#b10-elimination-and-victory)).

## Players

2 to 4, hot seat (same screen, taking turns). No bots in the game (bots exist only in the simulator, `tools/sim/`).

## Signals

- **Keep if:** players hesitate between several builds most turns, and cards do not pile up.
- **Kill or retune if:** the board fills up early and turns become empty, or one opening always wins.
- **Timebox:** a few playtests per rule change.

## Cut list

Cards (2, 7, 12 are rerolled), troop upkeep, bots in the game, online play, art, animations, saves.

## Tuning

Everything is in `source/src/config.js`:

| Value | What it changes |
| ----- | --------------- |
| `COSTS` | Cost of every action. |
| `PRODUCTION` | Cards each building type collects. |
| `TROOPS` | Troops per cell (8 also blocks it), troops per recruit. |
| `MOVE` | Grain per troop and cell, farthest destination. |
| `BUILDING_BONUS` | Fight bonus of each building type. |
| `BOARD.numbers`, `extraNumbers`, `goldCells` | Numbers per quadrant and gold cell places. |
| `AUTO_ROLL` | Roll the dice automatically at the start of each turn. |
| `PORT_TRADE` | Port goods paid for 1 gold. |
| `BOARD.rerollSums` | Dice sums rolled again. |

Debug: `?debug` shows the overlay; `?seed=N` repeats a board; `?scene=play&players=3` skips the menu. `window.__game.play` has `act(action)`, `roll()`, `endTurn()`, `click({point} | {edge} | {cell})`, `choose(index)`, `press(action)`, `setCount(n)` and `state()`.

Simulation: `npm run simulate -- 20 balanced warlord 150` (games, two bot styles, turns) prints results, game length, income, spending, leftover cards, what was built, how much of the board troops fill and how many cells are blocked.

## Log

| Date | Change or playtest | Result (keep / kill / retune) |
| ---- | ------------------ | ----------------------------- |
| 2026-11-25 | Troop version (see the `trial-rules-grid` branch): bot simulations show huge card surpluses and games that never end. | Kill troops as the center. |
| 2026-11-26 | Buildings first: start castle or port, roads, settlements next to roads, production per building (1 / 2 / 2), numbered gold cells; no troops. Bots: ~30–40 cards in hand at turn 25, but the board is nearly full by turn 50 and then cards pile up (~600–900 by turn 100); grain and iron barely used. | Keep: more balanced and fun than the troop version. |
| 2026-11-26 | New costs: road 2 wood, settlement 2 wood + 1 stone, castle 5 stone, port 3 stone + 2 wood (wood for the early expansion, stone for the late promotions). | Pending playtest. |
| 2026-11-27 | Troops back, buildings first: 8 troops block a cell for the rivals; recruit 4 for 1 grain next to castles; moves only to cells touching your roads; troop attack (2 iron) and building attack (3 iron + 2 gold, topples); the last player with buildings wins. Castle 4 stone + 1 wood. Bots (10 games, balanced vs warlord, 150 turns): 3 games end (62–70 turns); troops fill 56% of the board by turn 50 and 75% by turn 100; grain then piles up (100–240 in hand). | Pending playtest. |
| 2026-11-27 | Troops move to cells next to your buildings; your troops inside the attacked cell join the fight (and fall if you lose); attack from inside with all troops; recruit 4 for 2 grain; building attack 2 iron. Bots (16 games each): 10/16 end, median 45–54 turns, but some end at turn 5 (start buildings side by side). Next rework decided (troops at half scale, attack/defense per building, cannon, building attack rework): see trial-rules.md. | Pending playtest. |
