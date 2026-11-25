# Trial Rules

Rules that are being **tested** in the sandbox. They sit between the brainstorm and the official rules:

1. [combat-ideas.md](combat-ideas.md): free ideas, nothing decided.
2. **trial-rules.md** (this file): rules chosen to be tested. They are programmed and played.
3. [game-rules.md](game-rules.md): official rules. A trial rule moves there once playtests confirm it works.

When a trial rule contradicts an official rule, **the trial rule wins** during testing. Each section says which official rule it replaces or extends.

All costs and numbers are **placeholders** to be tuned in playtests. Every one of them lives in `config.js`.

## Game mode

- **Players:** 2 to 4, all on the same screen, taking turns (hot seat). No bots. Each player owns one base, in the center of a quadrant. With 2 players they take opposite quadrants.
- **No cards in the trial:** punishment, event and reward cards are left out. They will be designed later to fit the final mechanics. A roll of **2, 7 or 12 is rerolled** until it gives another sum.
- **Victory:** see [T9](#t9-elimination-and-victory).

## Terms

- **Inner intersection:** touches 4 cells.
- **Coast intersection:** on the board edge, touches 2 cells.
- **Corner:** one of the 4 board corner points, touches 1 cell.
- **Neighboring cells:** two cells that share a side.
- **Hold a cell:** the cell has at least one of your troops and **no troops of any other player**.
- **Base cell:** the center cell of each quadrant (see [T0](#t0-board-and-base-cells)).
- **Tower cell:** a base cell that holds a tower, of any color (a player's or grey).
- **Quadrant:** one of the four 3 x 3 quarters of the board. Each quadrant has 1 base cell and 8 normal cells.
- **Full cell:** a cell with the maximum number of troops (see [T2](#t2-troops)).

## T0. Board and base cells

_Replaces the official "Cell numbers" and "Cell resources" placement._

- 6 x 6 board. The **center cell of each quadrant is a base cell** (row 2, column 2 counting from that quadrant's outer corner); the other **32 are normal cells**. Bases sit close to each other so fights start early.
- Normal cells: 4 resources x 8 cells each, and 8 numbers (3, 4, 5, 6, 8, 9, 10, 11) x 4 cells each.
- **Balanced quadrants:** each quadrant gets **every number exactly once** and **2 cells of each resource**. Inside each quadrant, numbers and resources are placed at random and independently. Numbers close to 7 come up more often, so this gives every base the same production odds.
- Base cells have **no number**.
- A player's base cell has their **tower**, drawn in their color in the center of the cell. Its resource is **gold**.
- With 2 or 3 players, the bases without a player are **empty**: no tower, no number, no resource. They never produce and nobody can ever spawn there. (With 3 players, a gold mine there would favor the two players next to it.)
- A tower stands in the center of the cell, not on an intersection. Settlements, castles and ports can stand on the corners of a base cell as usual, for example to help defend it.
- A base cell counts as a normal cell for **holding** (building, promoting and conquering around it).

## T1. Resources

_Fills the official "Resources" section._

- Four resources on normal cells: **wood, stone, grain, iron**.
- **Gold** comes from [base cells](#t3-resource-production) and [port trade](#t8-port-trade).
- During your turn you can always exchange **1 gold for 1 resource of your choice**.
- **Automatic gold:** when you buy an action and some cards are missing, gold pays for them 1:1 automatically (not for port trades, which need the port's goods).
- Players start with **no resources**.

## T2. Troops

_Fills the official "Platoon" section._

- Troops stand **inside cells**.
- Troops of **several players can share a cell**, up to **8 troops in total** per cell.
- A full cell accepts no more troops: no move, wagon, recruit or spawn can put a troop into it.
- On screen, the 8 troop slots form a circle around the center of the cell, so troops never hide the cell number or the tower.
- **Recruit troop:** place 1 troop in a cell touching one of your castles.
- **Spawn:** at the start of your turn, free troops appear in your tower cell (see [Turn](#turn)).
- **Starting troops:** each player starts with **4 troops** in their tower cell.

## T3. Resource production

_Replaces the official "Resource production" section._

### Normal cells

- When a number is rolled, each cell with that number produces its resource.
- **Only troops count, buildings do not.** Troops are the workforce that gathers the resource.
- In each producing cell, the player with the most troops collects as many resource cards as **their troops minus the troops of all other players in that cell**. If the result is 0 or less, nobody collects. In practice this needs a majority.
- Every player collects, not only the one who rolled.

| Troops in the cell | Result |
| --- | --- |
| Blue 3 | Blue gets 3. |
| Blue 5, black 1, green 2 | Blue gets 5 - (1 + 2) = 2. |
| Blue 3, black 3 | Nobody gets anything. |
| Blue 3, black 2, green 2 | 3 - 4 < 0: nobody gets anything. |
| No troops | Nobody gets anything. |

### Tower cells

- Tower cells produce **gold at the start of each player's own turn**, without dice.
- The active player collects gold from **every** tower cell where they have the majority (their own, a rival's or a grey one), with the same formula: their troops minus all other troops in that cell.
- Only the active player collects. Tower cells do not produce on other players' turns.

## T4. Movement

- **Move troop:** move 1 troop to a neighboring cell (orthogonally, no diagonals).
- **No movement limit:** a troop can move as many times per turn as the player can pay for.
- **Wagon:** choose one of two uses:
  - move up to **3 troops one cell** (all from the same cell to the same neighboring cell); or
  - move **1 troop up to 3 cells**.
- **Ship:** left out of the trial for now.
- Troops can move into any cell with free slots, including cells with enemy troops and a rival's base cell. That does not start a fight: fighting is a separate action.
- Moving in without fighting is useful on its own: your troops lower what the majority player collects there, or stop them from collecting at all.

## T5. Settlements, castles and ports

_Replaces the official placement rules of the mobile settlement, castle and port._

### Settlement

- **Build settlement:** you need **two neighboring cells that you hold**. The settlement goes on a free intersection at one end of the side they share.
- A settlement can stand on **any** intersection: inner, coast or corner.
- **Move settlement:** one step to a neighboring free intersection, orthogonally.
- A settlement can never be built directly on a corner (a corner is not at the end of a shared side), but it can move there.

### Promotion to castle

- A settlement on an **inner** intersection can become a castle if you **hold all 4 cells** around it.
- A castle never moves.
- Castles are only created this way, never built from scratch.

### Promotion to port

- A settlement on a **coast** intersection can become a port if you **hold the 2 cells** it touches.
- A port never moves.
- Ports are only created this way. A corner touches only 1 cell, so a settlement on a corner can never become a port.

## T6. Combat

- You fight **one enemy player at a time**. If the target cell has troops of several enemies, choose one; to drive out several, attack them one by one.
- **The attacker chooses how many troops to commit** to the fight. Only those troops are at risk: the rest stay out of it. Committing fewer is safer but makes losing more likely.
- **The defender always fights with all their troops** in the attacked cell.
- Each side adds: **troops in the fight + building bonus + one die**. Higher total wins. **The defender wins ties.**
- Odds for the attacker, where the edge is (committed troops + attacker bonus) − (defender troops + defender bonus):

  | Edge | −4 | −3 | −2 | −1 | 0 | +1 | +2 | +3 | +4 | +5 | +6 or more |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Attacker wins | 3% | 8% | 17% | 28% | 42% | 58% | 72% | 83% | 92% | 97% | 100% |
- There are two ways to attack:

  | | From inside | From outside |
  | --- | --- | --- |
  | **Where** | A cell where you and the chosen enemy both have troops. | An enemy cell next to a cell that **you hold** (only your troops). |
  | **Cost** | 1 iron | 1 iron + 1 grain |
  | **Troops you can commit** | 1 up to all your troops in that cell. | 1 up to all your troops in your cell. If you commit all of them and lose, your cell is left empty. |
  | **Buildings that count** | Each side's own buildings on the **4 corners** of that cell. | Each side's own buildings on the **2 ends of the shared side**. |
  | **You win** | All the defender's troops in that cell are removed. | All the defender's troops in the attacked cell are removed. |
  | **You lose or tie** | You lose **the troops you committed**. The defender loses nothing. | You lose **the troops you committed**. The defender loses nothing. |

- Buildings only help their owner. Grey buildings help nobody.
- Winning from outside does not move any troop in. Moving is a separate action.
- **Building bonus:**

  | Building | Bonus |
  | --- | --- |
  | Settlement | +1 |
  | Castle | +2 |
  | Port | 0 |
  | Tower | 0 |

## T7. Conquering buildings

_There is no siege mechanic._

- **Conquer:** an enemy building becomes yours if you **hold** (only your troops) enough of the cells it touches and pay the Conquer action:

  | Building | Condition |
  | --- | --- |
  | Castle | Hold all 4 cells around it. |
  | Port | Hold the 2 cells it touches. |
  | Settlement on an inner intersection | Hold **3 of the 4** cells around it. |
  | Settlement on a coast intersection | Hold both cells it touches. |
  | Settlement on a corner | Hold its only cell. |

- Holding 3 of 4 cells stops a settlement split 2 and 2 between two players from being stolen back and forth. To take it, first drive the enemy out of one of their cells by attacking, move at least one troop in, and then conquer.
- A settlement under threat can flee by moving.
- **Grey buildings** (left by an eliminated player) have no owner and give no combat bonus to anyone. Any player can take one by meeting its condition and paying the Conquer action.
- **Towers** are permanent: they can never be destroyed or moved. See [T9](#t9-elimination-and-victory) for capturing them.

## T8. Port trade

- A port touches 2 cells. The **resources** of those cells (not gold) are the **port's goods**.
- **Trade at port:** pay 2 resource cards from the port's goods (any mix) and get **1 gold**.
- Example: a port touches a wood cell and a stone cell. It can trade 2 wood, 2 stone, or 1 wood + 1 stone for 1 gold.
- Ports are on the coast and bases are not, so a port never touches gold.

## T9. Elimination and victory

### Elimination

Checked at the **start of each player's turn**, before anything else. The player is eliminated if **all** of these are true:

1. They have **no troops on the board**, so they collect no gold.
2. **Every tower they own is full** (8 troops), so they cannot spawn.
3. They **cannot recruit**: they own no castle with a free neighboring cell, or they cannot pay the recruit cost (gold exchange included).

An eliminated player never gets another turn. Their resource cards are discarded, their settlements, castles and ports turn **grey** (see [T7](#t7-conquering-buildings)), and they **lose every tower they own**.

### Tower ownership

- When a player is eliminated, each of their towers is checked:
  - if every troop in that tower cell belongs to **one enemy**, that enemy becomes its owner and the tower takes their color;
  - otherwise the tower becomes **neutral (grey)**.
- A **grey tower** gets an owner as soon as its cell has troops of **only one player** (any number, even 1). That player takes it and it takes their color. This is checked after every action.
- While its owner is alive, a tower never changes owner. Eight troops are needed to eliminate a player; fewer are enough to claim a grey tower.
- The owner of a tower **spawns** there (up to 4 per tower, see [Turn](#turn)). A player can own several towers.
- Every tower cell, whatever its owner or color, keeps producing gold for the active player with the majority (see [T3](#tower-cells)).
- Empty bases (2 or 3 players) never get a tower.

### Victory

- The last player who is not eliminated wins.
- Note: a player who takes a rival tower also gets its gold and its spawns, so the game is expected to snowball towards one winner.

## Turn

_Replaces the official "Turn" section while cards are left out._

1. **Elimination check:** if you meet the [elimination](#elimination) conditions, you are out and your turn ends. If only one player is left, they win.
2. **Gold:** collect gold from every tower cell where you have the majority.
3. **Spawn:** add up to **4 free troops** to each tower cell you own, without exceeding the cell limit.
4. **Roll:** roll two dice, reroll on 2, 7 or 12, and resolve [production](#normal-cells) for every player.
5. **Actions:** buy any actions you can pay for.

First turn example: you start with 4 troops in your tower cell, so step 1 gives you 4 gold, then 4 more troops spawn and the cell is full.

## Costs

| Action | Cost |
| --- | --- |
| Recruit troop | 1 iron + 1 grain |
| Move troop (one cell) | 1 grain |
| Wagon (3 troops 1 cell, or 1 troop 3 cells) | 1 wood + 1 grain |
| Ship | left out |
| Attack from inside | 1 iron |
| Attack from outside | 1 iron + 1 grain |
| Build settlement | 1 stone + 1 wood |
| Move settlement | 1 grain |
| Promote to castle | 4 stone + 2 wood |
| Promote to port | 2 stone + 3 wood |
| Conquer building | 1 iron + 1 grain |
| Trade at port | 2 port goods → 1 gold |
| Gold exchange | 1 gold → 1 resource of your choice |

Stone and wood pay for buildings; iron and grain pay for troops, movement and fights.

## Open questions

- **All costs** above are open to change after playtests.
- **Spawn per turn:** 4 troops for now (raised from 2 to speed the game up), pending balance.
- **Tower defense bonus:** 0 for now. Should the owner get a bonus in their tower cell?
- **Tower position:** quadrant centers for now (moved from the corners to start fights sooner). Other layouts can be tried in `BOARD.bases`.
- **Settlements on the coast or a corner:** they touch fewer than 3 cells, so for now holding all their cells is enough. Is that too easy?
- **Recruiting:** only next to castles, or also next to settlements (maybe at a higher cost)?
- **Ship action:** cost, how many troops, any distance?
- **Conquer cost by building:** same cost for all, or more expensive for a castle?
- **Attacks per turn:** unlimited while you can pay, for now. Should it be limited?
