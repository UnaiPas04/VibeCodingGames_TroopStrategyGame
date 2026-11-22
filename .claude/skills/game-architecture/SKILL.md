---
name: game-architecture
description: How to structure 2D web game code in plain JavaScript - modules, scenes, entities, systems, event bus, game programming patterns (state machine, command, observer, object pool, spatial partition) and the data-oriented mode (structure of arrays with typed arrays, ECS-lite, zero allocations, spatial hash, Canvas rendering performance, profiling, Web Workers). Use when organizing or refactoring game code, when a file grows too big, when adding a new system, or when FPS drops, there are hundreds of entities, or the game stutters.
---

# Game Architecture

Two modes. Start in **modular mode**; move a hot part of the game to **data-oriented mode** only when measurements say so.

- Modular (default): [references/modular.md](references/modular.md)
- Data-oriented and performance: [references/data-oriented.md](references/data-oriented.md)

## When to switch

Turn on the debug overlay (`?debug` or the Backquote key). Switch the hot system to data-oriented mode when, on the target device:

- frame time is above ~12 ms (60 FPS budget is 16.7 ms), or FPS drops when entity count grows, or
- the game stutters periodically (garbage collection from per-frame allocations), or
- there are hundreds or thousands of similar entities (bullets, particles, enemies in a swarm, tiles with state).

Measure first (Chrome DevTools → Performance, record 5 s of play). Optimize the function at the top of the profile, then measure again. Do not convert code that is not hot.

## Non-negotiables in both modes

- Pure logic in `entities/` and `systems/` (no canvas, no DOM), tested with `node --test`.
- Scenes orchestrate: read input, call systems, draw. They hold no rules.
- Shared services travel in the `game` context object (`input`, `audio`, `events`, `rng`, `storage`, `ui`, `scenes`, `debug`), never as globals.
- Tunables in `config.js`. Constants in UPPER_CASE.
- Files over ~300 lines or functions over ~60 lines: split by responsibility.
- Keep the public surface of a module small: export what other modules need, nothing else.
