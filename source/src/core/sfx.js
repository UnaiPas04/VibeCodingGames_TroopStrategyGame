// Procedural sound effects (internal to core/audio.js): no audio files needed for prototypes.
// Add or tune presets here; play them by name with game.audio.play('coin') or through SOUND_EVENTS.

/**
 * One note of a preset.
 * @typedef {object} SfxNote
 * @property {OscillatorType | 'noise'} wave
 * @property {number} freq Start frequency (Hz).
 * @property {number} [freqEnd] End frequency (Hz), exponential slide.
 * @property {number} duration Seconds.
 * @property {number} [volume=0.3]
 * @property {number} [attack=0.005]
 * @property {number} [jitter=0.05] Random pitch variation so repeats don't sound mechanical.
 */

/** @typedef {SfxNote | SfxNote[]} SfxPreset  An array plays its notes one after another. */

/** @type {Record<string, SfxPreset>} */
export const PRESETS = {
  coin: [
    { wave: 'square', freq: 988, duration: 0.06, volume: 0.2 },
    { wave: 'square', freq: 1319, duration: 0.18, volume: 0.2 }
  ],
  jump: { wave: 'square', freq: 220, freqEnd: 660, duration: 0.15, volume: 0.2 },
  hit: { wave: 'sawtooth', freq: 300, freqEnd: 60, duration: 0.15, volume: 0.3 },
  explosion: { wave: 'noise', freq: 1000, freqEnd: 60, duration: 0.5, volume: 0.4 },
  powerup: [
    { wave: 'triangle', freq: 523, duration: 0.08 },
    { wave: 'triangle', freq: 659, duration: 0.08 },
    { wave: 'triangle', freq: 784, duration: 0.08 },
    { wave: 'triangle', freq: 1047, duration: 0.2 }
  ],
  select: { wave: 'square', freq: 660, duration: 0.05, volume: 0.15 },
  lose: { wave: 'triangle', freq: 440, freqEnd: 110, duration: 0.6, volume: 0.3 }
};

/** @type {WeakMap<BaseAudioContext, AudioBuffer>} */
const noiseCache = new WeakMap();

/** @param {BaseAudioContext} ctx */
function noiseBuffer(ctx) {
  let buffer = noiseCache.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buffer);
  }
  return buffer;
}

/**
 * Schedule a preset now on `destination`.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} destination
 * @param {SfxPreset} preset
 * @param {number} [volume=1] Multiplier for every note.
 */
export function playPreset(ctx, destination, preset, volume = 1) {
  let t = ctx.currentTime;
  for (const note of Array.isArray(preset) ? preset : [preset]) {
    playNote(ctx, destination, note, t, volume);
    t += note.duration;
  }
}

/**
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} destination
 * @param {SfxNote} note
 * @param {number} t Start time.
 * @param {number} volumeScale
 */
function playNote(ctx, destination, note, t, volumeScale) {
  const { wave, duration, volume = 0.3, attack = 0.005, jitter = 0.05 } = note;
  const pitch = 1 + (Math.random() * 2 - 1) * jitter;
  const freq = note.freq * pitch;
  const freqEnd = (note.freqEnd ?? note.freq) * pitch;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume * volumeScale, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  gain.connect(destination);

  if (wave === 'noise') {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + duration);
    src.connect(filter).connect(gain);
    src.start(t);
    src.stop(t + duration);
  } else {
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + duration);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + duration);
  }
}
