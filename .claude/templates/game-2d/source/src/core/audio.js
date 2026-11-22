// Web Audio wrapper: master / sfx / music buses, mute, unlock on first user gesture, file loading.

export function createAudio() {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  const sfx = ctx.createGain();
  const music = ctx.createGain();
  sfx.connect(master);
  music.connect(master);
  master.connect(ctx.destination);

  /** @type {Map<string, AudioBuffer>} */
  const buffers = new Map();
  let muted = false;
  let volume = 1;

  // Browsers keep the context suspended until a user gesture.
  function unlock() {
    if (ctx.state === 'suspended') ctx.resume();
  }
  for (const type of ['pointerdown', 'keydown', 'touchend']) {
    window.addEventListener(type, unlock, { capture: true });
  }

  function applyVolume() {
    master.gain.setTargetAtTime(muted ? 0 : volume * volume, ctx.currentTime, 0.01);
  }

  return {
    ctx,
    buses: { master, sfx, music },
    get muted() {
      return muted;
    },
    set muted(value) {
      muted = value;
      applyVolume();
    },
    /** Volume 0..1 (squared internally so the slider feels linear). */
    setVolume(/** @type {number} */ value) {
      volume = Math.min(1, Math.max(0, value));
      applyVolume();
    },
    /**
     * Load and decode an audio file.
     * @param {string} name
     * @param {string} url
     */
    async load(name, url) {
      const data = await (await fetch(url)).arrayBuffer();
      buffers.set(name, await ctx.decodeAudioData(data));
    },
    /**
     * Play a loaded buffer.
     * @param {string} name
     * @param {{bus?: 'sfx'|'music', loop?: boolean, gain?: number, rate?: number}} [options]
     */
    play(name, { bus = 'sfx', loop = false, gain = 1, rate = 1 } = {}) {
      const buffer = buffers.get(name);
      if (!buffer || ctx.state !== 'running') return null;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;
      source.playbackRate.value = rate;
      const g = ctx.createGain();
      g.gain.value = gain;
      source.connect(g).connect(bus === 'music' ? music : sfx);
      source.start();
      return source;
    }
  };
}

/** @typedef {ReturnType<typeof createAudio>} Audio */
