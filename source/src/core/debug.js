// Debug tools: overlay (FPS, frame time, entities, hitboxes), on-screen error banner and window.__game.
// Toggle the overlay with the Backquote key (left of 1; "º" on Spanish keyboards) or start with ?debug.
// window.__game.errors is created by the inline script in index.html so module load errors are caught too.

/**
 * @typedef {object} DebugHandle
 * @property {boolean} enabled
 * @property {(ctx: CanvasRenderingContext2D) => void} drawOverlay
 * @property {(ctx: CanvasRenderingContext2D, rect: {x: number, y: number, w: number, h: number}, color?: string) => void} box
 * @property {(dt: number) => void} tick Call once per rendered frame with the real frame time.
 * @property {(n: number) => void} setEntityCount
 * @property {(name: string, value: unknown) => void} expose
 */

/**
 * @param {object} options
 * @param {boolean} options.enabled
 * @param {() => object} options.getState Summary for automated checks (scene, score, positions...).
 * @returns {DebugHandle}
 */
export function createDebug({ enabled, getState }) {
  const g = /** @type {any} */ (window).__game ?? { errors: [] };
  /** @type {any} */ (window).__game = g;
  g.frame = 0;
  Object.defineProperty(g, 'state', { get: getState, configurable: true });

  const panel = document.createElement('pre');
  panel.id = 'debug-overlay';
  panel.hidden = true;
  document.body.append(panel);

  let fps = 0;
  let frameMs = 0;
  let entities = 0;
  let acc = 0;
  let frames = 0;

  const debug = {
    enabled,
    tick(/** @type {number} */ dt) {
      g.frame++;
      acc += dt;
      frames++;
      frameMs = dt * 1000;
      if (acc >= 0.5) {
        fps = Math.round(frames / acc);
        acc = 0;
        frames = 0;
      }
    },
    setEntityCount(/** @type {number} */ n) {
      entities = n;
    },
    /** Publish a helper on window.__game for automated checks (e.g. window.__game.play.act(...)). */
    expose(/** @type {string} */ name, /** @type {unknown} */ value) {
      g[name] = value;
    },
    // The overlay is HTML (crisp at any canvas scale); the ctx argument keeps the call site uniform.
    drawOverlay(/** @type {CanvasRenderingContext2D} */ _ctx) {
      panel.hidden = !debug.enabled;
      if (!debug.enabled || g.frame % 15 !== 0) return;
      panel.textContent = `FPS ${fps}  ${frameMs.toFixed(1)} ms
entities ${entities}
errors ${g.errors.length}
scene ${getState().scene ?? '-'}`;
    },
    box(/** @type {CanvasRenderingContext2D} */ ctx, /** @type {{x:number,y:number,w:number,h:number}} */ r, color = '#ff00ff') {
      if (!debug.enabled) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, r.w - 1, r.h - 1);
      ctx.restore();
    }
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') debug.enabled = !debug.enabled;
  });

  return debug;
}
