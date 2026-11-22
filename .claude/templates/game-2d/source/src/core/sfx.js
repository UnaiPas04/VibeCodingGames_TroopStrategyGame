// Procedural sound effects: no audio files needed for prototypes.
// Usage: playSfx(audio, 'coin'). Add presets to PRESETS to taste.

/**
 * @typedef {object} SfxPreset
 * @property {OscillatorType | 'noise'} wave
 * @property {number} freq Start frequency (Hz).
 * @property {number} [freqEnd] End frequency (Hz), exponential slide.
 * @property {number} duration Seconds.
 * @property {number} [volume=0.3]
 * @property {number} [attack=0.005]
 * @property {number} [jitter=0.05] Random pitch variation so repeats don't sound mechanical.
 */

/** @type {Record<string, SfxPreset | SfxPreset[]>} */
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

/** @type {WeakMap<AudioContext, AudioBuffer>} */
const noiseCache = new WeakMap();

/** @param {AudioContext} ctx */
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
 * @param {{ctx: AudioContext, buses: {sfx: AudioNode}}} audio
 * @param {string | SfxPreset | SfxPreset[]} sound Preset name or definition.
 */
export function playSfx(audio, sound) {
  const { ctx } = audio;
  if (ctx.state !== 'running') return;
  const def = typeof sound === 'string' ? PRESETS[sound] : sound;
  if (!def) throw new Error(`Unknown sfx preset: ${sound}`);
  const notes = Array.isArray(def) ? def : [def];
  let t = ctx.currentTime;
  for (const note of notes) {
    playNote(audio, note, t);
    t += note.duration;
  }
}

/**
 * @param {{ctx: AudioContext, buses: {sfx: AudioNode}}} audio
 * @param {SfxPreset} note
 * @param {number} t
 */
function playNote(audio, note, t) {
  const { ctx } = audio;
  const { wave, duration, volume = 0.3, attack = 0.005, jitter = 0.05 } = note;
  const pitch = 1 + (Math.random() * 2 - 1) * jitter;
  const freq = note.freq * pitch;
  const freqEnd = (note.freqEnd ?? note.freq) * pitch;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  gain.connect(audio.buses.sfx);

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
