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
  assert.deepEqual(health, { ok: true, research: 'public-documentation', ai: false, browser: false });
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

test('prototype-key names are not treated as directory entries', async () => {
  const options = fixture({ 'https://app.example.com/': home, 'https://app.example.com/docs/oauth': docs });
  for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    const result = await research({ name, url: 'https://app.example.com' }, {}, options);
    assert.equal(result.sources.length, 2, name);
    assert.ok(!result.activity.some((row) => /directory entry/.test(row.label)), name);
  }
});

test('IPv6 loopback, mapped, compatible, and translated forms are not public', () => {
  for (const address of ['0:0:0:0:0:0:0:1', '0::1', '::7f00:1', '::ffff:127.0.0.1', '::ffff:7f00:1', '64:ff9b::7f00:1', '2002:7f00:1::', '2001:0::1', 'fd12:3456::1', 'febf::1', 'ff02::1', 'not:an:ip::zz']) assert.equal(isPublicAddress(address), false, address);
  for (const address of ['2606:4700::1111', '2a00:1450:4001:80b::200e']) assert.equal(isPublicAddress(address), true, address);
});

test('HTML parsing stays linear on unclosed anchors, scripts, and comments', () => {
  const started = Date.now();
  extractLinks('<a href="/x">'.repeat(60000), 'https://app.example.com');
  cleanText('<script>'.repeat(30000) + '<!--'.repeat(30000) + '<b'.repeat(30000));
  assert.ok(Date.now() - started < 1500, `took ${Date.now() - started}ms`);
});

const reviewDocs = docs + '<p>Before public launch, submit your app for app review. The review team responds within 5 business days.</p>';
test('AI summary, difficulty, and approval wait cannot carry unsupported review claims', async () => {
  const steps = [1, 2, 3].map((n) => ({ title: `Step ${n}`, description: 'Configure the app.', owner: 'You', sourceIds: ['S2'] }));
  const run = (value, page = docs) => research({ url: 'https://app.example.com' }, { AI: { run: async () => ({ response: { steps, ...value } }) } }, fixture({ 'https://app.example.com/': home, 'https://app.example.com/docs/oauth': page }));
  const invented = await run({ summary: 'Create an OAuth app in the console. The provider requires a verification review that takes 4 to 6 weeks.', difficulty: 'Requires security assessment by provider (weeks)', approvalWait: '4 to 6 weeks' });
  assert.equal(invented.summary, 'Create an OAuth app in the console.');
  assert.equal(invented.difficulty, 'Needs scope and distribution review');
  assert.match(invented.approvalWait, /No provider review requirement/);
  const cited = await run({ summary: 'Register an app, then submit it for app review.', difficulty: 'medium', approvalWait: 'Up to 5 business days (S2)' }, reviewDocs);
  assert.match(cited.summary, /submit it for app review/);
  assert.equal(cited.difficulty, 'Medium · AI judgment from retrieved docs');
  assert.equal(cited.approvalWait, 'Up to 5 business days (S2)');
  const wrongNumber = await run({ approvalWait: 'Up to 3 weeks (S2)' }, reviewDocs);
  assert.match(wrongNumber.approvalWait, /mentioned in S2, but no waiting time was established/);
});

test('marketing and sign-in pages are not used as OAuth evidence', async () => {
  const marketingHome = '<h1>Files for teams</h1><p>Connect your favorite tools through our integrations.</p><a href="/app-integrations/ai-assistant">AI assistant integration with OAuth consent</a><a href="/login">Log in to the developer console</a><a href="/docs/oauth">OAuth guide</a>';
  const marketing = '<h1>AI assistant</h1><p>Approve OAuth consent to connect the AI assistant plugin to your files in one click.</p>';
  const login = '<h1>Log in</h1><p>Sign in to continue to the OAuth developer console and manage your client ID.</p>';
  const calls = [];
  const AI = { run: async (_m, payload) => { calls.push(JSON.parse(payload.messages[1].content).sources.map((s) => s.url)); return { response: { steps: [1, 2, 3].map((n) => ({ title: `Step ${n}`, description: 'Configure.', owner: 'You', sourceIds: ['S2'] })) } }; } };
  const result = await research({ url: 'https://files.example.com' }, { AI }, fixture({ 'https://files.example.com/': marketingHome, 'https://files.example.com/app-integrations/ai-assistant': marketing, 'https://files.example.com/login': login, 'https://files.example.com/docs/oauth': docs }));
  assert.ok(!result.sources.some((s) => /app-integrations|login/.test(s.url)));
  assert.deepEqual(calls[0], ['https://files.example.com/docs/oauth']);
});

