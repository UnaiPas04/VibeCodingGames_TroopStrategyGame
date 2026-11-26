# Trial Rules

Rules that are being **tested** in the sandbox. They sit between the brainstorm and the official rules:

1. [combat-ideas.md](combat-ideas.md): free ideas, nothing decided.
2. **trial-rules.md** (this file): rules chosen to be tested. They are programmed and played.
3. [game-rules.md](game-rules.md): official rules. A trial rule moves there once playtests confirm it works.

When a trial rule contradicts an official rule, **the trial rule wins** during testing.

All costs and numbers are **placeholders** to be tuned in playtests. Every one of them lives in `source/src/config.js`.

> **Buildings first.** This branch turns the game around: **buildings are the center of the game**, and troops will only help your buildings or harm the rivals'. Troops are left out for now: this version only has buildings and roads. The previous rules (troops, majorities, towers) are kept in the `trial-rules-grid` branch.

## Game mode

- **Players:** 2 to 4, all on the same screen, taking turns (hot seat). No bots.
- **No cards:** a roll of **2, 7 or 12 is rerolled** until it gives another sum.
- **Victory:** none yet. The game goes on; the panel shows what each player has built.

## Terms

- **Intersection:** a cell corner. Buildings stand on intersections.
  - **Inner:** touches 4 cells. **Coast:** on the board edge, touches 2 cells. **Corner:** a board corner, touches 1 cell.
- **Side:** a cell side, joining two neighboring intersections. Roads go on sides.
- **Quadrant:** one of the four 3 x 3 quarters of the board.

## B0. Board

- 6 x 6 cells. Each quadrant has **1 gold cell** in its center and 8 resource cells: **2 wood, 2 stone, 2 grain, 2 iron**.
- **Every cell has a number**, gold cells too. Each quadrant gets the numbers **3, 4, 5, 6, 8, 9, 10, 11** once, plus **one extra number** among **4, 5, 9 and 10** (a different one in each quadrant). The 9 numbers are shuffled over the quadrant's 9 cells.
  - On the whole board, 4, 5, 9 and 10 appear 5 times; 3, 6, 8 and 11 appear 4 times.
- Gold cells belong to nobody: they pay gold to the buildings around them, like any other cell.

## B1. Setup

- In player order, each player places **one free building** on any free intersection:
  - on the **coast or a corner** it is a **port**;
  - on an **inner** intersection it is a **castle**.
- Then turn 1 starts with the first player.

## B2. Production

- When a number is rolled, every cell with that number produces. **Each building on one of its 4 corners** gives its owner cards of the cell's resource (gold on gold cells):

  | Building | Cards |
  | --- | --- |
  | Settlement | 1 |
  | Castle | 2 |
  | Port | 2 |

- Several buildings around the same cell add up, even if they belong to different players.

## B3. Roads

- A road goes on a free cell side.
- It must **start at one of your buildings or at one of your roads** (one of its two ends touches them). A castle or port inside the board has 4 sides to start from; on the coast, 3; in a corner, 2.
- Rival buildings do not block roads (for now).

## B4. Settlements

- A settlement goes on a **free intersection that touches one of your roads**.
- **Promotion:** a settlement becomes a **castle** (inner intersection) or a **port** (coast or corner).

## B5. Moving a settlement

- A settlement moves **one step**, to a neighboring intersection, **along a road** (yours or a rival's), and the destination must be free.
- The road it travels along **becomes yours**.
- Only settlements move; castles and ports do not.

## B6. Trade and gold

- **Ports** trade 2 cards of the resources of the cells they touch for 1 gold.
- **Gold** buys any card, 1 for 1 (panel buttons), and pays automatically for the cards you are missing when you buy an action.

## Turn

1. **Roll** two dice (automatic). Production (B2).
2. **Actions**, in any order, as many as you can pay.
3. **End turn.**

## Costs

| Action | Cost |
| --- | --- |
| Start building (setup) | free |
| Road | 1 wood |
| Settlement | 1 stone + 1 wood |
| Promote to castle | 4 stone + 2 wood |
| Promote to port | 2 stone + 3 wood |
| Move a settlement (one step) | 2 grain |
| Port trade | 2 port goods → 1 gold |

## Open questions

- **Victory condition** for this version (points for buildings? a number of castles? controlling the gold cells?).
- **Iron and grain** have almost no use until troops come back (grain only moves settlements).
- **The board fills up:** with 2 players, the 49 intersections are nearly all built by turn 50 (bot simulations), and then cards only pile up. Limit buildings per player, add a distance rule between settlements, or give cards a use that never runs out (troops)?
- **Road cost:** 1 wood is a guess.
- Should rival buildings block roads?
- Can a castle or port also be placed (not only promoted) later in the game?
