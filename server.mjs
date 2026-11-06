import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { research, ResearchError } from './research.mjs';
import { FONTS } from './fonts.mjs';

// Check every A and AAAA answer from the same resolver Node's fetch uses.
const resolveHost = async (host) => (await lookup(host, { all: true, verbatim: true })).map((row) => row.address);

const root = new URL('./', import.meta.url);
const port = Number(process.env.PORT || 4173);
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
  ['/guides.json', ['guides.json', 'application/json; charset=utf-8']],
  ['/icons.js', ['icons.js', 'text/javascript; charset=utf-8']],
  ...Object.entries(FONTS).map(([file, source]) => [`/fonts/${file}`, [source, 'font/woff2']]),
]);
const limits = new Map();

function respond(res, status, data, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' });
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { respond(res, 400, { error: 'Invalid request URL.' }); return; }
  if (url.pathname === '/api/health') { respond(res, 200, { ok: true, research: 'public-documentation', ai: false }); return; }
  if (url.pathname === '/api/research') {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); respond(res, 405, { error: 'Use POST to start research.' }); return; }
    if (!String(req.headers['content-type']).startsWith('application/json')) { respond(res, 415, { error: 'Send JSON input.' }); return; }
    const origin = req.headers.origin;
    if (origin && origin !== `http://${req.headers.host}`) { respond(res, 403, { error: 'Research requests must come from this app.' }); return; }
    const key = req.socket.remoteAddress;
    const current = limits.get(key) || { start: Date.now(), count: 0 };
    if (Date.now() - current.start > 60000) { current.start = Date.now(); current.count = 0; }
    current.count += 1;
    limits.set(key, current);
    if (current.count > 8) { respond(res, 429, { error: 'Research limit reached. Please wait a minute and try again.' }); return; }
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 4096) throw new ResearchError('Request is too large.', 413);
      }
      let input;
      try { input = JSON.parse(body); } catch { throw new ResearchError('Enter a valid app name or website.', 400); }
      respond(res, 200, await research(input, {}, { resolveHost }));
    } catch (error) { respond(res, error.status || 502, { error: error instanceof ResearchError ? error.message : 'Research could not finish. Please try again.' }); }
    return;
  }
  if (!['GET', 'HEAD'].includes(req.method)) { respond(res, 405, { error: 'Method not allowed.' }); return; }
  const entry = files.get(url.pathname);
  if (!entry) { respond(res, 404, 'Page not found. Return to / to open the guide library.', 'text/plain; charset=utf-8'); return; }
  try {
    const contents = await readFile(new URL(entry[0], root));
    res.writeHead(200, { 'content-type': entry[1], 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'cache-control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : contents);
  } catch { respond(res, 404, 'File not found.', 'text/plain; charset=utf-8'); }
});

server.listen(port, '127.0.0.1', () => console.log(`OAuth Path is running at http://localhost:${port}`));
