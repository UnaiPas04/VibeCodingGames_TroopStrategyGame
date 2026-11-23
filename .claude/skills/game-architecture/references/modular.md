# Modular Mode

## Folder roles

| Folder | Contains | May import |
| ------ | -------- | ---------- |
| `src/core/` | Generic helpers reused by every game (loop, canvas, input, audio, sfx, assets, scenes, events, rng, math, storage, debug). Change rarely. | nothing outside `core/` |
| `src/entities/` | Data shapes + pure functions for one kind of thing (`player.js`, `enemy.js`). | `core/math.js`, `core/rng.js`, `config.js` |
| `src/systems/` | Rules that act on many entities (`match.js`, `spawner.js`, `scoring.js`). Pure. | `entities/`, `core/` pure modules, `physics/`, `config.js` |
| `src/physics/` | Optional: collision response for solid bodies. Pure. | `core/math.js` |
| `src/scenes/` | One file per screen/state of the game. Wires input → systems → render. | anything |
| `src/ui/` | DOM overlay: screens, HUD, menus. | `core/` |
| `src/net/` | Optional: online rooms, lobby, online scenes. | anything except other optional modules |
| `vendor/` | Third-party code, vendored with license and README. | nothing (imported only from one wrapper module) |
| `src/config.js` | Tunables and ids. | nothing |

Dependencies point downward: scenes → systems → entities → core. Never import a scene from a system. Optional modules (`physics/`, `net/`) are used only from lines tagged `[module:<name>]`, so a game can delete them (see `.claude/templates/game-2d/MODULES.md`); follow the same pattern for new optional features.

## Entities as plain data

```js
// entities/enemy.js
export const createEnemy = (x, y, kind) => ({ x, y, w: 12, h: 12, vx: 0, vy: 0, hp: 3, kind, state: 'patrol' });
export function damageEnemy(enemy, amount) {
  enemy.hp -= amount;
  return enemy.hp <= 0; // caller decides what dying means (events, score, particles)
}
```

Prefer plain objects + functions over classes with deep inheritance. When kinds differ, use composition: a `kind` field and a table of behaviors (`BEHAVIORS[enemy.kind].update(enemy, ctx, dt)`).

## Patterns that pay off in small games

From Robert Nystrom's free book *Game Programming Patterns* (https://gameprogrammingpatterns.com), in plain JS:

- **Game loop + update method**: already in `core/loop.js` and scenes (`update(dt)` at a fixed step, `render(alpha)`).
- **State**: scenes are states of the game (`core/scenes.js`, stack for overlays like pause); finite state machines for entities (see `2d-game-patterns` → ai.md).
- **Observer**: `game.events.emit('enemy:died', { enemy })`; score, sound, particles and HUD subscribe. The emitter does not know them. Name events `noun:verb`. Unsubscribe in the scene's `exit()` (`on()` returns the unsubscribe function).
- **Command**: turn inputs into data (`{ type: 'move', dx: 1 }`). Enables undo (push/pop), replays and recorded inputs for tests, AI that uses the same commands as the player, and network input messages.
- **Component**: when an entity needs optional features, give it optional data fields (`entity.health`, `entity.ai`) and have systems process only entities with that field.
- **Object pool**: reuse bullets/particles instead of creating and dropping objects every frame (see data-oriented.md).
- **Spatial partition**: grid or spatial hash for "what is near me" queries (see data-oriented.md).
- **Service via context**: systems receive what they need as parameters (`update(state, ctx, dt)`), which keeps them testable with fakes.

## Testing pure logic

```js
// tests/enemy.test.js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEnemy, damageEnemy } from '../source/src/entities/enemy.js';

test('enemy dies at 0 hp', () => {
  const e = createEnemy(0, 0, 'slime');
  assert.equal(damageEnemy(e, 2), false);
  assert.equal(damageEnemy(e, 1), true);
});
```

Deterministic tests: create `createRng(seed)` in the test and pass it in. Replays: feed a recorded command list into the systems and assert the final state.

## Refactoring a growing game

1. Find the scene doing too much (rules inside `update`).
2. Move each rule into a pure function in `systems/` with a test.
3. Replace direct calls between unrelated parts with events.
4. Keep `main.js` as boot only.
