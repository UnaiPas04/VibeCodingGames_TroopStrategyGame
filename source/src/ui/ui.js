// DOM overlay UI: screens (menus) and HUD. The canvas only draws the game world.
// Screens are <section data-screen="name"> inside #ui; buttons use data-action="name".

/**
 * @param {object} options
 * @param {HTMLElement} options.root The #ui element.
 * @param {(action: string, button: HTMLElement) => void} options.onAction
 */
export function createUi({ root, onAction }) {
  /** @type {HTMLElement | null} */
  let active = null;

  root.addEventListener('click', (e) => {
    const button = /** @type {HTMLElement} */ (e.target).closest('[data-action]');
    if (button instanceof HTMLElement) onAction(button.dataset.action ?? '', button);
  });

  /** Move focus to the next (+1) or previous (-1) control of the active screen. */
  function moveFocus(/** @type {number} */ delta) {
    if (!active) return;
    const items = /** @type {HTMLElement[]} */ ([...active.querySelectorAll('button:not([disabled]):not([hidden]), input, select')]).filter(
      (el) => el.offsetParent !== null
    );
    if (!items.length) return;
    const index = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    items[(index + delta + items.length) % items.length].focus();
  }

  // Keyboard focus navigation inside the active screen (Tab also works natively).
  window.addEventListener('keydown', (e) => {
    if (!active) return;
    const isText = document.activeElement instanceof HTMLInputElement;
    if (e.code === 'ArrowDown' || (e.code === 'ArrowRight' && !isText)) {
      moveFocus(1);
      e.preventDefault();
    } else if (e.code === 'ArrowUp' || (e.code === 'ArrowLeft' && !isText)) {
      moveFocus(-1);
      e.preventDefault();
    }
  });

  return {
    /** Show one screen (or none with null) and focus its first control. */
    show(/** @type {string | null} */ name) {
      for (const el of root.querySelectorAll('[data-screen]')) {
        /** @type {HTMLElement} */ (el).hidden = el.getAttribute('data-screen') !== name;
      }
      active = name ? root.querySelector(`[data-screen="${name}"]`) : null;
      /** @type {HTMLElement | null | undefined} */ (active?.querySelector('button, input'))?.focus();
    },
    moveFocus,
    /**
     * Gamepad support for menus: d-pad moves focus, A clicks the focused control.
     * Call from the update() of scenes that show a menu.
     * @param {{padPressed: (action: string) => boolean}} input
     */
    navigate(input) {
      if (input.padPressed('down')) moveFocus(1);
      if (input.padPressed('up')) moveFocus(-1);
      if (input.padPressed('confirm') && document.activeElement instanceof HTMLButtonElement) document.activeElement.click();
    },
    get screen() {
      return active?.getAttribute('data-screen') ?? null;
    },
    /** Set a HUD/text value: <span data-bind="score"></span>. */
    set(/** @type {string} */ key, /** @type {string | number} */ value) {
      for (const el of root.querySelectorAll(`[data-bind="${key}"]`)) el.textContent = String(value);
    },
    hud(/** @type {boolean} */ visible) {
      const hud = root.querySelector('[data-hud]');
      if (hud instanceof HTMLElement) hud.hidden = !visible;
    },
    async toggleFullscreen() {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen?.();
    }
  };
}

/** @typedef {ReturnType<typeof createUi>} Ui */
