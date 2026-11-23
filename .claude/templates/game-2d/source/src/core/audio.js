// Audio: the only module that touches Web Audio. Callers say WHAT to play, by name; this module
// decides HOW:
// - sounds: a file loaded with load() under that name, otherwise the procedural preset with that
//   name (core/sfx.js). Swapping a beep for a real file is adding it to AUDIO_FILES in config.js.
// - music: one looping track at a time, with fades.
// - settings (mute, volume per bus) are saved between sessions.
// - the AudioContext is created on the first user gesture (browsers block audio before that).
// Gameplay code does not call this module directly: it emits events, and bindEvents() maps them to
// sounds in one place (SOUND_EVENTS in config.js).

import { PRESETS, playPreset } from './sfx.js';

/** @typedef {'master' | 'sfx' | 'music'} Bus */
/** @typedef {{muted: boolean, master: number, sfx: number, music: number}} AudioSettings */
/** @typedef {string | {name: string, volume?: number}} SoundRef  A sound name, or a name with options. */

/** @type {AudioSettings} */
export const DEFAULT_SETTINGS = { muted: false, master: 0.8, sfx: 1, music: 0.6 };

/** Slider value 0..1 to gain. Squared so the slider feels even (hearing is not linear). @param {number} v */
export const toGain = (v) => Math.min(1, Math.max(0, v)) ** 2;

/**
 * @param {object} options
 * @param {{get: <T>(key: string, fallback: T) => T, set: (key: string, value: unknown) => void}} options.storage
 */
export function createAudio({ storage }) {
  /** @type {AudioSettings} */
  const settings = { ...DEFAULT_SETTINGS, ...storage.get('audio', {}) };
  /** @type {AudioContext | null} */
  let ctx = null;
  /** @type {Record<Bus, GainNode> | null} */
  let buses = null;
  /** @type {Map<string, AudioBuffer>} */
  const buffers = new Map();
  /** @type {Map<string, ArrayBuffer>} Files fetched before the context exists, decoded on unlock. */
  const undecoded = new Map();
  /** @type {Set<string>} */
  const warned = new Set();
  /** @type {{name: string, source: AudioBufferSourceNode, gain: GainNode} | null} */
  let music = null;
  /** Track requested before the context could play it. */
  let wantedMusic = '';

  const save = () => storage.set('audio', settings);

  function applySettings() {
    if (!ctx || !buses) return;
    const now = ctx.currentTime;
    buses.master.gain.setTargetAtTime(settings.muted ? 0 : toGain(settings.master), now, 0.01);
    buses.sfx.gain.setTargetAtTime(toGain(settings.sfx), now, 0.01);
    buses.music.gain.setTargetAtTime(toGain(settings.music), now, 0.01);
  }

  /** @param {string} name @param {ArrayBuffer} data */
  async function decode(name, data) {
    if (!ctx) return;
    buffers.set(name, await ctx.decodeAudioData(data));
    if (wantedMusic === name && !music) startMusic(name, 0.5);
  }

  function unlock() {
    if (!ctx) {
      ctx = new AudioContext();
      const master = ctx.createGain();
      buses = { master, sfx: ctx.createGain(), music: ctx.createGain() };
      buses.sfx.connect(master);
      buses.music.connect(master);
      master.connect(ctx.destination);
      applySettings();
      for (const [name, data] of undecoded) decode(name, data);
      undecoded.clear();
    }
    if (ctx.state === 'suspended') ctx.resume();
    if (wantedMusic && !music && buffers.has(wantedMusic)) startMusic(wantedMusic, 0.5);
  }
  for (const type of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(type, unlock, { capture: true });

  const ready = () => ctx !== null && buses !== null && ctx.state === 'running';

  /** @param {string} name @param {number} fade */
  function startMusic(name, fade) {
    const buffer = buffers.get(name);
    if (!ctx || !buses || !buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + fade);
    source.connect(gain).connect(buses.music);
    source.start();
    music = { name, source, gain };
  }

  /** @param {number} fade */
  function fadeOutMusic(fade) {
    if (!ctx || !music) return;
    const { source, gain } = music;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
    source.stop(ctx.currentTime + fade);
    music = null;
  }

  const audio = {
    /**
     * Fetch audio files now (decoded once audio is unlocked). A file named like a preset replaces it.
     * @param {Record<string, string>} files name -> URL relative to index.html, e.g. { coin: './assets/coin.wav' }
     */
    async load(files) {
      await Promise.all(
        Object.entries(files).map(async ([name, url]) => {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Could not load sound "${name}" from ${url} (HTTP ${response.status})`);
          const data = await response.arrayBuffer();
          if (ctx) await decode(name, data);
          else undecoded.set(name, data);
        })
      );
    },

    /**
     * Play a sound effect by name (loaded file first, then procedural preset). Silent until unlocked.
     * @param {SoundRef} sound
     * @param {{volume?: number, rate?: number}} [options]
     */
    play(sound, options = {}) {
      const name = typeof sound === 'string' ? sound : sound.name;
      const volume = (typeof sound === 'string' ? 1 : (sound.volume ?? 1)) * (options.volume ?? 1);
      if (!ready() || !ctx || !buses) return;
      const buffer = buffers.get(name);
      if (buffer) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = options.rate ?? 1;
        const gain = ctx.createGain();
        gain.gain.value = volume;
        source.connect(gain).connect(buses.sfx);
        source.start();
      } else if (PRESETS[name]) {
        playPreset(ctx, buses.sfx, PRESETS[name], volume);
      } else if (!undecoded.has(name) && !warned.has(name)) {
        warned.add(name);
        console.warn(`[audio] Unknown sound "${name}": add a preset in core/sfx.js or a file in AUDIO_FILES`);
      }
    },

    /** Music: one looping track at a time (loaded files only). Cross-fades from the current one. */
    music: {
      /** @param {string} name @param {{fade?: number}} [options] */
      play(name, { fade = 0.5 } = {}) {
        wantedMusic = name;
        if (music?.name === name) return;
        fadeOutMusic(fade);
        if (ready()) startMusic(name, fade);
      },
      /** @param {{fade?: number}} [options] */
      stop({ fade = 0.5 } = {}) {
        wantedMusic = '';
        fadeOutMusic(fade);
      },
      get current() {
        return music?.name ?? '';
      }
    },

    get muted() {
      return settings.muted;
    },
    /** @param {boolean} value */
    setMuted(value) {
      settings.muted = value;
      applySettings();
      save();
    },
    toggleMuted() {
      audio.setMuted(!settings.muted);
      return settings.muted;
    },
    /** @param {Bus} bus */
    volume(bus) {
      return settings[bus];
    },
    /** @param {Bus} bus @param {number} value 0..1 (slider position) */
    setVolume(bus, value) {
      settings[bus] = Math.min(1, Math.max(0, value));
      applySettings();
      save();
    },

    /**
     * Play sounds when events happen: the single place that decides what each event sounds like.
     * Returns a function that removes every binding.
     * @param {{on: (type: string, fn: (payload: any) => void) => () => void}} events
     * @param {Record<string, SoundRef>} map event name -> sound
     */
    bindEvents(events, map) {
      const offs = Object.entries(map).map(([type, sound]) => events.on(type, () => audio.play(sound)));
      return () => offs.forEach((off) => off());
    }
  };
  return audio;
}

/** @typedef {ReturnType<typeof createAudio>} Audio */
