# Game Rules

Official rules. Rules under test live in [trial-rules.md](trial-rules.md) and override these while testing; they move here once confirmed. Free ideas live in [combat-ideas.md](combat-ideas.md).

## Board

- The game is played on a square orthogonal grid of **6 x 6 cells** (provisional size).
- Every cell has two properties:
  - a **number**;
  - a **resource**.

### Cell numbers

- Valid numbers: **3, 4, 5, 6, 8, 9, 10, 11** (every value from 3 to 11 except 7). That is 8 different values.
- Each value appears the same number of times on the board (as evenly as the board size allows).
- Numbers are placed on random cells at the start of each game.
- The missing values (2, 7 and 12) are the dice sums that reveal cards instead of producing resources (see [Turn](#turn)).

### Cell resources

- Each resource type appears the same number of times on the board (as evenly as the board size allows).
- Resources are placed on random cells at the start of each game, independently of the numbers.

## Resources

- Resources are **cards**. Players keep the resource cards they collect in their hand and spend them to buy [actions](#actions).
- Resource types: _to be defined_.
- Idea (not decided): a **gold** resource that works as a wildcard, replacing any other resource.

## Pieces

- Pieces stand on **intersections** (the corner points between cells), never inside a cell.
- **Only one piece per intersection.** Pieces may stand on neighboring intersections.

### Castle

- A castle is placed on an **intersection**: the corner point shared by 4 cells.
- It must always touch exactly 4 cells, so it can never be placed on the edge of the board. On a 6 x 6 board this leaves 5 x 5 = 25 valid intersections.

### Mobile settlement

- Placement rules are the same as the castle: on an inner intersection touching 4 cells, never on the edge.
- It can move by buying the **Move settlement** action (see [Actions](#actions)).

### Port

- A port is placed only on the **edge** of the board, on an intersection touching 2 cells or fewer:
  - edge intersections touch 2 cells;
  - the 4 board corners touch 1 cell.
- On a 6 x 6 board this gives 7 x 7 - 5 x 5 = 24 valid intersections (20 on the sides plus 4 corners).
- Idea (not decided): ports give **trade advantages** through an associated action: the player pays to perform it and gets more resources in return. Exact rules to be defined.

### Platoon

- Used in combat. _To be defined._

## Turn

A turn has two phases, in this order:

1. **Roll the dice.** The active player rolls two six-sided dice and adds them up. The sum decides what happens:

   | Sum | Effect |
   | --- | --- |
   | 2 | Reveal a [Punishment card](#punishment-cards). |
   | 7 | Reveal an [Event card](#event-cards). |
   | 12 | Reveal a [Reward card](#reward-cards). |
   | Any other (3-6, 8-11) | [Resource production](#resource-production). |

2. **Buy actions.** After the roll is resolved, the active player may buy [actions](#actions) by paying resources.

### Resource production

- Every cell whose number equals the dice sum produces its resource.
- **Buildings** are castles, mobile settlements and ports.
- A player receives that resource only if they have a building next to the cell (on one of its corners).
- A player receives **one unit per building** next to the cell.
- **Every** player collects, not only the one who rolled.
- Example: you have a castle next to a cell with resource wood and number 6. When a 6 is rolled, you get one wood card.
- A port touches only 1 or 2 cells, so it can collect from fewer cells than a castle or a settlement.

## Actions

### Move settlement

- Moves one mobile settlement **one step** to a neighboring intersection, orthogonally (up, down, left or right). Diagonal moves are not allowed.
- The destination must follow the settlement placement rules (inner intersection, never on the edge) and be free (one piece per intersection).
- Cost: _to be defined_.

## Cards

- There are three card types: punishment, event and reward.
- Each type has its own **draw pile** (face down) and its own **discard pile**.
- A revealed card is resolved and then goes to its discard pile.
- When a draw pile runs out, its discard pile is shuffled and becomes the new draw pile.

### Punishment cards

- Revealed when the dice sum is **2**.
- They only contain effects that **harm the player who rolled the dice**.
- Card list: _to be defined_.

### Event cards

- Revealed when the dice sum is **7**.
- They contain effects that can **benefit or harm one or several players**.
- Card list: _to be defined_. Known cards:

#### Change a die

- The player who rolled the 7 **must** change the value of **one** of the two dice to any other value, and the new sum is resolved as if it had been rolled.
- Any new sum is allowed, including 2 (only from 1 + 6 to 1 + 1, which reveals a punishment card for the player). It is unlikely anyone will choose it, but it is legal.
- Changing one die can never give 7 again.
- Example: the roll is 3 + 4. The player owns a building next to a cell with number 10, so they change the 3 into a 6: 6 + 4 = 10, and the 10 produces resources.
- Rare case: if the 7 was 1 + 6, the player can turn the 1 into a 6 and get 6 + 6 = 12, which reveals a reward card.

### Reward cards

- Revealed when the dice sum is **12**.
- They only contain effects that **benefit the player who rolled the dice** (the mirror of punishment cards).
- Card list: _to be defined_.

## Open questions

- **Uneven split of numbers.** A 6 x 6 board has 36 cells and there are 8 number values: 36 / 8 = 4.5. Options: 4 of each value plus 4 extra values picked at random; or change the board size (e.g. 4 x 8 = 32 or 8 x 8 = 64 cells split exactly).
- **Resources.** How many resource types are there and what are they called? The same split problem applies if 36 is not a multiple of that count.
- **Reward cards in hand.** Can a player keep a reward card hidden in their hand and use it later instead of resolving it at once? (Likely yes, to be decided.)
- **Change a die: only by a 90° turn?** Variant: the die can only be turned 90°, so the new face must be adjacent to the current one (any face except the same one and its opposite; opposite faces add up to 7). That leaves 4 options per die. Since 1 and 6 are opposite faces, sums 2 and 12 could no longer be reached.
