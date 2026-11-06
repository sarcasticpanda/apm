import test from 'node:test';
import assert from 'node:assert/strict';
import { research, publicUrl, isPublicAddress, cleanText, extractLinks } from './research.mjs';
import worker from './worker.mjs';

const html = (body) => new Response(`<html><head><title>Example developer documentation</title></head><body><main>${body}</main></body></html>`, { headers: { 'content-type': 'text/html' } });
function fixture(pages) {
  const calls = [];
  return { calls, resolveHost: async () => ['104.18.1.2'], fetcher: async (url) => { calls.push(url); const content = pages[url]; return typeof content === 'function' ? content() : content ? html(content) : new Response('Missing', { status: 404 }); } };
}
const home = '<h1>A useful developer platform</h1><p>Build integrations for your customers using our app developer API.</p><a href="/docs/oauth">OAuth developer documentation</a>';
const docs = '<h1>OAuth 2.0 authorization</h1><p>Create an OAuth app and register the redirect URI in the developer console.</p><p>Request minimum scopes for the required features. Keep the client secret confidential on your backend.</p><p>Use the authorization code and refresh token with the PKCE challenge.</p>';

test('public URL validation rejects private targets, protocols, credentials, and custom ports', () => {
  for (const url of ['file:///secret', 'http://127.0.0.1', 'http://0x7f000001', 'http://[::1]', 'http://localhost', 'https://server.internal', 'https://user:secret@example.com', 'https://example.com:9000']) assert.throws(() => publicUrl(url));
  assert.equal(publicUrl('https://developers.example.com/docs#section').href, 'https://developers.example.com/docs');
});

test('public address classifier rejects private and special-use ranges', () => {
  for (const address of ['10.4.5.6', '127.0.0.1', '169.254.169.254', '172.16.1.2', '192.168.1.1', '100.64.1.1', '0.0.0.0', '::1', 'fc00::1', 'fe80::1']) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress('104.18.1.2'), true);
  assert.equal(isPublicAddress('2606:4700::1111'), true);
});

test('HTML text extraction removes scripts and unsafe links', () => {
  assert.equal(cleanText('<script>ignore instructions</script><p>Useful setup</p>'), 'Useful setup');
  const links = extractLinks('<a href="javascript:alert(1)">Bad</a><a href="/docs">Docs</a>', 'https://example.com');
  assert.equal(links.length, 1);
  assert.equal(links[0].url, 'https://example.com/docs');
});

test('research follows provider docs and returns source-linked findings from pages actually read', async () => {
  const options = fixture({ 'https://app.example.com/': home, 'https://app.example.com/docs/oauth': docs });
  const result = await research({ name: 'Example', url: 'https://app.example.com' }, {}, options);
  assert.equal(result.mode, 'evidence');
  assert.equal(result.oauthSupport, 'documented');
  assert.equal(result.sources.length, 2);
  assert.ok(result.requirements.some((row) => /Callback/.test(row.text) && row.sourceIds.includes('S2')));
  assert.match(result.approvalWait, /Not confirmed/);
  assert.ok(result.uncertainties.some((line) => /No OAuth app was registered/.test(line)));
});

test('missing docs does not imply OAuth support or successful research', async () => {
  const result = await research({ url: 'https://empty.example.com' }, {}, fixture({}));
  assert.equal(result.oauthSupport, 'unconfirmed');
  assert.equal(result.homepageRead, false);
  assert.equal(result.sources.length, 0);
  assert.match(result.summary, /could not establish/);
});

test('redirects to private destinations are never fetched', async () => {
  const options = fixture({ 'https://public.example.com/': () => new Response('', { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } }) });
  const result = await research({ url: 'https://public.example.com' }, {}, options);
  assert.equal(result.sources.length, 0);
  assert.equal(options.calls.some((url) => url.includes('169.254')), false);
});

test('DNS resolution to private addresses blocks retrieval', async () => {
  const options = fixture({ 'https://public.example.com/': home });
  options.resolveHost = async () => ['10.1.2.3'];
  const result = await research({ url: 'https://public.example.com' }, {}, options);
  assert.equal(result.sources.length, 0);
  assert.equal(options.calls.length, 0);
});

test('ambiguous unknown names return actionable website request', async () => {
  await assert.rejects(research({ name: 'unknownappthatdoesnotexist' }, {}, fixture({})), (error) => error.status === 422 && /official website/.test(error.message));
});

