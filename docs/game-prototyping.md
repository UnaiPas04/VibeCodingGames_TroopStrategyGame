# Game Prototyping Workflow

How to prototype 2D web games with Claude Code on the `web-2d-games` branch. Installation and run commands live in [setup/](../setup/README.md).

## What this branch gives you

- **Rules** (`.claude/rules/web-2d-games.md`, loaded automatically by Claude Code): plain Canvas 2D + ES modules, no engines, no build step; folder layout; definition of done.
- **Template** (`.claude/templates/game-2d/`, try it with `npm run demo`): a small working game with our own helpers in `src/core/` (fixed-step loop, scaled canvas, input actions for keyboard/touch/gamepad, audio and procedural sound effects, scenes, events, seeded random, storage, debug overlay), HTML menus and HUD, unit tests, and two optional modules: `physics/` (simple 2D collisions: solid bodies that push each other) and `net/` (online rooms: codes and invite links, lobby, host-authoritative matches, results; peer-to-peer over WebRTC with [Trystero](https://github.com/dmotz/trystero), vendored in `source/vendor/`, no server; plus an offline mode for testing). The demo uses everything: collect items against the clock, alone or online with 2–4 players who push each other. Each game keeps only the modules it needs: see [MODULES.md](../.claude/templates/game-2d/MODULES.md).
- **Third-party code** is allowed only vendored in `source/vendor/<name>/` with its license and author, never loaded from a CDN at runtime.
- **Skills** in `.claude/skills/`:

| Skill | Use |
| ----- | --- |
| `new-2d-game` | Start a game: brief + scaffold + verify. |
| `run-game` | Run, play and check the game in a real browser (Playwright). |
| `2d-game-patterns` | Mechanics recipes: platformer, top-down, grid, collisions, camera, juice, AI, levels, touch, saves. |
| `game-architecture` | Modular structure and the data-oriented mode for performance. |
| `p2p-rooms` | Online multiplayer rooms and netcode. |
| `prototype-fast` (third party) | One-question prototypes and keep/kill/retune decisions. |
| `frontend-design` (third party) | Visual direction for menus and HUD. |
| `game-engine` (third party) | General web game reference (its Phaser/3D parts are overridden by our rules). |
| `playwright-cli` (third party) | Browser automation commands used by `run-game`. |

Third-party skills are pinned in `skills-lock.json`; restore them with `npx skills experimental_install` and update them with `npx skills update -p`. Re-read their `SKILL.md` after updating.

## Start a new game project

```bash
git clone -b web-2d-games --single-branch <base-repository-url> my-game
cd my-game
git branch -m web-2d-games main        # the game's own main branch
git remote rename origin base          # keep the base to pull updates later
git remote add origin <new-game-repository-url>
npm install
npx playwright install chromium        # once per machine
```

Then ask Claude for the game, for example: "Make a snake game where the snake leaves walls behind". The `new-2d-game` skill writes `docs/game-design.md`, copies the template into `source/` and `tests/`, sets a unique `GAME_ID`, and verifies it in the browser.

## Prototyping loop

1. **One question per prototype** (in `docs/game-design.md`): "is X fun?", with keep/kill signals.
2. **Greybox**: rectangles and procedural beeps; only the core verb is real.
3. **Tune** values in `source/src/config.js` with the game running (`npm run dev` reloads on save).
4. **Verify**: Claude plays it through `run-game` (screenshots, state, console). You play it too.
5. **Decide**: log keep, kill or retune in `docs/game-design.md`.

Useful URL flags: `?debug` (FPS, frame time, entities, errors; toggle with the key left of 1), `?seed=123` (same random sequence), `?scene=play` (skip menus), `?net=local` (online rooms between tabs, offline).

## Online multiplayer

Say so in the brief ("2-player online versus"); the `p2p-rooms` skill guides the netcode. The template already has the flow: "Play online" → create a room → share the 5-letter code or the invite link → guests press Ready → host starts → results → back to lobby for a rematch.

- Test offline with two tabs and `?net=local`; test for real with two browsers.
- Other devices need HTTPS: use VS Code port forwarding or the GitHub Pages build (not `http://<LAN-IP>`).
- Keep rooms small (about 6 players); some networks block direct connections.

## Publish

- **GitHub Pages**: `.github/workflows/pages.yml` publishes `source/` on every push to `main` after running the tests. Enable it once per repository: Settings → Pages → Build and deployment → Source: **GitHub Actions**. Free for public repositories (private ones need a paid or Education plan). Until it is enabled, the deploy job fails.
- **itch.io**: zip the contents of `source/` (with `index.html` at the zip root), create an HTML project and upload the zip; tick "This file will be played in the browser".

Both work because the game uses relative URLs only.

## Keep the base up to date

In the base repository, merge `main` into `web-2d-games` when the base changes (`git checkout web-2d-games && git merge main`).

In a game project created from the branch:

```bash
git fetch base
git merge base/web-2d-games      # brings new rules, skills, tools and templates
```

Game code in `source/` and `tests/` is never touched by these merges, because the template lives in `.claude/templates/`.
