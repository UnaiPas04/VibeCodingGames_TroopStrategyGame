#!/usr/bin/env node
// Zero-dependency static dev server for the game in source/.
// - Binds 127.0.0.1 (a secure context: WebCrypto and P2P work).
// - Sends Cache-Control: no-store, so edited ES modules are never stale.
// - Live reload: HTML pages reload when a file under the root changes (disable with --no-live).
// - If the port is already serving this game, it reports the URL and exits instead of failing.
//
// Usage: node tools/dev-server.mjs [--port 5180] [--root source] [--no-live]

import { createReadStream, existsSync, statSync, watch } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const PORT = Number(option('port', process.env.PORT ?? 5180));
const HOST = '127.0.0.1';
const ROOT = resolve(option('root', 'source'));
const LIVE = !args.includes('--no-live');
const MARKER = 'x-web-2d-games-dev';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm'
};

const LIVE_SNIPPET = `<script>(() => { const es = new EventSource('/__live'); es.onmessage = () => location.reload(); })();</script>`;

/** @type {Set<import('node:http').ServerResponse>} */
const clients = new Set();

if (!existsSync(ROOT)) {
  console.error(`Root folder not found: ${ROOT}`);
  process.exit(1);
}

const server = createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader(MARKER, ROOT);
  const url = new URL(req.url ?? '/', `http://${HOST}`);

  if (url.pathname === '/__live') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive' });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  let filePath = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = join(filePath, 'index.html');
  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`Not found: ${url.pathname}`);
    return;
  }

  const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  if (LIVE && type.startsWith('text/html')) {
    import('node:fs/promises').then(async ({ readFile }) => {
      const html = await readFile(filePath, 'utf8');
      const body = html.includes('</body>') ? html.replace('</body>', `${LIVE_SNIPPET}</body>`) : html + LIVE_SNIPPET;
      res.writeHead(200, { 'Content-Type': type }).end(body);
    });
    return;
  }
  res.writeHead(200, { 'Content-Type': type });
  createReadStream(filePath).pipe(res);
});

server.on('error', async (err) => {
  if (/** @type {NodeJS.ErrnoException} */ (err).code !== 'EADDRINUSE') throw err;
  try {
    const r = await fetch(`http://${HOST}:${PORT}/`, { method: 'HEAD' });
    if (r.headers.get(MARKER) === ROOT) {
      console.log(`Dev server already running: http://${HOST}:${PORT}/`);
      process.exit(0);
    }
  } catch {
    // Port busy with something that is not HTTP.
  }
  console.error(`Port ${PORT} is in use by another program. Try: npm run dev -- --port ${PORT + 1}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Serving ${ROOT}`);
  console.log(`Dev server: http://${HOST}:${PORT}/${LIVE ? '  (live reload on)' : ''}`);
});

if (LIVE) {
  let timer;
  watch(ROOT, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const res of clients) res.write('data: reload\n\n');
    }, 100);
  });
}
