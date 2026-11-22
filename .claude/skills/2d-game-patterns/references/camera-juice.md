# Camera and Juice

Juice multiplies a fun verb; it never fixes a flat one. Add it after the prototype answers its question. Respect `prefers-reduced-motion` for shake and flashes.

## Camera with deadzone and smoothing

```js
import { clamp, damp } from '../core/math.js';

export function updateCamera(cam, target, world, view, dt) {
  const dz = { w: 40, h: 30 }; // deadzone in game units
  const cx = cam.x + view.width / 2, cy = cam.y + view.height / 2;
  let goalX = cam.x, goalY = cam.y;
  if (target.x < cx - dz.w / 2) goalX = target.x + dz.w / 2 - view.width / 2;
  if (target.x > cx + dz.w / 2) goalX = target.x - dz.w / 2 - view.width / 2;
  if (target.y < cy - dz.h / 2) goalY = target.y + dz.h / 2 - view.height / 2;
  if (target.y > cy + dz.h / 2) goalY = target.y - dz.h / 2 - view.height / 2;
  cam.x = clamp(damp(cam.x, goalX, 10, dt), 0, world.w - view.width);
  cam.y = clamp(damp(cam.y, goalY, 10, dt), 0, world.h - view.height);
}

// render: ctx.save(); ctx.translate(-Math.round(cam.x + shake.x), -Math.round(cam.y + shake.y)); ...world...; ctx.restore();
```

Round the camera for pixel art, or sprites shimmer.

## Screen shake from trauma

```js
const shake = { trauma: 0, x: 0, y: 0 };
export const addTrauma = (amount) => (shake.trauma = Math.min(1, shake.trauma + amount)); // 0.2 hit, 0.5 explosion

export function updateShake(rng, dt, maxOffset = 6) {
  shake.trauma = Math.max(0, shake.trauma - 1.5 * dt);
  const k = shake.trauma * shake.trauma; // squared: small hits barely move, big ones punch
  shake.x = maxOffset * k * rng.range(-1, 1);
  shake.y = maxOffset * k * rng.range(-1, 1);
}
```

## Hit-stop

Freeze gameplay 40–100 ms on impactful hits. Keep rendering and the shake decaying.

```js
let freeze = 0;
export const hitStop = (seconds) => (freeze = Math.max(freeze, seconds));
// in the scene update: if (freeze > 0) { freeze -= dt; updateShake(...); return; }
```

## Flash, squash and stretch

- Flash: on hit, draw the sprite white for 0.06 s (`ctx.globalCompositeOperation = 'source-atop'` over a white rect on an offscreen copy, or simply a white rect for greybox shapes).
- Squash: on landing set `scaleY = 0.7, scaleX = 1.3` and `damp` both back to 1; draw with the pivot at the feet.

## Particles (pooled, no allocation per frame)

```js
export function createParticles(max = 512) {
  const p = { n: 0, x: new Float32Array(max), y: new Float32Array(max), vx: new Float32Array(max), vy: new Float32Array(max), life: new Float32Array(max), max };
  return {
    emit(x, y, count, rng, speed = 60, life = 0.5) {
      for (let i = 0; i < count && p.n < max; i++, p.n++) {
        const a = rng.range(0, Math.PI * 2), s = rng.range(0.3, 1) * speed;
        p.x[p.n] = x; p.y[p.n] = y; p.vx[p.n] = Math.cos(a) * s; p.vy[p.n] = Math.sin(a) * s; p.life[p.n] = life;
      }
    },
    update(dt, gravity = 0) {
      for (let i = p.n - 1; i >= 0; i--) {
        p.life[i] -= dt;
        if (p.life[i] <= 0) { // swap-remove
          const last = --p.n;
          p.x[i] = p.x[last]; p.y[i] = p.y[last]; p.vx[i] = p.vx[last]; p.vy[i] = p.vy[last]; p.life[i] = p.life[last];
          continue;
        }
        p.vy[i] += gravity * dt; p.x[i] += p.vx[i] * dt; p.y[i] += p.vy[i] * dt;
      }
    },
    render(ctx, color) {
      ctx.fillStyle = color;
      for (let i = 0; i < p.n; i++) ctx.fillRect(p.x[i] | 0, p.y[i] | 0, 2, 2);
    },
    get count() { return p.n; }
  };
}
```

## Tweens and easing

```js
export const ease = {
  linear: (t) => t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  outElastic: (t) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1)
};

export function createTweens() {
  const list = [];
  return {
    to(obj, props, duration, easing = ease.outQuad, onDone) {
      const from = Object.fromEntries(Object.keys(props).map((k) => [k, obj[k]]));
      list.push({ obj, from, props, t: 0, duration, easing, onDone });
    },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const tw = list[i];
        tw.t = Math.min(1, tw.t + dt / tw.duration);
        const k = tw.easing(tw.t);
        for (const key in tw.props) tw.obj[key] = tw.from[key] + (tw.props[key] - tw.from[key]) * k;
        if (tw.t === 1) { list.splice(i, 1); tw.onDone?.(); }
      }
    }
  };
}
```

## Sound

`core/sfx.js` has presets (`coin`, `jump`, `hit`, `explosion`, `powerup`, `select`, `lose`) with random pitch jitter. Add presets by editing `PRESETS`. Every player action should have a sound, even a greybox beep.
