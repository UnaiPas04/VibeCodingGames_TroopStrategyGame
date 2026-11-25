// Scene stack. The top scene updates; every scene renders bottom to top (so a pause menu draws over play).

/**
 * @typedef {object} Scene
 * @property {string} name
 * @property {(data?: any) => void} [enter]
 * @property {() => void} [exit]
 * @property {(dt: number) => void} [update]
 * @property {(ctx: CanvasRenderingContext2D, alpha: number) => void} [render]
 * @property {() => object} [debugState] Summary exposed through window.__game.
 */

export function createScenes() {
  /** @type {Scene[]} */
  const stack = [];

  return {
    get current() {
      return stack[stack.length - 1];
    },
    get stack() {
      return stack;
    },
    /**
     * Replace the whole stack with one scene.
     * @param {Scene} scene
     * @param {any} [data] Passed to scene.enter().
     */
    switch(scene, data) {
      while (stack.length) stack.pop()?.exit?.();
      stack.push(scene);
      scene.enter?.(data);
    },
    /**
     * @param {Scene} scene
     * @param {any} [data]
     */
    push(scene, data) {
      stack.push(scene);
      scene.enter?.(data);
    },
    pop() {
      stack.pop()?.exit?.();
    },
    update(/** @type {number} */ dt) {
      stack[stack.length - 1]?.update?.(dt);
    },
    render(/** @type {CanvasRenderingContext2D} */ ctx, /** @type {number} */ alpha) {
      for (const scene of stack) scene.render?.(ctx, alpha);
    }
  };
}
