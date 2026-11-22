---
name: p2p-rooms
description: Add and use online multiplayer rooms in a 2D web game without a server - peer-to-peer over WebRTC with Trystero, short room codes, invite links, lobby with ready/start, host-authoritative sync, and an offline BroadcastChannel mode for testing. Use when a game needs online players, rooms, lobbies, matchmaking by code, co-op or versus over the internet, or when debugging netcode, lag or desync.
---

# P2P Rooms

The addon lives in `.claude/templates/addons/p2p-rooms/`. It is the only runtime library allowed (Trystero, pinned, loaded from a CDN only when online play starts).

## Add it to a game

1. Copy `.claude/templates/addons/p2p-rooms/source/` into `source/` (adds `src/net/` and `src/scenes/{lobby,online-play}.js`).
2. In `source/src/main.js`: `import { installMultiplayer } from './net/install.js';` and call `installMultiplayer(game);` where the comment "Addons are installed here" is.
3. For real-time games, create the loop with `pauseWhenHidden: false` in `main.js` and do not push the pause scene from `visibilitychange` while online: a multiplayer match cannot pause for one player.
4. Tune `NET` in `src/net/session.js` (`maxUsers`, `sendHz`, colors).
5. Replace `scenes/online-play.js` (the demo) with the real online gameplay. Keep the lobby.

Result: "Play online" on the title screen → lobby (create / join by code / copy invite link `#room=CODE` / ready / host starts).

## API (`src/net/room.js`, same for both transports)

```js
const room = await createRoom({ appId: APP_ID, name, maxUsers });   // host
const room = await joinRoom(code, { appId: APP_ID, name });          // guest; rejects: room-not-found, room-full
room.send('input', { left: true });          // to everyone; room.send(type, data, targetId) to one player
room.on('input', (data, fromId) => { ... });  // returns unsubscribe
room.sendBinary(float32Array);  room.onBinary((bytes, fromId) => ...);   // compact frequent updates
room.players  // [{ id, name, color, ready }], room.selfId, room.hostId, room.isHost, room.code
room.onRoster((players) => ...);  room.onClosed((reason) => ...);  room.onError((err) => ...);
room.setProfile({ ready: true });  room.leave();
```

Message types: short names without a leading `_` (reserved). The room is created by the host; when the host leaves, the room closes for everyone (`'host-left'`).

## Choose the netcode

| Game | Pattern |
| ---- | ------- |
| Turn-based (cards, board, puzzle) | Clients send moves (`room.send('move', ...)` to the host). The host validates, applies and broadcasts the new state. Late joiners get the state from the host. |
| Real-time with shared rules (collisions between players, score, enemies) | **Host-authoritative**: clients send only inputs at `sendHz`; the host runs the simulation and broadcasts snapshots (15–20 Hz, `sendBinary` with a `Float32Array`); clients interpolate between the last two snapshots and may predict their own avatar. |
| Real-time, players never interact (racing ghosts, co-op exploration) | Each client owns its avatar and sends its position (the demo in `online-play.js`). |

- Lockstep only for turn-based or integer-only logic: `Math` functions can differ between browsers, so float simulations drift.
- Use `core/rng.js` with a seed sent by the host in the `start` message so every client generates the same level.
- Keep messages small; send at a fixed rate, not every frame.
- Never trust timing: include a tick or sequence number in snapshots and drop old ones.

## Limits and gotchas

- Full mesh: every player connects to every other player. Keep rooms at about 6 players or fewer.
- Secure context: WebRTC encryption needs `localhost`/`127.0.0.1` or HTTPS. `http://192.168.x.x` from a phone fails. Test other devices through VS Code port forwarding (Ports panel → forward 5180 → public HTTPS URL) or the GitHub Pages build.
- Some networks (corporate, university, some mobile carriers) block direct connections: error `peer-connect-failed`. Fix: pass `turnConfig` (TURN servers) to `createRoom`/`joinRoom`; it needs a TURN provider.
- Discovery uses public Nostr relays: some may be down (browser console shows failed `wss://` handshakes; harmless if the room connects).
- `appId` is `web-2d-games/<GAME_ID>`: unique per game, so rooms of different games never mix.
- Hidden tabs are throttled by the browser: the host should keep the game visible.

## Testing

- Offline, deterministic: open two tabs with `?net=local` (BroadcastChannel). Same browser only.
- Real network: two separate browsers or devices. See the `run-game` skill for the exact commands.

## Advanced (Trystero features not wrapped)

`src/net/transports.js` is the only file that imports Trystero (0.27.0). Trystero also offers synced state (`room.makeState`, `room.makeUserState`), verified host roles (`roles()`), room `password`s and large rooms (`scale()`): see https://github.com/dmotz/trystero/tree/main/docs. Using them breaks parity with the `local` transport, so prefer the wrapper unless a feature is really needed. Updating the pinned version: change `TRYSTERO_URL`, then re-test both transports.
