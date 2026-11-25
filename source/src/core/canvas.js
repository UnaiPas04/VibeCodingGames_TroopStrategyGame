// Canvas with a fixed logical resolution, scaled to fit the window.

/**
 * @typedef {object} CanvasOptions
 * @property {HTMLCanvasElement} canvas
 * @property {number} width Logical width in game units.
 * @property {number} height Logical height in game units.
 * @property {boolean} [pixelArt=false] Integer scaling and no smoothing (crisp pixels).
 */

/** @param {CanvasOptions} options */
export function createView({ canvas, width, height, pixelArt = false }) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { alpha: false }));
  const view = { canvas, ctx, width, height, scale: 1, pixelArt };

  function resize() {
    const parent = canvas.parentElement ?? document.body;
    const availW = parent.clientWidth;
    const availH = parent.clientHeight;
    let scale = Math.min(availW / width, availH / height);
    if (pixelArt) scale = Math.max(1, Math.floor(scale));
    view.scale = scale;

    // CSS size in CSS pixels; backing store in device pixels for sharp output.
    const cssW = Math.floor(width * scale);
    const cssH = Math.floor(height * scale);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const dpr = pixelArt ? 1 : window.devicePixelRatio || 1;
    canvas.width = pixelArt ? width : Math.floor(cssW * dpr);
    canvas.height = pixelArt ? height : Math.floor(cssH * dpr);

    // Resizing resets the context state, so re-apply everything here.
    const s = canvas.width / width;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.imageSmoothingEnabled = !pixelArt;
    canvas.style.imageRendering = pixelArt ? 'pixelated' : 'auto';
  }

  /**
   * Convert a client (CSS pixel) position to game units.
   * @param {number} clientX
   * @param {number} clientY
   */
  function toGame(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * width,
      y: ((clientY - rect.top) / rect.height) * height
    };
  }

  window.addEventListener('resize', resize);
  resize();
  return Object.assign(view, { resize, toGame });
}
