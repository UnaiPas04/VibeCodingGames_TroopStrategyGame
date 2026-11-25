// Input as named actions over keyboard, pointer/touch and gamepad.
// Usage: input.down('left'), input.pressed('jump'), input.released('jump').
// pressed/released stay true until a fixed update step consumes them (call endStep() after each update).

/** @typedef {Record<string, string[]>} KeyBindings  action -> KeyboardEvent.code list */
/** @typedef {Record<string, number[]>} PadBindings  action -> standard gamepad button indices */

const BLOCKED_DEFAULTS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);

/**
 * @param {object} options
 * @param {KeyBindings} options.keys
 * @param {PadBindings} [options.pad]
 * @param {HTMLElement} [options.target] Element that receives pointer input (usually the canvas).
 * @param {(clientX: number, clientY: number) => {x: number, y: number}} [options.toGame]
 */
export function createInput({ keys, pad = {}, target, toGame }) {
  /** @type {Set<string>} */ const codesDown = new Set();
  /** @type {Set<string>} */ const actionsDown = new Set();
  /** @type {Set<string>} */ const pressedSet = new Set();
  /** @type {Set<string>} */ const releasedSet = new Set();
  /** @type {Set<string>} */ let padDown = new Set();
  /** @type {Set<string>} */ const padPressedSet = new Set();
  // wheel: wheel steps since the last update (+1 per notch scrolled down, -1 up).
  const pointer = { x: 0, y: 0, down: false, pressed: false, released: false, wheel: 0 };
  const axisLeft = { x: 0, y: 0 };

  /** @type {Map<string, string[]>} */
  const actionsByCode = new Map();
  for (const [action, codes] of Object.entries(keys)) {
    for (const code of codes) actionsByCode.set(code, [...(actionsByCode.get(code) ?? []), action]);
  }

  /** @param {string} action */
  function isHeldBySource(action) {
    if (padDown.has(action)) return true;
    return (keys[action] ?? []).some((code) => codesDown.has(code));
  }

  /** @param {string} action */
  function refresh(action) {
    const held = isHeldBySource(action);
    if (held && !actionsDown.has(action)) {
      actionsDown.add(action);
      pressedSet.add(action);
    } else if (!held && actionsDown.has(action)) {
      actionsDown.delete(action);
      releasedSet.add(action);
    }
  }

  /** @param {KeyboardEvent} e */
  function onKeyDown(e) {
    if (BLOCKED_DEFAULTS.has(e.code) && !isTypingTarget(e.target)) e.preventDefault();
    if (e.repeat || isTypingTarget(e.target)) return;
    codesDown.add(e.code);
    for (const action of actionsByCode.get(e.code) ?? []) refresh(action);
  }

  /** @param {KeyboardEvent} e */
  function onKeyUp(e) {
    codesDown.delete(e.code);
    for (const action of actionsByCode.get(e.code) ?? []) refresh(action);
  }

  function clearAll() {
    codesDown.clear();
    padDown.clear();
    for (const action of [...actionsDown]) refresh(action);
    pointer.down = false;
  }

  /** @param {PointerEvent} e */
  function onPointerDown(e) {
    if (toGame) Object.assign(pointer, toGame(e.clientX, e.clientY));
    pointer.down = true;
    pointer.pressed = true;
  }
  /** @param {PointerEvent} e */
  function onPointerMove(e) {
    if (toGame) Object.assign(pointer, toGame(e.clientX, e.clientY));
  }
  /** @param {WheelEvent} e */
  function onWheel(e) {
    if (e.deltaY === 0) return;
    e.preventDefault(); // the wheel drives the game, not the page scroll
    pointer.wheel += Math.sign(e.deltaY);
  }
  function onPointerUp() {
    if (pointer.down) pointer.released = true;
    pointer.down = false;
  }

  function pollGamepads() {
    const pads = navigator.getGamepads?.() ?? [];
    const gp = pads.find((p) => p && p.connected);
    const previous = padDown;
    padDown = new Set();
    axisLeft.x = 0;
    axisLeft.y = 0;
    if (gp) {
      for (const [action, buttons] of Object.entries(pad)) {
        if (buttons.some((i) => gp.buttons[i]?.pressed)) padDown.add(action);
      }
      // Radial deadzone so diagonals are not clipped.
      const x = gp.axes[0] ?? 0;
      const y = gp.axes[1] ?? 0;
      const len = Math.hypot(x, y);
      const dead = 0.2;
      if (len > dead) {
        const k = Math.min(1, (len - dead) / (1 - dead)) / len;
        axisLeft.x = x * k;
        axisLeft.y = y * k;
      }
    }
    for (const action of padDown) if (!previous.has(action)) padPressedSet.add(action);
    for (const action of new Set([...Object.keys(keys), ...Object.keys(pad)])) refresh(action);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearAll);
  if (target) {
    target.addEventListener('pointerdown', onPointerDown);
    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  return {
    pointer,
    axisLeft,
    /** @param {string} action */
    down: (action) => actionsDown.has(action),
    /** @param {string} action */
    pressed: (action) => pressedSet.has(action),
    /** @param {string} action */
    released: (action) => releasedSet.has(action),
    /** Pressed on the gamepad only (used by DOM menus, where the keyboard already works natively). */
    padPressed: (/** @type {string} */ action) => padPressedSet.has(action),
    /** -1, 0 or 1 from two actions, or the gamepad stick when present. */
    axis(/** @type {string} */ negative, /** @type {string} */ positive, /** @type {'x'|'y'} */ stick = 'x') {
      const digital = (actionsDown.has(positive) ? 1 : 0) - (actionsDown.has(negative) ? 1 : 0);
      return digital !== 0 ? digital : axisLeft[stick];
    },
    /** Call once per fixed update, before reading input. */
    beginStep: pollGamepads,
    /** Call after each fixed update: consumes the edge flags. */
    endStep() {
      pressedSet.clear();
      releasedSet.clear();
      padPressedSet.clear();
      pointer.pressed = false;
      pointer.released = false;
      pointer.wheel = 0;
    },
    /** True if any action or the pointer was pressed this step. */
    anyPressed: () => pressedSet.size > 0 || pointer.pressed,
    clearAll
  };
}

/** @param {EventTarget | null} target */
function isTypingTarget(target) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}
