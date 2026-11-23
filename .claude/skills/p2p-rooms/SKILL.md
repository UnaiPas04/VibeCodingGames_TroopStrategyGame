---
name: p2p-rooms
description: Add and use online multiplayer rooms in a 2D web game without a server - peer-to-peer over WebRTC with Trystero, short room codes, invite links, lobby with ready/start, host-authoritative matches with binary snapshots, results and rematch, and an offline BroadcastChannel mode for testing. Use when a game needs online players, rooms, lobbies, matchmaking by code, co-op or versus over the internet, or when debugging netcode, lag or desync.
---

# P2P Rooms

Online play is the optional `net` module of the game template: everything lives in `source/src/net/` plus the vendored library in `source/vendor/trystero/` (see `.claude/templates/game-2d/MODULES.md`). `installMultiplayer(game)` in `main.js` adds the "Play online" button, the lobby, match and results scenes, and `#room=CODE` invite links.

Try it without a game: `npm run demo`, then open http://127.0.0.1:5181/?net=local in two tabs.

## Files

| File | Role |
| ---- | ---- |
| `net/install.js` | Injects the lobby, match HUD and results HTML; registers scenes and UI actions. |
| `net/room.js` | Rooms: codes, host = creator, roster, messages. Same API for both transports. |
| `net/transports.js` | The only file that touches Trystero (vendored, imported on demand) or `BroadcastChannel` (`?net=local`). |
| `net/session.js` | Current room, `APP_ID`, `NET` settings, `leaveRoom()`. |
| `net/lobby.js` | Create / join / copy link / ready / start. |
| `net/online-play.js` | **Demo** match, host-authoritative. Replace with the game's online scene. |
| `net/snapshot.js` | **Demo** binary snapshot format. Adapt to the game's state. |
| `net/online-results.js` | Ranking, "Back to lobby" (rematch) and "Main menu" (leaves the room). |

## Use it in a game

1. Keep the module (a single-player game removes it as described in `MODULES.md`; to bring it back, copy `src/net/`, `vendor/trystero/` and `tests/net.test.js` from the template and restore the two `[module:net]` lines in `main.js`).
2. Put the game rules in pure functions (like `systems/match.js`): the host runs them, single-player can run them too.
3. Rewrite `net/online-play.js` for the game, keeping its shape: host collects inputs and steps the rules, sends snapshots at `NET.sendHz`, sends `end` with the results; guests send input changes and smooth towards snapshots.
4. Adapt `net/snapshot.js` (and its test) to the game state. Tune `NET` in `net/session.js`.
5. Online matches never pause (single-player pause on tab hide is limited to the `play` scene in `main.js`).

## API (`net/room.js`)

```js
const room = await createRoom({ appId: APP_ID, name, maxUsers });   // host
const room = await joinRoom(code, { appId: APP_ID, name });          // guest; rejects: room-not-found, room-full
room.send('input', { x, y }, room.hostId);   // to one player; omit the target to send to everyone
const off = room.on('input', (data, fromId) => { ... });           // every on* returns an unsubscribe function
room.sendBinary(float32Array);  room.onBinary((bytes, fromId) => ...);  // compact frequent updates
room.players  // [{ id, name, color, ready }], room.selfId, room.hostId, room.isHost, room.code, room.inviteUrl
room.onRoster((players) => ...);  room.onClosed((reason) => ...);  room.onError((err) => ...);
room.setProfile({ ready: true });
leaveRoom();  // from session.js: the only way the game leaves a room
```

Message types: short names without a leading `_` (reserved). When the host leaves, the room closes for everyone (`'host-left'`). Unsubscribe scene listeners in the scene's `exit()`.

## Choose the netcode

| Game | Pattern |
| ---- | ------- |
| Turn-based (cards, board, puzzle) | Clients send moves to the host. The host validates, applies and broadcasts the new state (JSON is fine). |
| Real-time with shared rules (pushing, score, enemies) | **Host-authoritative** (the demo): clients send only input changes; the host runs the simulation and broadcasts binary snapshots (15–20 Hz); clients smooth towards them. Add client-side prediction of the own avatar only if the delay is noticeable on real networks. |
| Real-time, players never interact (racing ghosts) | Each client owns its avatar and sends its position. |

- Everyone builds the same initial state from the host's `seed` and player `order` (sent in `start`), so only changes travel.
- Lockstep only for turn-based or integer-only logic: `Math` functions can differ between browsers.
- Keep messages small; send at a fixed rate, not every frame. Include a tick and drop old snapshots (`snapshot.js` does).
- Never trust guests: the host clamps every input (see `online-play.js`).

## Limits and gotchas

- Full mesh: every player connects to every other player. Keep rooms at about 6 players or fewer (`NET.maxUsers`).
- Secure context: WebRTC encryption needs `localhost`/`127.0.0.1` or HTTPS. `http://192.168.x.x` from a phone fails. Test other devices through VS Code port forwarding (Ports panel → forward the port → public HTTPS URL) or the GitHub Pages build.
- Some networks (corporate, university, some mobile carriers) block direct connections (`peer-connect-failed`). Fix: pass `turnConfig` (TURN servers from a provider) to `createRoom`/`joinRoom`.
- Discovery uses public Nostr relays: some may be down (browser console shows failed `wss://` handshakes; harmless if the room connects).
- `appId` is `web-2d-games/<GAME_ID>`: unique per game, so rooms of different games never mix.
- Hidden tabs are throttled by the browser: the host should keep the game visible.

## Testing

- Unit: `tests/net.test.js` (codes, snapshot round-trip).
- Offline, deterministic: two tabs with `?net=local` (BroadcastChannel, same browser). With playwright-cli the host tab must be the selected one while it simulates; see `run-game`.
- Real network: two separate browsers or devices.

## Trystero

Vendored in `source/vendor/trystero/` (version, authors, license and update steps in its `README.md`); never loaded from a CDN. It also offers synced state (`makeState`, `makeUserState`), verified host roles (`roles()`), room `password`s and large rooms (`scale()`): https://github.com/dmotz/trystero/tree/main/docs. Using them breaks parity with the `local` transport, so prefer the wrapper unless a feature is really needed.
