// Collectible items: spawn and collect. Pure logic, unit tested in tests/demo.test.js.

import { rectsOverlap } from '../core/math.js';

/** @typedef {{x: number, y: number, w: number, h: number}} Item */

/**
 * @param {import('../core/rng.js').Rng} rng
 * @param {number} size
 * @param {{w: number, h: number}} bounds
 * @returns {Item}
 */
export function spawnItem(rng, size, bounds) {
  const margin = 8;
  return {
    x: rng.range(margin, bounds.w - size - margin),
    y: rng.range(margin, bounds.h - size - margin),
    w: size,
    h: size
  };
}

/**
 * Replace every item the collector touches with a new one. Returns how many were collected.
 * @param {Item[]} items
 * @param {{x: number, y: number, w: number, h: number}} collector
 * @param {() => Item} respawn
 */
export function collectItems(items, collector, respawn) {
  let collected = 0;
  for (let i = 0; i < items.length; i++) {
    if (rectsOverlap(items[i], collector)) {
      items[i] = respawn();
      collected++;
    }
  }
  return collected;
}
