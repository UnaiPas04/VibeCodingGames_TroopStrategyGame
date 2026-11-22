---
name: run-game
description: Run, play and verify the 2D web game in source/ like a player would - start (or reuse) the dev server, drive the game in a real browser with playwright-cli (keys, clicks, screenshots read back as images, console, window.__game state), run unit tests, and check online rooms with two players. Use after any change to the game, when asked to run, test, playtest, screenshot or check the game, and before saying a change is done.
---

# Run Game

A change is not done until the game was played and looked at. Unit tests alone do not prove a canvas game works.

## 1. Tests

```bash
npm test
```

## 2. Dev server (always in the background)

```bash
npm run dev            # http://127.0.0.1:5180/ , live reload, no cache
```

Start it with the shell tool's background option, never in the foreground. If it is already running, the command prints the URL and exits: that is fine. Another port: `npm run dev -- --port 5181`.

## 3. Drive the game with playwright-cli

Use the local Playwright (`npx playwright cli ...`; the `playwright-cli` skill documents every command). This machine has no Chrome, so always open with `--browser=chromium`. If Chromium is missing: `npx playwright install chromium`.

```bash
npx playwright cli open --browser=chromium "http://127.0.0.1:5180/?debug&seed=1"
npx playwright cli eval "JSON.stringify(window.__game.state)"   # scene + game summary
npx playwright cli press Enter                                    # activate focused button
npx playwright cli keydown ArrowRight                             # hold a key...
npx playwright cli keyup ArrowRight                               # ...and release it
npx playwright cli screenshot --filename=shot.png                 # then Read shot.png and LOOK at it
npx playwright cli eval "JSON.stringify(window.__game.errors)"    # must be []
npx playwright cli console                                        # must have no errors
npx playwright cli close
```

- URL flags: `?debug` (overlay: FPS, frame ms, entities, scene; toggle with the Backquote key), `?seed=N` (reproducible randomness), `?scene=play` (skip menus), `?net=local` (offline multiplayer).
- `window.__game.state` comes from each scene's `debugState()`. Add the values you need to assert (positions, score, lives) to the scene's `debugState()`.
- `eval` wraps the expression as `() => (expr)`: use one expression (comma operator), never `;`.
- Click DOM buttons with `eval "document.querySelector('[data-action=play]').click()"` or with `snapshot` + `click <ref>`. The accessibility snapshot shows the HTML UI, never the canvas: use screenshots for the game world.
- Screenshots are files: **Read them** to see what the player sees. Check what changed, not only that something renders.
- Saving a file under `source/` reloads the page (live reload): re-open the scene you were testing.

## 4. Checklist

- Title → play → win or lose → restart works; Escape pauses and resumes.
- The changed mechanic visibly works (screenshot) and `window.__game.state` shows the expected values.
- `npx playwright cli resize 800 450` (or another size): canvas still centered and scaled.
- Mute and fullscreen buttons work; switching tabs during play opens the pause menu.
- `window.__game.errors` is `[]` and the console has no errors.

## 5. Online rooms (games with the P2P addon)

Offline and deterministic, two tabs of one browser:

```bash
npx playwright cli open --browser=chromium "http://127.0.0.1:5180/?net=local"
npx playwright cli eval "document.querySelector('[data-action=online]').click()"
npx playwright cli eval "document.querySelector('[data-action=room-create]').click()"
npx playwright cli eval "window.__game.state.room"              # room code, e.g. QX47R
npx playwright cli tab-new "http://127.0.0.1:5180/?net=local#room=QX47R"
npx playwright cli tab-select 0                                 # switch between players
```

Real network (public relays), two separate browsers: `npx playwright cli -s=p1 open --browser=chromium <url>` and `-s=p2 ...`. Joining takes a few seconds. Browser console errors about a public Nostr relay WebSocket (`wss://...` handshake failed) are expected noise from relays that are down; `window.__game.errors` must still be empty.

## 6. Report

Say what was checked, show the key screenshot(s) by path, and list anything not verified. If something cannot be tested automatically (feel, sound), ask the user to play it and report.
