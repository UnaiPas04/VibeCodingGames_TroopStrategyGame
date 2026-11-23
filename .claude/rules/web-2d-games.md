# Web 2D Games Rules

This branch is the base for 2D web game prototypes. These rules apply to every game built from it.

## Stack

- Plain web platform only: Canvas 2D, vanilla JavaScript ES modules, Web Audio API, Gamepad API, Pointer Events, HTML and CSS.
- No game engines (Phaser, PixiJS, Kaboom, Excalibur, Three.js...), no UI frameworks, no bundler, no build step.
- Prefer our own small code for simple needs (the template's `physics/` module covers simple 2D collisions).
- Third-party open-source code is allowed only **vendored**: copied into `source/vendor/<name>/` with its license and a `README.md` (author, version, source URL, how to update), pinned, and never loaded from a CDN or any URL at runtime. Add a library to the specific game that needs it, not to this base. Today the template vendors only Trystero (online rooms, see the `p2p-rooms` skill).
- Always 2D. No WebGL or 3D.
- Development tools (Node scripts, Playwright, `node --test`) are fine because they never ship with the game.
- **These rules override any skill**, including third-party ones (`game-engine`, `prototype-fast`, `frontend-design`...), whenever a skill suggests engines, frameworks, npm runtime libraries, a build step, 3D, or a different folder layout.

## Layout

- `source/`: the game, served as-is. `index.html`, `src/`, `assets/`.
  - `src/core/`: small reusable helpers (loop, canvas, input, audio, scenes, events, rng, math, storage, debug). Not an engine: just our own code.
  - `src/scenes/`, `src/entities/`, `src/systems/`, `src/ui/`.
  - Optional modules, one folder each: `src/physics/` (simple collisions), `src/net/` (online rooms). Lines that use a module outside its folder are tagged `[module:<name>]`. Catalog and removal steps: `.claude/templates/game-2d/MODULES.md`.
  - `vendor/`: third-party code, as described in Stack.
  - `src/config.js`: `GAME_ID` and every tunable value.
  - `assets/`: images, audio, fonts. Credit every third-party asset in `assets/CREDITS.md` (prefer CC0 sources such as kenney.nl).
- `tests/`: `node --test` unit tests for pure logic.
- `tools/`: development scripts (dev server).
- `docs/game-design.md`: the brief of the current prototype.
- `setup/`: install and run instructions; keep them current (see `general-instructions.md`).
- `.claude/templates/`: **read-only** starting points. Never edit them while working on a game; the game lives only in `source/` and `tests/`.
- If `source/` has no `index.html`, start with the `new-2d-game` skill.

## Code

- One concern per module. Keep pure game logic (rules, physics, AI, state) free of canvas and DOM so it can run in `node --test`.
- No globals except what `config.js` exports. Systems communicate through the event bus (`core/events.js`) or explicit arguments.
- Use JSDoc types; `jsconfig.json` type-checks the code in VS Code.
- Default to plain objects and simple modules. Switch to a data-oriented layout only when the debug overlay (FPS, frame time, entity count) shows a real need; see the `game-architecture` skill.
- Relative URLs only (`./assets/hero.png`), never absolute paths: the game must work from any sub-path (GitHub Pages, itch.io).
- Lowercase file and folder names with dashes. Windows ignores letter case, the web server does not.

## UI

- The game world is drawn on the canvas. Menus, HUD, lobby and settings are HTML/CSS in the `#ui` overlay, styled with CSS custom properties.
- Menus work with keyboard and gamepad (focus navigation), not only the mouse.
- No hard-coded UI text: every text is a key in `src/i18n/locales/<language>.json` (all languages), used with `data-i18n` in HTML or `game.t()` in JS. Proper names (the game title) are the only exception.
- Use the `frontend-design` skill for the visual direction of menus and HUD.

## Prototyping method

- Each prototype answers one question (see `docs/game-design.md` and the `prototype-fast` skill): greybox first, art and polish later.
- Every tunable lives in `config.js`, so a retune is a one-line change.
- Log the keep, kill or retune decision in `docs/game-design.md` after a playtest.

## Definition of done

A change is done only when:

1. `npm test` passes.
2. VS Code reports no diagnostics in the changed files.
3. The game was run through the `run-game` skill: zero console errors, `window.__game.errors` empty, and at least one screenshot reviewed.
4. `setup/` is still accurate.
