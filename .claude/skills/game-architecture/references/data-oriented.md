# Data-Oriented Mode and Performance

Idea: store each field of many similar entities in its own contiguous typed array (structure of arrays, SoA) and process them in tight loops. The CPU reads memory sequentially, nothing is allocated per frame, so there are no garbage-collection hitches.

## Structure of arrays with swap-remove

```js
// systems/bullets.js
export function createBullets(max = 2000) {
  return {
    n: 0, max,
    x: new Float32Array(max), y: new Float32Array(max),
    vx: new Float32Array(max), vy: new Float32Array(max),
    life: new Float32Array(max), owner: new Uint8Array(max)
  };
}

export function spawnBullet(b, x, y, vx, vy, owner, life = 2) {
  if (b.n === b.max) return -1; // pool full: drop it, never grow mid-game
  const i = b.n++;
  b.x[i] = x; b.y[i] = y; b.vx[i] = vx; b.vy[i] = vy; b.life[i] = life; b.owner[i] = owner;
  return i;
}

export function removeBullet(b, i) { // O(1): move the last one into the hole
  const last = --b.n;
  b.x[i] = b.x[last]; b.y[i] = b.y[last]; b.vx[i] = b.vx[last]; b.vy[i] = b.vy[last];
  b.life[i] = b.life[last]; b.owner[i] = b.owner[last];
}

export function updateBullets(b, dt, bounds) {
  for (let i = b.n - 1; i >= 0; i--) { // iterate backwards so swap-remove is safe
    b.x[i] += b.vx[i] * dt;
    b.y[i] += b.vy[i] * dt;
    b.life[i] -= dt;
    if (b.life[i] <= 0 || b.x[i] < 0 || b.y[i] < 0 || b.x[i] > bounds.w || b.y[i] > bounds.h) removeBullet(b, i);
  }
}
```

Indices are not stable after swap-remove. If something must refer to an entity across frames, store a generation-checked id (`ids: Uint32Array`) or give it its own small pool.

## ECS-lite

Entities are indices; components are typed arrays (or `null` slots); systems are plain functions over the indices that have the components they need.

```js
export function createWorld(max) {
  return {
    max, alive: new Uint8Array(max), free: Array.from({ length: max }, (_, i) => max - 1 - i),
    pos: { x: new Float32Array(max), y: new Float32Array(max) },
    vel: { x: new Float32Array(max), y: new Float32Array(max) },
    hasVel: new Uint8Array(max), hp: new Int16Array(max)
  };
}
export const spawn = (w) => { const id = w.free.pop(); if (id !== undefined) w.alive[id] = 1; return id ?? -1; };
export const despawn = (w, id) => { w.alive[id] = 0; w.hasVel[id] = 0; w.free.push(id); };

export function movementSystem(w, dt) {
  for (let id = 0; id < w.max; id++) {
    if (!w.alive[id] || !w.hasVel[id]) continue;
    w.pos.x[id] += w.vel.x[id] * dt;
    w.pos.y[id] += w.vel.y[id] * dt;
  }
}
```

Use it only when entity kinds share many components and counts are high. For a handful of entity types, plain SoA pools per type (like bullets above) are simpler and faster.

## Spatial hash (broad-phase collisions)

```js
export function createSpatialHash(cellSize, cols, rows, maxItems) {
  const cellCount = cols * rows;
  return {
    cellSize, cols, rows,
    head: new Int32Array(cellCount), next: new Int32Array(maxItems), // linked lists in arrays, no allocation
    clear() { this.head.fill(-1); },
    insert(i, x, y) {
      const cx = Math.min(cols - 1, Math.max(0, (x / cellSize) | 0)), cy = Math.min(rows - 1, Math.max(0, (y / cellSize) | 0));
      const c = cy * cols + cx;
      this.next[i] = this.head[c];
      this.head[c] = i;
    },
    // visit items in the 3x3 cells around (x, y); cellSize >= largest query radius
    query(x, y, visit) {
      const cx = (x / cellSize) | 0, cy = (y / cellSize) | 0;
      for (let gy = cy - 1; gy <= cy + 1; gy++) for (let gx = cx - 1; gx <= cx + 1; gx++) {
        if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
        for (let i = this.head[gy * cols + gx]; i !== -1; i = this.next[i]) visit(i);
      }
    }
  };
}
// each frame: hash.clear(); insert all enemies; for each bullet: hash.query(bx, by, (e) => test overlap)
```

## Zero allocations in the hot loop

- No `{}`/`[]`/closures/`map`/`filter`/spread/template strings inside per-frame loops of hot systems; reuse scratch objects.
- Use `for` loops with indices, not `for...of` over typed arrays in hot code.
- Preallocate pools at scene enter; never grow arrays during play.
- Avoid `delete`, changing object shapes, and mixing number/undefined in the same field.

## Canvas 2D rendering performance

- Batch by style: set `fillStyle` once, draw all items of that color, then switch.
- Draw static layers (tilemap, background) once to an `OffscreenCanvas` and `drawImage` it.
- Use one sprite atlas image; `drawImage(atlas, sx, sy, sw, sh, dx, dy, dw, dh)` with integer coordinates.
- Avoid per-frame `shadowBlur`, `filter`, gradients and text measurement; cache text as images if heavy.
- Skip objects outside the camera (cull) before drawing.
- `getContext('2d', { alpha: false })` (already set in `core/canvas.js`).
- `save()`/`restore()` only around transforms that need it.

## Profiling

1. `?debug` overlay: FPS, frame ms, entity count (`game.debug.setEntityCount(n)` in your scene).
2. DevTools → Performance → record while playing; look at the longest JS functions and "Minor GC" marks.
3. Quick timing: `performance.mark('ai-start')` ... `performance.measure('ai', 'ai-start')`.
4. Stress test: spawn 10× the expected entities with a debug key and watch the overlay.

## Heavy simulation off the main thread

If the simulation alone exceeds the budget (large cellular automata, pathfinding for hundreds of agents): move it to a Web Worker (`new Worker(new URL('./sim-worker.js', import.meta.url), { type: 'module' })`), send inputs, receive positions as transferable typed arrays (`postMessage(buf, [buf.buffer])`), and keep rendering on the main thread. Only do this after profiling.
