// Tests for the audio setup: every sound referenced by SOUND_EVENTS exists, and presets are valid.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AUDIO_FILES, SOUND_EVENTS } from '../source/src/config.js';
import { toGain } from '../source/src/core/audio.js';
import { PRESETS } from '../source/src/core/sfx.js';

test('every sound in SOUND_EVENTS is a preset or a file in AUDIO_FILES', () => {
  for (const [event, sound] of Object.entries(SOUND_EVENTS)) {
    const name = typeof sound === 'string' ? sound : sound.name;
    assert.ok(name in PRESETS || name in AUDIO_FILES, `event "${event}" plays unknown sound "${name}"`);
  }
});

test('presets are well formed', () => {
  for (const [name, preset] of Object.entries(PRESETS)) {
    for (const note of Array.isArray(preset) ? preset : [preset]) {
      assert.ok(note.freq > 0 && note.duration > 0, `preset "${name}" needs freq and duration > 0`);
      assert.ok((note.volume ?? 0.3) <= 1, `preset "${name}" is too loud`);
    }
  }
});

test('volume slider maps to gain on a squared curve, clamped', () => {
  assert.equal(toGain(0), 0);
  assert.equal(toGain(0.5), 0.25);
  assert.equal(toGain(1), 1);
  assert.equal(toGain(2), 1);
  assert.equal(toGain(-1), 0);
});
