# Setup

How to install and run a 2D web game prototype built from the `web-2d-games` branch. The game is plain HTML, CSS and JavaScript (no build step); Node.js is only used for the local dev server, the unit tests and the browser automation that lets Claude play-test the game.

## Quick start

```bash
git clone -b web-2d-games --single-branch <repository-url> my-game
cd my-game
npm install
npx playwright install chromium
npm run dev
```

Open http://127.0.0.1:5180/ in a browser. Run the tests with `npm test`.

On a fresh clone of the base branch `source/` is still empty: ask Claude to create a game (the `new-2d-game` skill scaffolds it), then run the commands above.

To try the game template without creating a game, run `npm run demo` and open http://127.0.0.1:5181/ (single-player and online rooms; add `?net=local` and use two tabs to test online play offline). No `npm install` is needed for this.

## Guides per operating system

- [Windows](windows.md)
- [macOS](macos.md)
- [Linux](linux.md)

## Commands

| Command | What it does |
| ------- | ------------ |
| `npm install` | Installs development tools only (Playwright, Node type definitions). The game itself has no dependencies. |
| `npx playwright install chromium` | Downloads the browser used for automated play-testing (once per machine, about 150 MB). |
| `npm run dev` | Serves `source/` on http://127.0.0.1:5180/ with live reload and no caching. `npm run dev -- --port 5181` uses another port. |
| `npm test` | Runs the unit tests in `tests/` with the built-in Node test runner. |
| `npm run demo` | Serves the game template itself (`.claude/templates/game-2d/source/`) on http://127.0.0.1:5181/. Edits there change the template. |
| `npm run test:demo` | Runs the template's unit tests. |
| `./tools/new-game.ps1 <name> [-RemoteUrl <url>]` | Windows: creates a new game project next to this folder from the `web-2d-games` branch (see docs/game-prototyping.md). |

There are no environment variables and no `.env` file. Game settings live in `source/src/config.js`; online room settings in `source/src/net/session.js`.
