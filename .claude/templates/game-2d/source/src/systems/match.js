// Demo rules, shared by single-player and online play: players move, push each other,
// collect items and score until the timer ends. Pure logic (no canvas, no DOM, no network):
// the online host runs exactly this simulation. Tested in tests/demo.test.js.

import { ITEMS, MATCH, PLAYER } from '../config.js';
import { createPlayer, updatePlayer } from '../entities/player.js';
import { resolveCollisions } from '../physics/collisions.js'; // [module:physics]
import { collectItems, spawnItem } from './items.js';

/** @typedef {{x: number, y: number}} Dir  Input direction, each axis in [-1, 1]. */

/**
 * @typedef {object} MatchPlayer
 * @property {string} id
 * @property {string} name
 * @property {string} color
 * @property {number} score
 * @property {import('../entities/player.js').Player} body
 */

/**
 * @typedef {object} Match
 * @property {MatchPlayer[]} players
 * @property {import('./items.js').Item[]} items
 * @property {number} timeLeft Seconds.
 * @property {boolean} ended
 * @property {{w: number, h: number}} bounds
 * @property {() => import('./items.js').Item} respawn
 */

const NO_INPUT = Object.freeze({ x: 0, y: 0 });

/**
 * @param {object} options
 * @param {{id: string, name?: string, color?: string}[]} options.players In a fixed order (online: the host's order).
 * @param {import('../core/rng.js').Rng} options.rng Seeded, so every run with the same seed spawns the same items.
 * @param {{w: number, h: number}} options.bounds
 * @returns {Match}
 */
export function createMatch({ players, rng, bounds }) {
  const respawn = () => spawnItem(rng, ITEMS.size, bounds);
  const gap = bounds.w / (players.length + 1);
  return {
    players: players.map((p, i) => {
      const body = createPlayer(gap * (i + 1) - PLAYER.size / 2, (bounds.h - PLAYER.size) / 2, PLAYER.size);
      return { id: p.id, name: p.name ?? 'Player', color: p.color ?? PLAYER.color, score: 0, body: Object.assign(body, { mass: PLAYER.mass }) };
    }),
    items: Array.from({ length: ITEMS.count }, respawn),
    timeLeft: MATCH.seconds,
    ended: false,
    bounds,
    respawn
  };
}

/**
 * Advance the match by one fixed step.
 * @param {Match} match
 * @param {Map<string, Dir>} inputs Latest input per player id (missing = standing still).
 * @param {number} dt
 * @returns {{collected: string[]}} Ids of players who collected an item this step (one entry per item).
 */
export function stepMatch(match, inputs, dt) {
  /** @type {string[]} */
  const collected = [];
  if (match.ended) return { collected };

  for (const p of match.players) updatePlayer(p.body, inputs.get(p.id) ?? NO_INPUT, PLAYER, match.bounds, dt);

  if (MATCH.playersCollide) resolveCollisions(match.players.map((p) => p.body), { bounds: match.bounds }); // [module:physics]

  for (const p of match.players) {
    const n = collectItems(match.items, p.body, match.respawn);
    p.score += n;
    for (let i = 0; i < n; i++) collected.push(p.id);
  }

  match.timeLeft = Math.max(0, match.timeLeft - dt);
  if (match.timeLeft === 0) match.ended = true;
  return { collected };
}

/**
 * Players sorted by score (best first).
 * @param {Match} match
 */
export function ranking(match) {
  return [...match.players].sort((a, b) => b.score - a.score).map(({ id, name, color, score }) => ({ id, name, color, score }));
}
