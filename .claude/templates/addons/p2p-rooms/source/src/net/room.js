// Rooms on top of a transport: short codes, creator = host, host-authoritative roster.
//
//   const room = await createRoom({ appId, name: 'Ana' });     // host
//   const room = await joinRoom('K7M2Q', { appId, name: 'Bo' }); // guest (rejects if missing or full)
//   room.on('move', (data, from) => ...);  room.send('move', {x, y});  room.send('hit', {}, targetId);
//   room.onRoster((players) => ...);  room.onClosed((reason) => ...);
//
// Message types starting with '_' are reserved for this module.

import { createTransport } from './transports.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I

/**
 * @typedef {object} Player
 * @property {string} id
 * @property {string} name
 * @property {string} color
 * @property {boolean} ready
 */

/**
 * @typedef {object} RoomOptions
 * @property {string} appId Namespaced id, unique per game: `web-2d-games/${GAME_ID}`.
 * @property {string} [name]
 * @property {string} [color]
 * @property {number} [maxUsers=4] Including the host.
 * @property {string} [password]
 * @property {'trystero' | 'local'} [transport] Defaults to 'local' with ?net=local, else 'trystero'.
 * @property {number} [joinTimeoutMs] How long a guest waits for the host.
 * @property {any[]} [turnConfig]
 */

export function randomCode(length = 5) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

/** Normalize what a player typed: uppercase, no spaces. */
export const normalizeCode = (/** @type {string} */ code) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

/** @param {RoomOptions} options */
export function createRoom(options) {
  return openRoom(randomCode(), true, options);
}

/** @param {string} code @param {RoomOptions} options */
export function joinRoom(code, options) {
  return openRoom(normalizeCode(code), false, options);
}

/**
 * @param {string} code
 * @param {boolean} isHost
 * @param {RoomOptions} options
 */
