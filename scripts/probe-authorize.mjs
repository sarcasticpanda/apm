// Agent setup attempt without an account: call each provider's real authorization endpoints with an
// unregistered client ID and record how far the flow gets and how the provider refuses it.
// Run: node scripts/probe-authorize.mjs   (writes artifacts/endpoint-probe.json)
import { mkdir, writeFile } from 'node:fs/promises';

const CALLBACK = 'https://oauth-path.kadakchai-panda.workers.dev/callback';
const UA = 'OAuthPath/2.1 setup probe (https://github.com/sarcasticpanda/apm)';
const probes = [
  { provider: 'GitHub', step: 'Browser authorization request', method: 'GET', url: `https://github.com/login/oauth/authorize?client_id=oauthpath-unregistered-probe&redirect_uri=${encodeURIComponent(CALLBACK)}&scope=read:user&state=probe` },
  { provider: 'GitHub', step: 'Device flow code request', method: 'POST', url: 'https://github.com/login/device/code', body: 'client_id=oauthpath-unregistered-probe&scope=read:user', type: 'application/x-www-form-urlencoded' },
  { provider: 'GitHub', step: 'Token exchange', method: 'POST', url: 'https://github.com/login/oauth/access_token', body: 'client_id=oauthpath-unregistered-probe&client_secret=not-a-secret&code=probe', type: 'application/x-www-form-urlencoded' },
  { provider: 'Slack', step: 'Browser authorization request', method: 'GET', url: `https://slack.com/oauth/v2/authorize?client_id=0000000000.0000000000&scope=chat:write&redirect_uri=${encodeURIComponent(CALLBACK)}&state=probe` },
  { provider: 'Slack', step: 'Token exchange', method: 'POST', url: 'https://slack.com/api/oauth.v2.access', body: 'client_id=0000000000.0000000000&client_secret=not-a-secret&code=probe', type: 'application/x-www-form-urlencoded' },
  { provider: 'Google', step: 'Browser authorization request', method: 'GET', url: `https://accounts.google.com/o/oauth2/v2/auth?client_id=oauthpath-unregistered-probe.apps.googleusercontent.com&redirect_uri=${encodeURIComponent(CALLBACK)}&response_type=code&scope=openid%20email&state=probe` },
  { provider: 'Google', step: 'Token exchange', method: 'POST', url: 'https://oauth2.googleapis.com/token', body: `client_id=oauthpath-unregistered-probe.apps.googleusercontent.com&client_secret=not-a-secret&code=probe&grant_type=authorization_code&redirect_uri=${encodeURIComponent(CALLBACK)}`, type: 'application/x-www-form-urlencoded' },
];

const visible = (html) => html.replace(/<script[^]*?<\/script>|<style[^]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const results = [];
for (const probe of probes) {
  const started = Date.now();
  try {
    const response = await fetch(probe.url, { method: probe.method, redirect: 'follow', headers: { 'user-agent': UA, accept: probe.method === 'POST' ? 'application/json' : 'text/html', ...(probe.type ? { 'content-type': probe.type } : {}) }, body: probe.body, signal: AbortSignal.timeout(15000) });
    const body = await response.text();
    const type = response.headers.get('content-type') || '';
    const finalUrl = new URL(response.url);
    let observed;
    if (/json/.test(type)) { try { const json = JSON.parse(body); observed = JSON.stringify({ error: json.error, error_description: json.error_description, ok: json.ok }); } catch { observed = body.slice(0, 200); } }
    else {
      const text = visible(body);
      const title = body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '';
      const error = text.match(/[^.]{0,120}(?:invalid[_ ]client|client[^.]{0,40}not found|was not found|doesn.t exist|does not exist|invalid_client_id|Error \d{3}|not found|unknown client)[^.]{0,120}/i)?.[0]?.trim() || text.slice(0, 160);
      observed = `title "${title}"; text: ${error}`;
    }
    results.push({ provider: probe.provider, step: probe.step, status: response.status, finalHost: finalUrl.host, finalPath: finalUrl.pathname, observed, ms: Date.now() - started });
  } catch (error) {
    results.push({ provider: probe.provider, step: probe.step, status: 'request failed', observed: error.message, ms: Date.now() - started });
  }
  await new Promise((resolve) => setTimeout(resolve, 800));
}
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/endpoint-probe.json', JSON.stringify({ ranAt: new Date().toISOString(), callback: CALLBACK, results }, null, 2));
for (const row of results) console.log(`${row.provider.padEnd(7)} | ${row.step.padEnd(30)} | ${String(row.status).padEnd(4)} | ${row.finalHost}${row.finalPath || ''}\n          ${row.observed}`);
