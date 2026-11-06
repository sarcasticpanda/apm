// Real setup attempt for the GitHub guide, run by a person with their own GitHub OAuth App.
// Steps and what to record: docs/github-setup-attempt.md
//
//   PowerShell:  $env:GITHUB_CLIENT_ID="<your client id>"; node scripts/github-device-flow.mjs
//   Bash:        GITHUB_CLIENT_ID=<your client id> node scripts/github-device-flow.mjs
//
// Uses GitHub's device flow, so it needs only the public Client ID: no callback server, no client secret.
// The access token is never printed or saved. A redacted report goes to artifacts/github-setup-attempt.json.
import { mkdir, writeFile } from 'node:fs/promises';

const clientId = (process.env.GITHUB_CLIENT_ID || '').trim();
if (!/^[A-Za-z0-9._-]{8,64}$/.test(clientId)) {
  console.error('Set GITHUB_CLIENT_ID to the Client ID shown on your OAuth App page (it is public, not a secret).');
  process.exit(1); // safe here: no network handles are open yet
}
const report = { startedAt: new Date().toISOString(), clientIdPrefix: `${clientId.slice(0, 6)}...`, steps: [] };
const log = (step, detail) => { report.steps.push({ step, ...detail }); console.log(`\n[${step}] ${Object.entries(detail).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' | ')}`); };
const form = (data) => new URLSearchParams(data).toString();
const post = async (url, data) => {
  const response = await fetch(url, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'OAuthPath setup attempt' }, body: form(data) });
  return { status: response.status, json: await response.json().catch(() => ({})) };
};
const save = async () => {
  report.finishedAt = new Date().toISOString();
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/github-setup-attempt.json', JSON.stringify(report, null, 2));
  console.log('\nSaved a redacted report to artifacts/github-setup-attempt.json (no token inside).');
};

// Returns an exit code instead of calling process.exit(), which can crash Node on Windows while fetch sockets close.
async function main() {
  // 1. Ask GitHub for a device code.
  const device = await post('https://github.com/login/device/code', { client_id: clientId, scope: 'read:user' });
  if (device.status !== 200 || !device.json.device_code) {
    log('device code request', { status: device.status, error: device.json.error || 'unknown', meaning: device.status === 404 ? 'GitHub did not recognise this app for device flow. Check the Client ID and tick "Enable Device Flow" on the app page.' : 'See the error above.' });
    await save();
    return 1;
  }
  log('device code request', { status: 200, expiresInSeconds: device.json.expires_in, pollIntervalSeconds: device.json.interval });
  console.log(`\n>>> Open ${device.json.verification_uri} in your browser and enter this code: ${device.json.user_code}`);
  console.log('>>> Read the consent screen (app name, requested access), then choose Authorize. Choose Cancel instead if you want to test denial.');

  // 2. Poll until the person approves, denies, or the code expires.
  let interval = Number(device.json.interval || 5);
  let token;
  for (const deadline = Date.now() + Number(device.json.expires_in || 900) * 1000; Date.now() < deadline;) {
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    const result = await post('https://github.com/login/oauth/access_token', { client_id: clientId, device_code: device.json.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' });
    const error = result.json.error;
    if (error === 'authorization_pending') { process.stdout.write('.'); continue; }
    if (error === 'slow_down') { interval += 5; continue; }
    if (error) { log('token request', { status: result.status, error, meaning: error === 'access_denied' ? 'The person chose Cancel: user consent was refused, as expected for a denial test.' : result.json.error_description || '' }); await save(); return error === 'access_denied' ? 0 : 1; }
    token = result.json;
    break;
  }
  if (!token?.access_token) { log('token request', { error: 'expired', meaning: 'The device code expired before approval. Run the script again.' }); await save(); return 1; }

  // 3. Record what kind of token GitHub issued, without the token itself.
  log('token issued', {
    tokenType: token.token_type, grantedScopes: token.scope || '(none)',
    expires: Boolean(token.expires_in), expiresInSeconds: token.expires_in ?? null,
    refreshTokenIssued: Boolean(token.refresh_token), refreshTokenExpiresInSeconds: token.refresh_token_expires_in ?? null,
    meaning: token.expires_in ? 'User tokens expire: build refresh handling (matches the guide).' : 'This token has no expiry. Check whether "Expire user access tokens" was enabled on the app.',
  });

  // 4. Use the token once, the way an integration would.
  const me = await fetch('https://api.github.com/user', { headers: { authorization: `Bearer ${token.access_token}`, accept: 'application/vnd.github+json', 'user-agent': 'OAuthPath setup attempt' } });
  const profile = await me.json().catch(() => ({}));
  log('API call with the token', { endpoint: 'GET /user', status: me.status, scopesHeader: me.headers.get('x-oauth-scopes') ?? '(not sent)', accountType: profile.type || null });

  // 5. Optional: test a refresh, which needs the client secret. Set GITHUB_CLIENT_SECRET only for this run.
  if (token.refresh_token && process.env.GITHUB_CLIENT_SECRET) {
    const refreshed = await post('https://github.com/login/oauth/access_token', { client_id: clientId, client_secret: process.env.GITHUB_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: token.refresh_token });
    log('refresh', { status: refreshed.status, newTokenIssued: Boolean(refreshed.json.access_token), error: refreshed.json.error || null });
  } else if (token.refresh_token) {
    log('refresh', { skipped: 'Set GITHUB_CLIENT_SECRET for this run to test refreshing. It is never saved.' });
  }
  console.log('\nDone. To finish the test, revoke the app at https://github.com/settings/applications (Authorized OAuth Apps), then you can delete it under Developer settings.');
  await save();
  return 0;
}
process.exitCode = await main();
