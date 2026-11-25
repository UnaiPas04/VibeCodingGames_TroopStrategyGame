// Tests for UI translations: every language has every key, and every key used in the code exists.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { LANGUAGES, format, pickLanguage } from '../source/src/i18n/i18n.js';

const SOURCE = fileURLToPath(new URL('../source/', import.meta.url));
const LOCALES = join(SOURCE, 'src/i18n/locales');

/** @param {string} code @returns {Record<string, string>} */
const readLocale = (code) => JSON.parse(readFileSync(join(LOCALES, `${code}.json`), 'utf8'));

/** @param {string} dir @returns {string[]} */
function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'vendor' || name === 'i18n') return []; // third-party code; the i18n module's own docs
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

/** Keys referenced in HTML (data-i18n, data-i18n-attr) and JS (string literals shaped like 'area.key'). */
function usedKeys() {
  const keys = new Set();
  for (const file of listFiles(SOURCE)) {
    if (!/\.(html|js)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/data-i18n="([^"]+)"/g)) keys.add(m[1]);
    for (const m of text.matchAll(/data-i18n-attr="([^"]+)"/g)) {
      for (const pair of m[1].split(',')) keys.add(pair.split(':')[1].trim());
    }
    if (file.endsWith('.js')) {
      for (const m of text.matchAll(/'([a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+)'/g)) {
        if (!/\.(js|json|html|css|png|wav|mp3|ogg)$/.test(m[1])) keys.add(m[1]);
      }
    }
  }
  return keys;
}

const placeholders = (/** @type {string} */ s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('every language has exactly the keys of the default language, with the same placeholders', () => {
  const [base, ...others] = LANGUAGES.map((l) => l.code);
  const reference = readLocale(base);
  for (const code of others) {
    const dict = readLocale(code);
    assert.deepEqual(Object.keys(dict).sort(), Object.keys(reference).sort(), `${code}.json keys differ from ${base}.json`);
    for (const [key, text] of Object.entries(dict)) {
      assert.ok(text.trim(), `${code}.json: "${key}" is empty`);
      assert.deepEqual(placeholders(text), placeholders(reference[key]), `${code}.json: "${key}" placeholders differ`);
    }
  }
});

test('every key used in HTML and JS exists', () => {
  const dict = readLocale(LANGUAGES[0].code);
  const missing = [...usedKeys()].filter((key) => !(key in dict));
  assert.deepEqual(missing, [], `missing in ${LANGUAGES[0].code}.json`);
});

test('format fills placeholders and leaves unknown ones', () => {
  assert.equal(format('{name} wins!', { name: 'Ana' }), 'Ana wins!');
  assert.equal(format('{a} and {b}', { a: 1 }), '1 and {b}');
  assert.equal(format('No params'), 'No params');
});

test('pickLanguage: first supported candidate, base language, then the default', () => {
  const supported = ['en', 'es'];
  assert.equal(pickLanguage([null, 'es-ES', 'en'], supported), 'es');
  assert.equal(pickLanguage(['fr', 'EN-gb'], supported), 'en');
  assert.equal(pickLanguage(['de', undefined], supported), 'en');
});