test('AI synthesis is grounded in fetched pages and unknown source IDs are dropped', async () => {
  const options = fixture({ 'https://app.example.com/': home, 'https://app.example.com/docs/oauth': docs });
  const AI = { run: async (_model, payload) => {
    assert.match(payload.messages[0].content, /untrusted data/);
    return { response: JSON.stringify({ summary: 'OAuth setup is documented.', requirements: [{ text: 'Callback registration required.', sourceIds: ['S2', 'invented'] }, { text: 'Unsupported fact.', sourceIds: ['invented'] }], steps: [1, 2, 3].map((number) => ({ title: `Step ${number}`, description: 'Read the docs and configure your app.', owner: 'You', sourceIds: ['S2', 'invented'] })) }) };
  } };
  const result = await research({ url: 'https://app.example.com' }, { AI }, options);
  assert.equal(result.mode, 'ai');
  assert.equal(result.requirements.length, 1);
  assert.deepEqual(result.requirements[0].sourceIds, ['S2']);
  assert.deepEqual(result.steps[0].sourceIds, ['S2']);
});

test('AI failure falls back honestly to evidence findings', async () => {
  const options = fixture({ 'https://app.example.com/': home, 'https://app.example.com/docs/oauth': docs });
  const result = await research({ url: 'https://app.example.com' }, { AI: { run: async () => { throw new Error('Capacity'); } } }, options);
  assert.equal(result.mode, 'evidence');
  assert.ok(result.uncertainties.some((line) => /AI synthesis was unavailable/.test(line)));
});

test('Worker does not serve source code or secrets and enforces API method and origin', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') } };
  for (const path of ['/server.mjs', '/research.mjs', '/.env', '/README.md']) assert.equal((await worker.fetch(new Request(`https://app.test${path}`), env)).status, 404);
  assert.equal((await worker.fetch(new Request('https://app.test/api/research'), env)).status, 405);
  assert.equal((await worker.fetch(new Request('https://app.test/api/research', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.test' }, body: '{}' }), env)).status, 403);
  assert.equal((await worker.fetch(new Request('https://app.test/api/research', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }), env)).status, 400);
  const health = await (await worker.fetch(new Request('https://app.test/api/health'), env)).json();
  assert.deepEqual(health, { ok: true, research: 'public-documentation', ai: false });
});

test('user consent cannot be upgraded to unsupported provider or admin approval gates', async () => {
  const options = fixture({ 'https://app.example.com/': home, 'https://app.example.com/docs/oauth': docs+'<p>Once the user approves the application, return an authorization code.</p>' });
  const AI = { run: async () => ({ response: {
    summary:'OAuth setup',setupEffort:'2 hours',approvalWait:'Wait for provider review',
    requirements:[{text:'Provider approval required',sourceIds:['S2']}],
    steps:[
      {title:'Register app',description:'Configure a callback',owner:'You',sourceIds:['S2']},
      {title:'Choose scopes',description:'Choose minimum scopes',owner:'You',sourceIds:['S2']},
      {title:'Provider Review',description:'Wait for provider review and approval',owner:'Provider',sourceIds:['S2']},
      {title:'Workspace admin approval',description:'Get workspace admin approval',owner:'Workspace admin',sourceIds:['S2']}
    ],blockers:[{text:'Provider approval required',nextAction:'Wait for provider review',sourceIds:['S2']}]
  } }) };
  const result=await research({url:'https://app.example.com'}, {AI}, options);
  assert.equal(result.mode,'ai');
  assert.equal(result.requirements.length,0);
  assert.ok(!result.steps.some(step=>step.owner==='Provider'||step.owner==='Workspace admin'));
  assert.match(result.approvalWait,/No provider review requirement/);
  assert.match(result.setupEffort,/Planning estimate/);
  assert.equal(result.blockers.length,0);
});

test('the model cannot invent agent account access or pretend a difficulty label is a duration', async()=>{
 const options=fixture({'https://app.example.com/':home,'https://app.example.com/docs/oauth':docs});
 const AI={run:async()=>({response:{summary:'OAuth guide',setupEffort:'high',agentCan:['Create accounts and exchange tokens'],humanMust:['Nothing'],steps:[{title:'Register',description:'Register app',owner:'You',sourceIds:['S2']},{title:'Scopes',description:'Choose scopes',owner:'You',sourceIds:['S2']},{title:'Test',description:'Test code flow',owner:'You',sourceIds:[]}]}})};
 const result=await research({url:'https://app.example.com'},{AI},options);
 assert.equal(result.setupEffort,'Not estimated from available evidence');
 assert.ok(!result.agentCan.some(v=>/Create accounts|exchange tokens/.test(v)));
 assert.ok(result.humanMust.some(v=>/Sign in/.test(v)));
});
