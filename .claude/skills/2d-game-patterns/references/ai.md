# Enemy AI

Pick the simplest model that produces the behavior: a finite state machine covers most prototypes.

## Finite state machine

```js
// One object per state; transitions return the next state's name.
const ENEMY_STATES = {
  patrol: {
    update(e, ctx, dt) {
      e.x += e.dir * e.speed * dt;
      if (ctx.hitsWall(e)) e.dir *= -1;
      if (ctx.distToPlayer(e) < e.sight) return 'chase';
    }
  },
  chase: {
    enter(e) { e.speed = e.chaseSpeed; },
    update(e, ctx, dt) {
      e.dir = Math.sign(ctx.player.x - e.x) || 1;
      e.x += e.dir * e.speed * dt;
      if (ctx.distToPlayer(e) > e.sight * 1.5) return 'patrol'; // hysteresis avoids flicker
    },
    exit(e) { e.speed = e.patrolSpeed; }
  }
};

export function updateEnemy(e, ctx, dt) {
  const next = ENEMY_STATES[e.state].update(e, ctx, dt);
  if (next && next !== e.state) {
    ENEMY_STATES[e.state].exit?.(e);
    e.state = next;
    ENEMY_STATES[next].enter?.(e);
  }
}
```

Telegraph attacks (wind-up state of 0.3–0.6 s with a visual cue) so the player can react.

## BFS on a grid (shortest path, uniform cost)

```js
export function bfs(map, start, goal) {
  const key = (x, y) => y * map.w + x;
  const prev = new Int32Array(map.w * map.h).fill(-1);
  const queue = [start];
  prev[key(start.x, start.y)] = key(start.x, start.y);
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i];
    if (x === goal.x && y === goal.y) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h || map.solid[key(nx, ny)] || prev[key(nx, ny)] !== -1) continue;
      prev[key(nx, ny)] = key(x, y);
      queue.push({ x: nx, y: ny });
    }
  }
  if (prev[key(goal.x, goal.y)] === -1) return null;
  const path = [];
  for (let k = key(goal.x, goal.y); k !== key(start.x, start.y); k = prev[k]) path.push({ x: k % map.w, y: (k / map.w) | 0 });
  return path.reverse();
}
```

- Many enemies chasing one target: run one BFS **from the player** each time the player changes cell (a flow field) and let every enemy step to the neighbor with the lowest distance.
- Weighted terrain or large maps: A* with a binary heap and Manhattan heuristic.
- Recompute paths a few times per second, not every frame.

## Steering (free movement)

Seek: `vel += normalize(target - pos) * maxSpeed - vel` scaled by an agility factor. Flee is the inverse. Separation: push away from neighbors closer than a radius (use the spatial hash). Combine with weights.