test('official docs reached through a cross-domain redirect are kept', async () => {
  const options = fixture({
    'https://filesapp.com/': '<h1>Files</h1><p>Cloud storage for teams that want secure sharing and simple administration.</p><a href="https://developers.filesapp.com/oauth-guide">Developers</a>',
    'https://developers.filesapp.com/oauth-guide': () => new Response('', { status: 301, headers: { location: 'https://docs.filesappapi.net/api/oauth' } }),
    'https://docs.filesappapi.net/api/oauth': docs,
  });
  const result = await research({ url: 'https://filesapp.com' }, {}, options);
  assert.ok(result.sources.some((s) => s.url === 'https://docs.filesappapi.net/api/oauth'));
  assert.equal(result.oauthSupport, 'documented');
});

test('a name resolves through Wikidata and an llms.txt index leads to the OAuth page', async () => {
  const wikidata = (url) => {
    if (url.includes('wbsearchentities')) return Response.json({ search: [{ id: 'Q1' }, { id: 'Q2' }] });
    return Response.json({ entities: {
      Q1: { labels: { en: { value: 'Planly' } }, descriptions: { en: { value: 'village in England' } }, claims: { P856: [{ rank: 'normal', mainsnak: { datavalue: { value: 'https://planly-village.example.org' } } }] } },
      Q2: { labels: { en: { value: 'Planly Inc.' } }, descriptions: { en: { value: 'scheduling software company' } }, claims: { P856: [{ rank: 'normal', mainsnak: { datavalue: { value: 'https://planlyapp.com/' } } }] } },
    } });
  };
  const options = fixture({
    'https://planlyapp.com/': '<h1>Planly</h1><p>Scheduling for busy teams and their customers everywhere, with booking pages and reminders.</p>',
    'https://developer.planlyapp.com/llms.txt': () => new Response('# Planly developer docs\n- [Creating an OAuth app](https://developer.planlyapp.com/docs/oauth-app.md): How to authenticate with OAuth\n- [Pricing](https://planlyapp.com/pricing): plans', { headers: { 'content-type': 'text/plain' } }),
    'https://developer.planlyapp.com/docs/oauth-app.md': () => new Response('# Creating an OAuth app\nRegister a client ID and redirect URI, then exchange the authorization code for an access token. Request only the scopes you need.', { headers: { 'content-type': 'text/markdown' } }),
  });
  const base = options.fetcher;
  options.fetcher = async (url, init) => url.startsWith('https://www.wikidata.org/') ? wikidata(url) : base(url, init);
  const result = await research({ name: 'Planly' }, {}, options);
  assert.equal(result.domain, 'planlyapp.com');
  assert.ok(result.activity.some((row) => /Wikidata/.test(row.label)));
  assert.ok(result.sources.some((s) => s.url.endsWith('/docs/oauth-app.md')));
  assert.ok(!result.sources.some((s) => /llms\.txt|pricing/.test(s.url)));
  assert.equal(result.oauthSupport, 'documented');
});

test('very short names never resolve to an arbitrary search hit', async () => {
  const options = fixture({});
  const base = options.fetcher;
  options.fetcher = async (url, init) => url.startsWith('https://html.duckduckgo.com/') ? html('<a class="result__a" href="https://www.unrelated-site.com/oauth-guide">OAuth guide</a>') : base(url, init);
  for (const name of ['C++', '+++']) await assert.rejects(research({ name }, {}, options), (error) => error.status === 422, name);
});

test('Wikidata matches need a company or product description', async () => {
  const options = fixture({ 'https://garysmithfans.com/': '<h1>Fans</h1><p>A long enough page about a football player and his career highlights.</p>' });
  const base = options.fetcher;
  options.fetcher = async (url, init) => {
    if (url.includes('wbsearchentities')) return Response.json({ search: [{ id: 'Q9' }] });
    if (url.includes('wbgetentities')) return Response.json({ entities: { Q9: { labels: { en: { value: 'Gary Smith' } }, descriptions: { en: { value: 'American footballer' } }, claims: { P856: [{ rank: 'normal', mainsnak: { datavalue: { value: 'https://garysmithfans.com/' } } }] } } } });
    return base(url, init);
  };
  await assert.rejects(research({ name: 'Gary Smith' }, {}, options), (error) => error.status === 422);
});

