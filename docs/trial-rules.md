# Trial Rules

Rules that are being **tested** in the sandbox. They sit between the brainstorm and the official rules:

1. [combat-ideas.md](combat-ideas.md): free ideas, nothing decided.
2. **trial-rules.md** (this file): rules chosen to be tested. They are programmed and played.
3. [game-rules.md](game-rules.md): official rules. A trial rule moves there once playtests confirm it works.

When a trial rule contradicts an official rule, **the trial rule wins** during testing.

All costs and numbers are **placeholders** to be tuned in playtests. Every one of them lives in `source/src/config.js`.

> **Buildings first.** This branch turns the game around: **buildings are the center of the game**, and troops only help your buildings or harm the rivals': they block rival production and, in the long run, topple rival buildings. Troops do not produce anything. The previous rules (troops by majority, towers) are kept in the `trial-rules-grid` branch.

## Game mode

- **Players:** 2 to 4, all on the same screen, taking turns (hot seat). No bots.
- **No cards:** a roll of **2, 7 or 12 is rerolled** until it gives another sum.
- **Victory:** a player with no buildings left is out. The **last player with buildings standing** wins (see [B10](#b10-elimination-and-victory)).

## Terms

- **Intersection:** a cell corner. Buildings stand on intersections.
  - **Inner:** touches 4 cells. **Coast:** on the board edge, touches 2 cells. **Corner:** a board corner, touches 1 cell.
- **Side:** a cell side, joining two neighboring intersections. Roads go on sides.
- **Quadrant:** one of the four 3 x 3 quarters of the board.
- **Neighboring cells:** two cells that share a side.
- **Blocked cell:** a cell with 8 troops of one player (see [B7](#b7-troops-and-blocking)).

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
- A **blocked** cell only pays the buildings of the player who blocks it.

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

## B7. Troops and blocking

- Troops live in **cells**: at most **8 troops per cell**, all players together.
- Troops produce nothing. If one player has **8 troops in a cell**, the cell is **blocked**: rival buildings around it collect nothing from it.
- **Recruit:** **4 troops for 2 grain**, in any of the 4 cells around one of your **castles** (fewer if the cell has less room). Ports do not recruit.
- **Move:** pick a cell of yours, how many of its troops, and a destination at any distance that **touches one of your buildings** (one of its 4 corners) and has room. Cost: **½ grain per troop and cell**, rounded up. Troops pass through any cell.

## B8. Troop attack

- Troops attack the rivals in a cell, in two ways:
  - **From a neighboring cell** (sharing a side): the attacker picks how many troops to risk. **Their own troops already in the attacked cell join the fight.**
  - **From inside the cell:** **all** the attacker's troops there fight.
- If the attacked cell has troops of several rivals, the attacker picks one of them.
- Each side adds: its **troops** (1 to 8) + a **die** (1 to 6) + its **buildings on the 4 corners of the attacked cell** (castle 2, settlement 1, port 1).
- The attacker wins only with a higher total (ties go to the defender).
  - **Win:** the defender's troops in that cell die, and the troops from outside move in (as many as fit).
  - **Loss:** **every attacking troop dies**: the ones that came from outside and the attacker's troops inside the cell.
- Cost: **2 iron**.

## B9. Building attack

- One of your buildings attacks a **rival building nearby**: both stand on corners of a same cell (next to each other, or on opposite corners of a cell).
- Each side adds: a **die** + its **building** (castle 2, settlement 1, port 1) + **troop support**: **+1 for each cell around the attacked building where that side has more troops** than the other one.
- The attacker wins only with a higher total (ties go to the defender). If the attacker wins, the attacked building is **toppled**: a castle or a port becomes a settlement; a settlement is destroyed (its intersection is free again). Otherwise nothing happens.
- Cost: **2 iron**.

## B10. Elimination and victory

- A player with **no buildings** is out of the game: their troops, roads and cards are removed, and their turns are skipped.
- The **last player with buildings** wins.

## Turn

1. **Roll** two dice (automatic). Production (B2).
2. **Actions**, in any order, as many as you can pay.
3. **End turn.**

## Costs

| Action | Cost |
| --- | --- |
| Start building (setup) | free |
| Road | 2 wood |
| Settlement | 2 wood + 1 stone |
| Promote to castle | 4 stone + 1 wood |
| Promote to port | 3 stone + 2 wood |
| Move a settlement (one step) | 2 grain |
| Port trade | 2 port goods → 1 gold |
| Recruit (4 troops) | 2 grain |
| Move troops | ½ grain per troop and cell, rounded up |
| Troop attack | 2 iron |
| Building attack | 2 iron |

The early expansion runs on wood; the late promotions run on stone; troops run on grain and iron.

## Next rework (decided, not implemented yet)

Decided on 2026-11-27. These rules replace the matching ones above once they are programmed.

### Troops at half scale

- Every troop is worth **2 of the current ones**: at most **4 troops per cell**, and **4 troops of one player block** a cell.
- In fights, **each troop counts 2**, so the game plays the same with fewer tokens on screen.
- Prices per troop double: **recruit 2 troops for 2 grain**; **move: 1 grain per troop and cell**.

### Attack and defense of buildings

Each building has an **attack** and a **defense** value (totals, not bonuses on top of the settlement):

| Building | Defense | Attack | Production | Where | Cost |
| --- | --- | --- | --- | --- | --- |
| Settlement | 1 | 1 | 1 | next to your road | 2 wood + 1 stone |
| Castle | 2 | 2 | 2 (x2) | **inside only** (promotion) | 4 stone + 1 wood |
| Cannon | 2 | 4 | 1 | inside or coast (promotion) | 3 stone + 2 iron |
| Port | 1 | 0 | 2 (x2) | coast only (promotion); trades for gold | 3 stone + 2 wood |

- Only castles recruit.
- **Troop fights** use them: the attacker adds the **attack** of their buildings on the corners of the attacked cell; the defender adds the **defense** of theirs.

### Setup

- The first building is always a **castle**, on an **inner** intersection (never on the coast).
- Start castles cannot be **orthogonal neighbors** (one side apart); diagonal is allowed.

### Building attack (rework)

- Click a **rival building** to attack it. Cost: **2 iron + 1 gold**.
- The attacker needs at least one of their buildings on the **4 neighboring intersections** of the attacked one (no diagonals), or troops in the cells around it; otherwise they cannot attack (it would be a sure loss).
- **Defender** (owner of the attacked building): defense of the attacked building + defense of their buildings on its 4 neighboring intersections + their troops in the cells around it (each troop counts 2) + a die.
- **Attacker:** attack of their buildings on the 4 neighboring intersections of the attacked building + their troops in the cells around it (each troop counts 2) + a die.
- The attacker wins only with a higher total (ties go to the defender).
  - **Win:** the attacked building is **destroyed** (any type, no downgrade), and the defender loses **2 troops in each cell around it** (never below 0: 4, 2, 3, 0 become 2, 0, 1, 0).
  - **Loss:** the attacker loses **2 troops in each cell around the attacked building** (never below 0). The attacking buildings stay.

## Planned

- **Road ownership from troops:** who owns a road may depend on the troops around it.
- **Troop upkeep** (paid in grain): not for now.

## Open questions

- **Game length:** target about 70 turns (the first turns go fast, with little to buy). The cards for 2, 7 and 12 will change it. See the simulation results in [game-design.md](game-design.md#log).
- **Cards still pile up late** (300–800 in hand after turn 100), once there is no room left to build or recruit.
- Should rival buildings block roads?
- Can a castle or port also be placed (not only promoted) later in the game?
- A player who starts with a port cannot recruit until they promote a settlement to a castle. Is that fine?