async function openRoom(code, isHost, options) {
  const net = new URLSearchParams(location.search).get('net');
  const kind = options.transport ?? (net === 'local' ? 'local' : 'trystero');
  const maxUsers = options.maxUsers ?? 4;
  const transport = await createTransport(kind, {
    appId: options.appId,
    roomId: code,
    maxUsers,
    password: options.password,
    turnConfig: options.turnConfig
  });
  const selfId = transport.selfId;

  /** @type {Map<string, Player>} */
  const players = new Map();
  /** @type {Player} */
  const me = { id: selfId, name: options.name ?? 'Player', color: options.color ?? '#f4d35e', ready: false };
  let hostId = isHost ? selfId : '';
  let closed = false;
  if (isHost) players.set(selfId, me);

  /** @type {Map<string, Set<(data: any, from: string) => void>>} */
  const handlers = new Map();
  const listeners = {
    /** @type {((players: Player[]) => void)[]} */ roster: [],
    /** @type {((reason: string) => void)[]} */ closed: [],
    /** @type {((bytes: Uint8Array, from: string) => void)[]} */ binary: [],
    /** @type {((err: {code?: string, message: string}) => void)[]} */ error: []
  };

  const list = () => [...players.values()];
  /**
   * @param {string} t
   * @param {any} d
   * @param {string} [target]
   */
  const send = (t, d, target) => transport.send({ t, d }, target);
  const broadcastRoster = () => {
    send('_roster', list());
    listeners.roster.forEach((fn) => fn(list()));
  };
  /** @param {string} reason */
  function close(reason) {
    if (closed) return;
    closed = true;
    transport.leave();
    listeners.closed.forEach((fn) => fn(reason));
  }

  /** @type {(value: any) => void} */ let resolveJoin = () => {};
  /** @type {(err: Error) => void} */ let rejectJoin = () => {};
  const joined = new Promise((resolve, reject) => {
    resolveJoin = resolve;
    rejectJoin = reject;
  });

  transport.onPeerJoin((id) => {
    if (!isHost && !hostId) send('_hello', { name: me.name, color: me.color }, id);
  });

  transport.onPeerLeave((id) => {
    if (!isHost && id === hostId) close('host-left');
    else if (isHost && players.delete(id)) broadcastRoster();
  });

  transport.onError((err) => listeners.error.forEach((fn) => fn(err)));
  transport.onBinary((bytes, from) => listeners.binary.forEach((fn) => fn(bytes, from)));

  transport.onMessage((msg, from) => {
    if (!msg || typeof msg.t !== 'string') return;
    const { t, d } = msg;
    switch (t) {
      case '_hello':
        if (!isHost) return;
        if (!players.has(from) && players.size >= maxUsers) {
          send('_reject', { reason: 'room-full' }, from);
          return;
        }
        players.set(from, { id: from, name: String(d?.name ?? 'Player').slice(0, 20), color: String(d?.color ?? '#ffffff'), ready: false });
        send('_welcome', { players: list() }, from);
        broadcastRoster();
        return;
      case '_welcome':
        if (isHost || hostId) return;
        hostId = from;
        replacePlayers(d.players);
        resolveJoin(true);
        return;
      case '_reject':
        if (!hostId) rejectJoin(Object.assign(new Error('Room is full'), { code: d?.reason ?? 'rejected' }));
        return;
      case '_roster':
        if (from !== hostId) return;
        replacePlayers(d);
        listeners.roster.forEach((fn) => fn(list()));
        return;
      case '_profile': {
        const p = isHost ? players.get(from) : undefined;
        if (!p) return;
        Object.assign(p, pickProfile(d));
        broadcastRoster();
        return;
      }
      case '_close':
        if (from === hostId) close(d?.reason ?? 'host-closed');
        return;
      default:
        if (t.startsWith('_')) return;
        handlers.get(t)?.forEach((fn) => fn(d, from));
    }
  });

  /** @param {Player[]} incoming */
  function replacePlayers(incoming) {
    players.clear();
    for (const p of incoming ?? []) players.set(p.id, p);
    const mine = players.get(selfId);
    if (mine) Object.assign(me, mine);
  }

  if (isHost) {
    resolveJoin(true);
  } else {
    const timeoutMs = options.joinTimeoutMs ?? (kind === 'local' ? 3000 : 20000);
    const timer = setTimeout(() => rejectJoin(Object.assign(new Error('Room not found'), { code: 'room-not-found' })), timeoutMs);
    try {
      await joined;
    } catch (err) {
      await transport.leave();
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    code,
    selfId,
    transport: kind,
    get isHost() {
      return isHost;
    },
    get hostId() {
      return hostId;
    },
    get players() {
      return list();
    },
    get closed() {
      return closed;
    },
    /** Invite link for this room (same page, #room=CODE, keeps ?net=local if set). */
    get inviteUrl() {
      const url = new URL(location.href);
      url.hash = `room=${code}`;
      return url.toString();
    },
    /**
     * Send a game message to everyone (or one player). Type: short name without a leading '_'.
     * @param {string} type @param {any} [data] @param {string} [target]
     */
    send(type, data, target) {
      if (type.startsWith('_')) throw new Error(`Message types starting with "_" are reserved: ${type}`);
      send(type, data, target);
    },
    /** Send bytes (e.g. a Float32Array snapshot). Cheaper than JSON for frequent updates. */
    /**
     * @param {ArrayBuffer | ArrayBufferView} bytes
     * @param {string} [target]
     */
    sendBinary(bytes, target) {
      transport.sendBinary(bytes, target);
    },
    /** @param {string} type @param {(data: any, from: string) => void} fn */
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)?.add(fn);
      return () => handlers.get(type)?.delete(fn);
    },
    onBinary: (/** @type {(bytes: Uint8Array, from: string) => void} */ fn) => void listeners.binary.push(fn),
    onRoster: (/** @type {(players: Player[]) => void} */ fn) => void listeners.roster.push(fn),
    onClosed: (/** @type {(reason: string) => void} */ fn) => void listeners.closed.push(fn),
    onError: (/** @type {(err: {code?: string, message: string}) => void} */ fn) => void listeners.error.push(fn),
    /** Update my name, color or ready flag. */
    setProfile(/** @type {Partial<Player>} */ changes) {
      Object.assign(me, pickProfile(changes));
      if (isHost) broadcastRoster();
      else send('_profile', pickProfile(changes), hostId);
    },
    async leave() {
      if (isHost) send('_close', { reason: 'host-left' });
      close('left');
    }
  };
}

/** @param {any} d */
function pickProfile(d) {
  /** @type {Partial<Player>} */
  const out = {};
  if (typeof d?.name === 'string') out.name = d.name.slice(0, 20);
  if (typeof d?.color === 'string') out.color = d.color;
  if (typeof d?.ready === 'boolean') out.ready = d.ready;
  return out;
}

/** @typedef {Awaited<ReturnType<typeof createRoom>>} Room */
