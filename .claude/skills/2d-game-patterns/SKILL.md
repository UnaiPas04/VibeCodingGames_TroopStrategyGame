---
name: 2d-game-patterns
description: Plain-JavaScript recipes for 2D game mechanics on Canvas 2D with no engine - platformer controller (coyote time, jump buffer), top-down and grid movement, collision resolution, tilemaps, camera, screen shake, hit-stop, particles, tweens, sprite animation, enemy state machines, pathfinding, procedural levels, touch controls, saves. Use when implementing or tuning any gameplay mechanic, game feel/juice, levels or enemies in the game in source/.
---

# 2D Game Patterns

Recipes adapted to this repository's template (`source/src/core/`). All code is plain ES modules, units are game units (logical resolution from `config.js`), time is seconds, `dt` is the fixed step.

Read only the reference you need:

| Need | Reference |
| ---- | --------- |
| Platformer, top-down, grid/turn-based movement | [references/movement.md](references/movement.md) |
| Collisions against walls and tiles, tilemaps from ASCII | [references/collision-tilemaps.md](references/collision-tilemaps.md) |
| Camera, screen shake, hit-stop, flash, squash, particles, tweens | [references/camera-juice.md](references/camera-juice.md) |
| Enemy state machines, BFS/A* pathfinding, steering | [references/ai.md](references/ai.md) |
| Sprite sheets, animation, procedural levels, touch controls, saves | [references/content.md](references/content.md) |

## Rules of thumb

- Simulate in `update(dt)` only; `render()` never changes game state.
- Every magic number goes to `config.js` with a comment saying what it feels like.
- Put mechanics in pure functions (`entities/`, `systems/`) and test them with `node --test`.
- Prove the core verb with rectangles first; add juice after the verb is fun.
- Use `game.rng` (seeded), never `Math.random()`, for anything gameplay-related: `?seed=N` then reproduces bugs.
- Read input through actions (`input.pressed('jump')`), never raw keys.
