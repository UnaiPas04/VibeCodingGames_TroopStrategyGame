// UI language: one JSON dictionary per language in ./locales/, only the chosen one is fetched
// (and cached when switching). HTML marks text with data-i18n="key" (and attributes with
// data-i18n-attr="placeholder:key,aria-label:key"); JS uses t('key', { param }).
//
// Initial language: ?lang=xx, then the saved choice, then the browser languages, then the first one.
// Add a language: create locales/<code>.json with every key of en.json and add it to LANGUAGES
// (tests/i18n.test.js checks that no key is missing).

/** Supported languages, named in their own language. The first one is the default. */
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' }
];

/** @typedef {Record<string, string>} Dictionary */

/**
 * Replace {name} placeholders with values. Unknown placeholders are left as they are.
 * @param {string} text
 * @param {Record<string, string | number>} [params]
 */
export function format(text, params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/**
 * First supported language among the candidates (exact code or its base: 'es-ES' -> 'es').
 * @param {(string | null | undefined)[]} candidates In priority order.
 * @param {string[]} supported
 */
export function pickLanguage(candidates, supported) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const code = candidate.toLowerCase();
    if (supported.includes(code)) return code;
    const base = code.split('-')[0];
    if (supported.includes(base)) return base;
  }
  return supported[0];
}

/**
 * Load the starting language and return the translator.
 * @param {object} options
 * @param {{get: <T>(key: string, fallback: T) => T, set: (key: string, value: unknown) => void}} options.storage
 * @param {ParentNode} [options.root] Element whose data-i18n descendants are translated.
 */
export async function createI18n({ storage, root = document }) {
  const codes = LANGUAGES.map((l) => l.code);
  /** @type {Map<string, Dictionary>} */
  const cache = new Map();
  /** @type {Set<(code: string) => void>} */
  const listeners = new Set();
  /** @type {Set<string>} */
  const warned = new Set();
  /** @type {Dictionary} */
  let dict = {};
  let current = codes[0];

  /** @param {string} code */
  async function load(code) {
    const cached = cache.get(code);
    if (cached) return cached;
    const response = await fetch(new URL(`./locales/${code}.json`, import.meta.url));
    if (!response.ok) throw new Error(`Could not load language "${code}" (HTTP ${response.status})`);
    const loaded = /** @type {Dictionary} */ (await response.json());
    cache.set(code, loaded);
    return loaded;
  }

  /**
   * Translate a key. A missing key shows the key itself (and warns once), so it is easy to spot.
   * @param {string} key
   * @param {Record<string, string | number>} [params]
   */
  function t(key, params) {
    const text = dict[key];
    if (text === undefined) {
      if (!warned.has(key)) console.warn(`[i18n] Missing key "${key}" in ${current}.json`);
      warned.add(key);
      return key;
    }
    return format(text, params);
  }

  /** Translate every marked element under `node`. Call after inserting new marked HTML. */
  function apply(node = root) {
    for (const el of node.querySelectorAll('[data-i18n]')) el.textContent = t(el.getAttribute('data-i18n') ?? '');
    for (const el of node.querySelectorAll('[data-i18n-attr]')) {
      for (const pair of (el.getAttribute('data-i18n-attr') ?? '').split(',')) {
        const [attr, key] = pair.split(':').map((s) => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      }
    }
  }

  /** @param {string} code */
  async function setLanguage(code) {
    const next = pickLanguage([code], codes);
    dict = await load(next);
    current = next;
    storage.set('language', next);
    document.documentElement.lang = next;
    apply();
    listeners.forEach((fn) => fn(next));
  }

  const fromUrl = new URLSearchParams(location.search).get('lang');
  await setLanguage(pickLanguage([fromUrl, storage.get('language', ''), ...navigator.languages], codes));

  return {
    t,
    apply,
    setLanguage,
    get language() {
      return current;
    },
    /** Name of the current language, in that language. */
    get languageName() {
      return LANGUAGES.find((l) => l.code === current)?.name ?? current;
    },
    /** Code of the language after the current one (for a "cycle language" button). */
    nextLanguage() {
      return codes[(codes.indexOf(current) + 1) % codes.length];
    },
    /** Called after every language change (refresh texts built in JS). Returns unsubscribe. */
    onChange(/** @type {(code: string) => void} */ fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    }
  };
}

/** @typedef {Awaited<ReturnType<typeof createI18n>>} I18n */
