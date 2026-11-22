// The current online room, shared by the lobby and the online scenes.

import { GAME_ID } from '../config.js';

/** @type {{room: import('./room.js').Room | null}} */
export const session = { room: null };

/** Namespaced app id: rooms of different games never mix on public relays. */
export const APP_ID = `web-2d-games/${GAME_ID}`;

/** Online settings. Keep rooms small: every player connects to every other player. */
export const NET = {
  maxUsers: 4,
  sendHz: 20,
  colors: ['#f4d35e', '#5ec8f4', '#ff7b9c', '#8ce99a', '#c39bff', '#ffa94d']
};
