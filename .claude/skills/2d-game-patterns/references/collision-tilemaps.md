# Collisions and Tilemaps

## Tilemap from ASCII

Levels as strings are easy to read, diff and generate.

```js
export const LEVEL_1 = `
################
#..............#
#..P.....C.....#
#....#####.....#
#.........E....#
################`;

export const TILE = 16;
const LEGEND = { '#': 'wall', '.': 'empty', P: 'player', C: 'coin', E: 'enemy' };

export function parseLevel(text) {
  const rows = text.trim().split('\n');
  const map = { w: rows[0].length, h: rows.length, solid: new Uint8Array(rows[0].length * rows.length), spawns: [] };
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const kind = LEGEND[ch] ?? 'empty';
    if (kind === 'wall') map.solid[y * map.w + x] = 1;
    else if (kind !== 'empty') map.spawns.push({ kind, x: x * TILE, y: y * TILE });
  }));
  return map;
}

export const isSolid = (map, tx, ty) => tx < 0 || ty < 0 || tx >= map.w || ty >= map.h || map.solid[ty * map.w + tx] === 1;
```

Render static tiles once into an `OffscreenCanvas` (or a hidden canvas) and `drawImage` it every frame.

## Move and collide against tiles (axis-separated)

Move X, resolve, then move Y, resolve. Never resolve both axes at once (causes snagging on tile seams).

```js
export function moveAndCollide(body, map, dt) {
  body.x += body.vx * dt;
  for (const [tx, ty] of overlappedTiles(body, map)) {
    if (!isSolid(map, tx, ty)) continue;
    if (body.vx > 0) body.x = tx * TILE - body.w; else if (body.vx < 0) body.x = (tx + 1) * TILE;
    body.vx = 0;
  }
  body.y += body.vy * dt;
  body.onGround = false;
  for (const [tx, ty] of overlappedTiles(body, map)) {
    if (!isSolid(map, tx, ty)) continue;
    if (body.vy > 0) { body.y = ty * TILE - body.h; body.onGround = true; } else if (body.vy < 0) body.y = (ty + 1) * TILE;
    body.vy = 0;
  }
}

function* overlappedTiles(b, map) {
  const x0 = Math.floor(b.x / TILE), x1 = Math.floor((b.x + b.w - 0.001) / TILE);
  const y0 = Math.floor(b.y / TILE), y1 = Math.floor((b.y + b.h - 0.001) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) yield [tx, ty];
}
```

Tunnelling: if `speed * dt` can exceed the thinnest wall (a tile), split the move into substeps of at most half a tile.

## Entity vs entity

- Broad phase: for more than ~100 entities use a spatial hash (see the `game-architecture` skill), else check all pairs.
- Narrow phase: `rectsOverlap`, `circlesOverlap`, `circleRectOverlap` in `core/math.js`.
- Push apart solid entities with `rectPenetration(a, b)` (returns the minimum translation).
- Use smaller hitboxes than sprites for the player (forgiving) and larger ones for pickups (generous).
- One-way platforms: collide only when `vy > 0` and the body's previous bottom was above the platform top.
