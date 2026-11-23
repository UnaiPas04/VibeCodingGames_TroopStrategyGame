// Binary snapshot of the demo match, sent by the host ~20 times per second.
// Layout (Float32): [tick, timeLeft, playerCount, (x, y, score) * players, itemCount, (x, y) * items]
// Players are in the fixed order agreed in the 'start' message. Pure: tested in tests/net.test.js.

/** @typedef {{tick: number, timeLeft: number, players: {x: number, y: number, score: number}[], items: {x: number, y: number}[]}} Snapshot */

/**
 * @param {import('../systems/match.js').Match} match
 * @param {number} tick Increasing counter, so receivers can drop out-of-date snapshots.
 */
export function encodeSnapshot(match, tick) {
  const { players, items } = match;
  const out = new Float32Array(3 + players.length * 3 + 1 + items.length * 2);
  let i = 0;
  out[i++] = tick;
  out[i++] = match.timeLeft;
  out[i++] = players.length;
  for (const p of players) {
    out[i++] = p.body.x;
    out[i++] = p.body.y;
    out[i++] = p.score;
  }
  out[i++] = items.length;
  for (const item of items) {
    out[i++] = item.x;
    out[i++] = item.y;
  }
  return out;
}

/**
 * @param {Uint8Array | Float32Array} data
 * @returns {Snapshot}
 */
export function decodeSnapshot(data) {
  // Copy into an aligned buffer: received bytes may start at any offset.
  const f = data instanceof Float32Array ? data : new Float32Array(data.slice().buffer);
  let i = 0;
  const tick = f[i++];
  const timeLeft = f[i++];
  const players = [];
  for (let n = f[i++]; n > 0; n--) players.push({ x: f[i++], y: f[i++], score: f[i++] });
  const items = [];
  for (let n = f[i++]; n > 0; n--) items.push({ x: f[i++], y: f[i++] });
  return { tick, timeLeft, players, items };
}
