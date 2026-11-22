// Fixed-timestep game loop: update() runs at a constant rate, render() once per frame.

/**
 * @typedef {object} LoopOptions
 * @property {(dt: number) => void} update Called with a fixed dt in seconds.
 * @property {(alpha: number) => void} render Called once per animation frame; alpha in [0, 1) for interpolation.
 * @property {number} [stepHz=60] Simulation rate.
 * @property {number} [maxFrameTime=0.25] Clamp for long frames, avoids the "spiral of death".
 * @property {boolean} [pauseWhenHidden=true] Pause while the tab is hidden. Set false for multiplayer.
 */

/** @param {LoopOptions} options */
export function createLoop({ update, render, stepHz = 60, maxFrameTime = 0.25, pauseWhenHidden = true }) {
  const step = 1 / stepHz;
  let accumulator = 0;
  let last = 0;
  let rafId = 0;
  let running = false;
  let paused = false;

  /** @param {number} now */
  function frame(now) {
    rafId = requestAnimationFrame(frame);
    let delta = (now - last) / 1000;
    last = now;
    if (delta > maxFrameTime) delta = maxFrameTime;
    if (!paused) {
      accumulator += delta;
      while (accumulator >= step) {
        update(step);
        accumulator -= step;
      }
    }
    render(accumulator / step);
  }

  function onVisibility() {
    if (document.hidden) loop.paused = true;
  }

  const loop = {
    step,
    get running() {
      return running;
    },
    get paused() {
      return paused;
    },
    set paused(value) {
      paused = value;
      accumulator = 0;
    },
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(frame);
      if (pauseWhenHidden) document.addEventListener('visibilitychange', onVisibility);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
  return loop;
}
