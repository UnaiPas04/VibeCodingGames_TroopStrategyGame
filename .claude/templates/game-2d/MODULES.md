# Template Modules

The template is a set of small modules. Pick what each game needs: keep the core, keep or remove each optional module, and replace the demo.

Optional modules are self-contained folders. The few lines outside a module that use it carry a `[module:<name>]` tag, so removing a module is: delete its files, then delete the tagged lines.

```bash
grep -rn "\[module:" source tests     # list every tagged line
```

## Modules

| Module | Files | Required? | Used from |
| ------ | ----- | --------- | --------- |
| Core | `src/core/` (loop, canvas, input, audio, sfx, assets, scenes, events, rng, math, storage, debug), `src/ui/ui.js`, `src/main.js`, `index.html`, `style.css`, `tests/core.test.js` | Yes | everywhere |
| Physics | `src/physics/collisions.js`, `tests/physics.test.js` | No: solid bodies that push each other or stop at walls | `src/systems/match.js` `[module:physics]` |
| Online rooms | `src/net/`, `vendor/trystero/`, `tests/net.test.js` | No: online multiplayer | `src/main.js` `[module:net]` |
| Demo game | `src/entities/player.js`, `src/systems/items.js`, `src/systems/match.js`, `src/scenes/play.js`, `src/scenes/match-view.js`, `tests/demo.test.js`; online part: `src/net/online-play.js`, `src/net/snapshot.js` | Replace with the real game | scenes |

Dependencies only point one way: demo → physics → core, net → demo/core. Core never imports an optional module.

## Remove physics

1. Delete `source/src/physics/` and `tests/physics.test.js`.
2. Delete the two `[module:physics]` lines in `source/src/systems/match.js` (the import and the `resolveCollisions` call).
3. In `config.js`, delete `playersCollide` from `MATCH` (the push test in `tests/demo.test.js` then skips itself) and, optionally, `PLAYER.mass`.
4. Run `npm test`.

Overlap tests for pickups and triggers (`rectsOverlap`, `circlesOverlap`...) stay in `core/math.js`.

## Remove online rooms (single-player game)

1. Delete `source/src/net/`, `source/vendor/trystero/` and `tests/net.test.js`.
2. Delete the two `[module:net]` lines in `source/src/main.js` (import and `installMultiplayer(game);`).
3. Optionally delete the `.hud-net`, `.scores`, `.players`, `.code` rules in `style.css`.
4. Run `npm test` and the `run-game` skill: the title screen no longer shows "Play online".

## Replace the demo

Keep the structure: pure rules in `entities/` and `systems/` (tested), drawing in `scenes/`, menus and HUD in `index.html`. For online games, the host runs the same pure rules (see `net/online-play.js` and the `p2p-rooms` skill); adapt `net/snapshot.js` to the game's state.

## Add a module

New optional features follow the same pattern: one folder under `src/`, its own tests file, an `install(game)` or plain functions used from a few tagged lines, and a row in this table. Third-party code goes to `source/vendor/<name>/` with its license and a README (author, version, source, how to update); it is never loaded from a CDN at runtime.
