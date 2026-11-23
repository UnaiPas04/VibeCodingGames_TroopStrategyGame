// The current online room, shared by the lobby, match and results scenes.

import { GAME_ID } from '../config.js';

/** @type {{room: import('./room.js').Room | null}} */
export const session = { room: null };

/** Namespaced app id: rooms of different games never mix on public relays. */
export const APP_ID = `web-2d-games/${GAME_ID}`;

/** Online settings. Keep rooms small: every player connects to every other player. */
export const NET = {
  maxUsers: 4,
  sendHz: 20, // host snapshots per second
  smoothing: 18, // guests: how fast drawn positions catch up with snapshots (higher = snappier)
  colors: ['#f4d35e', '#5ec8f4', '#ff7b9c', '#8ce99a', '#c39bff', '#ffa94d']
};

/** Leave the current room (if any). The only place where a room is left on purpose. */
export function leaveRoom() {
  const room = session.room;
  session.room = null;
  room?.leave();
}
