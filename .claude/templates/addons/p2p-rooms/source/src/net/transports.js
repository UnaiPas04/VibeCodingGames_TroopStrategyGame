// Network transports with one shared interface, so the room logic never depends on the library:
//   { selfId, send(data, target?), sendBinary(bytes, target?), onMessage(fn), onBinary(fn),
//     onPeerJoin(fn), onPeerLeave(fn), onError(fn), leave() }
// - 'trystero': real P2P over WebRTC (Trystero, public Nostr relays for discovery, no backend).
// - 'local': BroadcastChannel between tabs/windows of the same browser. Offline and deterministic,
//   for development and automated tests (?net=local).

/** Pinned on purpose: update deliberately and re-test (see the p2p-rooms skill). */
export const TRYSTERO_URL = 'https://esm.run/trystero@0.27.0';

/**
 * @typedef {object} Transport
 * @property {string} selfId
 * @property {(data: any, target?: string) => void} send
 * @property {(bytes: ArrayBuffer | ArrayBufferView, target?: string) => void} sendBinary
 * @property {(fn: (data: any, from: string) => void) => void} onMessage
 * @property {(fn: (bytes: Uint8Array, from: string) => void) => void} onBinary
 * @property {(fn: (id: string) => void) => void} onPeerJoin
 * @property {(fn: (id: string) => void) => void} onPeerLeave
 * @property {(fn: (err: {code?: string, message: string}) => void) => void} onError
 * @property {() => Promise<void>} leave
 */

/**
 * @typedef {object} TransportOptions
 * @property {string} appId Namespaced, unique per game.
 * @property {string} roomId
 * @property {number} [maxUsers]
 * @property {string} [password]
 * @property {any[]} [turnConfig] TURN servers, only if peers cannot connect directly.
 */

/**
 * @param {'trystero' | 'local'} kind
 * @param {TransportOptions} options
 * @returns {Promise<Transport>}
 */
export function createTransport(kind, options) {
  return kind === 'local' ? createLocalTransport(options) : createTrysteroTransport(options);
}

/** @param {TransportOptions} options @returns {Promise<Transport>} */
async function createTrysteroTransport({ appId, roomId, maxUsers, password, turnConfig }) {
  let mod;
  try {
    mod = await import(TRYSTERO_URL);
  } catch (err) {
    throw Object.assign(new Error('Online play unavailable: could not load the P2P library.'), { code: 'load-failed', cause: err });
  }
  // identity 'none': every tab is a different player (the default 'local' shares one id per browser).
  const room = mod.joinRoom({ appId, identity: 'none', maxUsers, password, turnConfig }, roomId);
  const { userId } = await room.getSelf();
  const msg = room.makeAction('msg');
  const bin = room.makeAction('bin');
  /** @param {any} err */
  const warn = (err) => console.warn('[net] send failed:', err?.kind ?? err?.message ?? err);

  return {
    selfId: userId,
    send: (data, target) => void msg.send(data, target ? { target } : undefined).catch(warn),
    sendBinary: (bytes, target) => void bin.send(bytes, target ? { target } : undefined).catch(warn),
    onMessage: (fn) => void msg.onMessage((/** @type {any} */ data, /** @type {any} */ ctx) => fn(data, ctx.userId)),
    onBinary: (fn) => void bin.onMessage((/** @type {any} */ bytes, /** @type {any} */ ctx) => fn(bytes, ctx.userId)),
    onPeerJoin: (fn) => void room.onUserJoin((/** @type {any} */ ctx) => fn(ctx.userId)),
    onPeerLeave: (fn) => void room.onUserLeave((/** @type {any} */ ctx) => fn(ctx.userId)),
    onError: (fn) => void room.onError(fn),
    leave: () => room.leave()
  };
}

/** @param {TransportOptions} options @returns {Promise<Transport>} */
async function createLocalTransport({ appId, roomId }) {
  const selfId = `local-${Math.random().toString(36).slice(2, 10)}`;
  const channel = new BroadcastChannel(`${appId}/${roomId}`);
  /** @type {Map<string, number>} */ const lastSeen = new Map();
  /** @type {Record<string, Function[]>} */
  const handlers = { message: [], binary: [], join: [], leave: [], error: [] };
  const emit = (/** @type {string} */ type, /** @type {any[]} */ ...args) => handlers[type].forEach((fn) => fn(...args));
  const post = (/** @type {object} */ m) => channel.postMessage({ ...m, from: selfId });
  const TIMEOUT_MS = 10000; // generous: hidden tabs throttle timers

  /** @param {string} id */
  function markSeen(id) {
    const isNew = !lastSeen.has(id);
    lastSeen.set(id, Date.now());
    if (isNew) emit('join', id);
  }
  /** @param {string} id */
  function drop(id) {
    if (lastSeen.delete(id)) emit('leave', id);
  }

  channel.onmessage = ({ data: m }) => {
    if (m.to && m.to !== selfId) return;
    switch (m.kind) {
      case 'hello':
        markSeen(m.from);
        post({ kind: 'here', to: m.from });
        break;
      case 'here':
      case 'ping':
        markSeen(m.from);
        break;
      case 'bye':
        drop(m.from);
        break;
      case 'msg':
        markSeen(m.from);
        emit('message', m.data, m.from);
        break;
      case 'bin':
        markSeen(m.from);
        emit('binary', new Uint8Array(m.data), m.from);
        break;
    }
  };

  const heartbeat = setInterval(() => {
    post({ kind: 'ping' });
    const now = Date.now();
    for (const [id, t] of lastSeen) if (now - t > TIMEOUT_MS) drop(id);
  }, 1000);
  const onUnload = () => post({ kind: 'bye' });
  window.addEventListener('pagehide', onUnload);
  post({ kind: 'hello' });

  return {
    selfId,
    send: (data, target) => post({ kind: 'msg', to: target, data }),
    sendBinary: (bytes, target) => {
      const view = ArrayBuffer.isView(bytes) ? bytes : new Uint8Array(bytes);
      post({ kind: 'bin', to: target, data: new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice().buffer });
    },
    onMessage: (fn) => void handlers.message.push(fn),
    onBinary: (fn) => void handlers.binary.push(fn),
    onPeerJoin: (fn) => void handlers.join.push(fn),
    onPeerLeave: (fn) => void handlers.leave.push(fn),
    onError: (fn) => void handlers.error.push(fn),
    async leave() {
      post({ kind: 'bye' });
      clearInterval(heartbeat);
      window.removeEventListener('pagehide', onUnload);
      channel.close();
    }
  };
}
