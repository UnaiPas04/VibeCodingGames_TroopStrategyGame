# Movement

## Platformer controller

Feels good because of: acceleration (not instant speed), coyote time, jump buffer, variable jump height, faster fall.

```js
// config.js
export const PLATFORMER = {
  runSpeed: 90, groundAccel: 900, airAccel: 500, friction: 1200,
  gravity: 700, fallGravityMult: 1.6, maxFall: 260,
  jumpSpeed: 230, jumpCutMult: 0.45,   // releasing jump early cuts upward speed
  coyoteTime: 0.08, jumpBuffer: 0.1    // seconds
};
```

```js
import { approach } from '../core/math.js';

/** body: {x,y,w,h,vx,vy,onGround,coyote,buffer} */
export function updatePlatformer(body, input, P, dt, moveAndCollide) {
  const dir = input.axis('left', 'right');
  const accel = body.onGround ? P.groundAccel : P.airAccel;
  body.vx = dir !== 0 ? approach(body.vx, dir * P.runSpeed, accel * dt) : approach(body.vx, 0, P.friction * dt);

  body.coyote = body.onGround ? P.coyoteTime : body.coyote - dt;
  body.buffer = input.pressed('jump') ? P.jumpBuffer : body.buffer - dt;
  if (body.buffer > 0 && body.coyote > 0) {
    body.vy = -P.jumpSpeed;
    body.buffer = 0;
    body.coyote = 0;
  }
  if (input.released('jump') && body.vy < 0) body.vy *= P.jumpCutMult;

  const g = body.vy > 0 ? P.gravity * P.fallGravityMult : P.gravity;
  body.vy = Math.min(body.vy + g * dt, P.maxFall);
  moveAndCollide(body, dt); // sets body.onGround; see collision-tilemaps.md
}
```

Tuning order: jump height and air time first (`jumpSpeed`, `gravity`), then run speed, then accelerations.

## Top-down (8 directions)

The template's `entities/player.js` already does it: normalized direction (diagonals not faster), `approach` for acceleration, gamepad stick through `input.axis(neg, pos, 'x'|'y')`. Add a dash: on `pressed('dash')` set velocity to `dir * dashSpeed` for `dashTime` and ignore input meanwhile; add a cooldown.

## Grid / turn-based movement

Logic on integer cells, rendering interpolated. Never store pixel positions in the game state.

```js
// state: { x, y } in cells; anim: { fromX, fromY, t }
export function tryMove(state, dx, dy, isBlocked) {
  const nx = state.x + dx, ny = state.y + dy;
  if (isBlocked(nx, ny)) return false;
  state.x = nx; state.y = ny;
  return true;
}
// render: draw at lerp(from, to, easeOutQuad(t)) * TILE; accept new input when t >= 1
```

- Hold-to-repeat: first repeat after 0.2 s, then every 0.08 s.
- Undo: push a copy of the state (or the move) before each turn; pop on undo (Command pattern).
- Snake-style continuous grid: move one cell every `stepTime`; buffer up to two queued turns so fast taps are not lost; reject a turn opposite to the current direction.
