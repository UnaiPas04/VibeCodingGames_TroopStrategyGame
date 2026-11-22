// Tiny event bus to decouple systems (e.g. 'coin:collected' -> score, sound, HUD).

export function createEvents() {
  /** @type {Map<string, Set<(payload: any) => void>>} */
  const handlers = new Map();

  return {
    /**
     * Subscribe. Returns an unsubscribe function.
     * @param {string} type
     * @param {(payload: any) => void} fn
     */
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)?.add(fn);
      return () => handlers.get(type)?.delete(fn);
    },
    /**
     * @param {string} type
     * @param {any} [payload]
     */
    emit(type, payload) {
      for (const fn of handlers.get(type) ?? []) fn(payload);
    },
    clear() {
      handlers.clear();
    }
  };
}

/** @typedef {ReturnType<typeof createEvents>} Events */