test('both ends of a duration range, and durations in steps, must appear in cited pages', async () => {
  const page = docs + '<p>Submit your app for app review. Review usually takes 2 days.</p>';
  const run = (value) => research({ url: 'https://app.example.com' }, { AI: { run: async () => ({ response: value }) } }, fixture({ 'https://app.example.com/': home, 'https://app.example.com/docs/oauth': page }));
  const base = [1, 2, 3].map((n) => ({ title: `Step ${n}`, description: 'Configure the app.', owner: 'You', sourceIds: ['S2'] }));
  const range = await run({ steps: base, approvalWait: 'Review takes 2-14 days (S2)' });
  assert.match(range.approvalWait, /no waiting time was established/);
  const exact = await run({ steps: base, approvalWait: 'Review usually takes 2 days (S2)' });
  assert.equal(exact.approvalWait, 'Review usually takes 2 days (S2)');
  const timed = await run({ steps: [...base, { title: 'Wait for access', description: 'Register the redirect URI. Access is granted within 3 weeks.', owner: 'You', sourceIds: ['S2'] }], requirements: [{ text: 'Tokens are approved within 9 days.', sourceIds: ['S2'] }] });
  assert.equal(timed.steps[3].description, 'Register the redirect URI.');
  assert.equal(timed.requirements.length, 0);
});

test('reserved IPv6 ranges and pathological markup are handled', () => {
  for (const address of ['fec0::1', '2001:10::1', '2001:20::1', '3fff::1']) assert.equal(isPublicAddress(address), false, address);
  const started = Date.now();
  cleanText('<'.repeat(700000));
  extractLinks(`<a class="${'x'.repeat(1990)}">`.repeat(350), 'https://app.example.com');
  assert.ok(Date.now() - started < 1500, `took ${Date.now() - started}ms`);
  assert.equal(cleanText('<p>a < b and <b>c</b></p>'), 'a c');
  assert.equal(extractLinks('<a class=nav href=/docs/oauth>OAuth</a>', 'https://app.example.com')[0].url, 'https://app.example.com/docs/oauth');
});

test('Worker rejects oversized bodies before reading them', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') } };
  const response = await worker.fetch(new Request('https://app.test/api/research', { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '999999' }, body: '{}' }), env);
  assert.equal(response.status, 413);
});

test('JavaScript-only docs are rendered in a headless browser, capped, and never for private targets', async () => {
  const shell = () => new Response('<html><head><title>Docs</title></head><body><div id="root"></div><script>app()</script></body></html>', { headers: { 'content-type': 'text/html' } });
  const options = fixture({ 'https://jsdocs.example.com/': home.replace('/docs/oauth', '/docs/oauth-app'), 'https://jsdocs.example.com/docs/oauth-app': shell });
  const rendered = [];
  options.renderPage = async (url) => {
    rendered.push(url);
    return { url, title: 'Create an OAuth app', text: `Create an OAuth app in the developer console. Register a redirect URI and copy the client ID. Exchange the authorization code for an access token and a refresh token. Request only the scopes you need. ${'Details. '.repeat(20)}`, links: [{ url: 'http://127.0.0.1/admin', title: 'internal' }, { url: '/docs/scopes', title: 'OAuth scopes' }] };
  };
  const result = await research({ url: 'https://jsdocs.example.com' }, {}, options);
  assert.deepEqual(rendered, ['https://jsdocs.example.com/docs/oauth-app']);
  const source = result.sources.find((s) => s.url.endsWith('/docs/oauth-app'));
  assert.match(source.kind, /rendered in a headless browser/);
  assert.equal(result.oauthSupport, 'documented');
  assert.ok(result.activity.some((row) => /Rendered 1 JavaScript-only page/.test(row.label)));
  assert.ok(!options.calls.some((url) => url.includes('127.0.0.1')));

  const escaped = fixture({ 'https://jsdocs.example.com/': home.replace('/docs/oauth', '/docs/oauth-app'), 'https://jsdocs.example.com/docs/oauth-app': shell });
  escaped.renderPage = async () => ({ url: 'http://169.254.169.254/latest', title: 'meta', text: 'x'.repeat(500), links: [] });
  const blocked = await research({ url: 'https://jsdocs.example.com' }, {}, escaped);
  assert.ok(!blocked.sources.some((s) => s.url.includes('169.254')), 'a render that lands on a private address is discarded');
});
