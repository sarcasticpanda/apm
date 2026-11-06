import { research, ResearchError } from './research.mjs';
import { FONTS } from './fonts.mjs';

// Explicit allow-list: only built browser assets are served, never source or configuration.
const PUBLIC_PATHS = new Set(['/', '/index.html', '/styles.css', '/app.js', '/icons.js', '/favicon.svg', '/guides.json', ...Object.keys(FONTS).map((file) => `/fonts/${file}`)]);

const limits = new Map();
const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return json({ ok: true, research: 'public-documentation', ai: Boolean(env.AI) });
    if (url.pathname === '/api/research') {
      if (request.method !== 'POST') return json({ error: 'Use POST to start research.' }, 405);
      if (!String(request.headers.get('content-type')).startsWith('application/json')) return json({ error: 'Send JSON input.' }, 415);
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) return json({ error: 'Research requests must come from this app.' }, 403);
      const key = request.headers.get('cf-connecting-ip') || 'unknown';
      const now = Date.now();
      if (limits.size > 2000) for (const [ip, row] of limits) if (now - row.start > 60000) limits.delete(ip);
      const current = limits.get(key) || { start: now, count: 0 };
      if (now - current.start > 60000) { current.start = now; current.count = 0; }
      current.count += 1;
      limits.set(key, current);
      if (current.count > 6) return json({ error: 'Research limit reached. Please wait a minute and try again.' }, 429);
      if (Number(request.headers.get('content-length')) > 4096) return json({ error: 'Request is too large.' }, 413);
      try {
        const body = await request.text();
        if (body.length > 4096) return json({ error: 'Request is too large.' }, 413);
        let input;
        try { input = JSON.parse(body); } catch { return json({ error: 'Enter a valid app name or website.' }, 400); }
        return json(await research(input, env));
      } catch (error) {
        return json({ error: error instanceof ResearchError ? error.message : 'Research could not finish. Please try again.' }, error.status || 502);
      }
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'API route not found.' }, 404);
    if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
    if (!PUBLIC_PATHS.has(url.pathname)) {
      return new Response('Page not found. Return to / to open the guide library.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    const response = await env.ASSETS.fetch(request);
    const safe = new Response(response.body, response);
    safe.headers.set('X-Content-Type-Options', 'nosniff');
    safe.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return safe;
  },
};
