// localStorage namespaced by GAME_ID (every prototype shares the same localhost origin).
// Never throws: private windows or blocked storage just behave like empty storage.

/** @param {string} gameId */
export function createStorage(gameId) {
  const prefix = `${gameId}:`;
  return {
    /** @template T @param {string} key @param {T} fallback @returns {T} */
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(prefix + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    /** @param {string} key @param {unknown} value */
    set(key, value) {
      try {
        localStorage.setItem(prefix + key, JSON.stringify(value));
      } catch {
        // Storage unavailable or full: ignore in a prototype.
      }
    },
    /** @param {string} key */
    remove(key) {
      try {
        localStorage.removeItem(prefix + key);
      } catch {
        // ignore
      }
    }
  };
}
