# Sprites, Levels, Touch Controls and Saves

## Sprite sheets and animation

```js
import { image } from '../core/assets.js';

// await loadImages({ hero: './assets/hero.png' }) during boot (title scene or main.js).
export const HERO_ANIMS = {
  idle: { row: 0, frames: 4, fps: 6 },
  run: { row: 1, frames: 6, fps: 12 },
  jump: { row: 2, frames: 1, fps: 1 }
};

export function drawSprite(ctx, sheetName, anim, time, x, y, size, flip = false) {
  const frame = Math.floor(time * anim.fps) % anim.frames;
  const img = image(sheetName);
  ctx.save();
  ctx.translate(Math.round(x) + (flip ? size : 0), Math.round(y));
  ctx.scale(flip ? -1 : 1, 1);
  ctx.drawImage(img, frame * size, anim.row * size, size, size, 0, 0, size, size);
  ctx.restore();
}
```

- Keep pixel art at its native size and set `pixelArt: true` in `config.js`; the canvas scales it with integer steps.
- Free CC0 art: https://kenney.nl/assets. Credit everything in `source/assets/CREDITS.md`.
- Greybox sprites without files: draw from tiny pixel strings.

```js
const SLIME = ['..####..', '.######.', '##.##.##', '########', '.#.##.#.'];
export function bakePixels(rows, color) {
  const c = new OffscreenCanvas(rows[0].length, rows.length);
  const g = c.getContext('2d');
  g.fillStyle = color;
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && g.fillRect(x, y, 1, 1)));
  return c; // ctx.drawImage(c, x, y)
}
```

## Procedural levels (seeded)

- Always generate from `game.rng` so `?seed=N` reproduces a level.
- Rooms-and-corridors: place non-overlapping rectangles, connect each room to the next with L-shaped corridors.
- Caves: fill 45% walls randomly, run 4–5 cellular-automaton passes (cell becomes wall if 5+ of its 8 neighbors are walls), keep the largest connected region (flood fill).
- Validate: BFS from start to exit (see ai.md); regenerate if unreachable.
- Difficulty curves: drive spawn rates and enemy speed from a single `difficulty(t)` function in `config.js`.

## Touch controls

Pointer Events already reach `input.pointer` (`x`, `y` in game units, `down`, `pressed`). For buttons on mobile, add HTML buttons to the `#ui` overlay and feed actions:

```js
// index.html: <div class="touch" data-touch hidden><button data-hold="left">◀</button><button data-hold="jump">▲</button></div>
// main.js: show it when (matchMedia('(pointer: coarse)').matches)
for (const el of document.querySelectorAll('[data-hold]')) {
  const code = `Touch_${el.dataset.hold}`; // add 'Touch_left' etc. to the KEYS lists in config.js
  el.addEventListener('pointerdown', () => window.dispatchEvent(new KeyboardEvent('keydown', { code })));
  el.addEventListener('pointerup', () => window.dispatchEvent(new KeyboardEvent('keyup', { code })));
  el.addEventListener('pointerleave', () => window.dispatchEvent(new KeyboardEvent('keyup', { code })));
}
```

Give the overlay buttons `pointer-events: auto`, large hit areas (48 px+) and `touch-action: none`.

## Saves and high scores

`game.storage` (prefixed with `GAME_ID`, never throws): `game.storage.set('best', score)`, `game.storage.get('best', 0)`. Save settings (volume, mute) the same way. Store a `version` field with save games and discard incompatible ones.
