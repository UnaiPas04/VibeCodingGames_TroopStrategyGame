---
name: new-2d-game
description: Start a new 2D web game prototype in this repository: write the one-page brief, scaffold the template into source/ and tests/ (online rooms included; removed for single-player games), set the game id and title, and verify it runs. Use when the user asks to create, start or prototype a new game ("make a snake game", "prototype a platformer", "new game idea") and source/ has no game yet. Never use it to change an existing game.
---

# New 2D Game

Scaffolds a game from `.claude/templates/` and adapts it. Follow the rules in `.claude/rules/web-2d-games.md`.

## Guard

Check `source/index.html` first. If it exists, a game is already here: **stop**, do not copy anything, and work on the existing game instead (or ask the user whether they really want to replace it).

## Workflow

1. **Brief.** Copy `.claude/templates/game-design.md` to `docs/game-design.md` and fill it with the user: pitch, the one question this prototype answers, core verb, controls, loop, win/lose, players (single-player or online rooms), keep/kill signals, cut list. Ask only what you cannot infer; keep it to one page. See the `prototype-fast` skill for the method (its `prototypes/<idea>/` folder does not apply here: the game lives in `source/`).
2. **Copy the template** (paths relative to the repo root):
   - `.claude/templates/game-2d/source/` → `source/` (remove `source/.gitkeep`)
   - `.claude/templates/game-2d/tests/` → `tests/`
   - **Choose the modules** with `.claude/templates/game-2d/MODULES.md`: remove `physics` if nothing is solid, remove `net` (online rooms) for single-player games, following its exact steps. Multiplayer games keep `net` and follow the `p2p-rooms` skill.
3. **Identity.** In `source/src/config.js` set `TITLE` and a unique `GAME_ID` = `<kebab-slug>-<4 random lowercase letters or digits>` (e.g. `snake-k3x9`). `GAME_ID` prefixes saved data and namespaces P2P rooms, so it must be unique per game. Also set `<title>` and the title-screen `<h1>` in `source/index.html`.
4. **Dependencies.** Run `npm install` if `node_modules/` is missing, and `npx playwright install chromium` once per machine.
5. **Replace the demo.** The demo (collect items against the clock; online: 2–4 players push each other and compete for items, with scores and results) shows every module in use. Replace the demo files listed in `MODULES.md`, the HUD and the menu texts with the real game, keeping the structure: pure logic in `entities/` and `systems/` with tests, drawing in scenes, menus and HUD in `index.html`. Greybox first (rectangles and procedural sounds from `core/sfx.js`).
6. **Verify** with the `run-game` skill. Then tell the user how to play (`npm run dev`, controls).
7. **Setup and deploy.** Update `setup/` only if the game added requirements or commands. Remind the user once: to publish, enable GitHub Pages with "Source: GitHub Actions" in the repository settings (the workflow in `.github/workflows/pages.yml` deploys `source/` on every push to `main`).

## Useful skills

- `2d-game-patterns`: recipes for mechanics (platformer, top-down, grid, camera, particles, juice...).
- `game-architecture`: structure, patterns, and the data-oriented mode for many entities.
- `p2p-rooms`: online rooms.
- `frontend-design`: look of menus and HUD.
- `game-engine`: general web game reference (ignore its Phaser/3D parts).
