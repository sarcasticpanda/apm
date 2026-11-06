# GitHub setup attempt

The assignment asks agents to attempt as much of the setup as practical. This page records how far an agent got, where a person had to take over, and what a real registration showed.

## 1. What the agent attempted without an account (5 November 2026)

`node scripts/probe-authorize.mjs` calls each provider's real OAuth endpoints with an app ID that was never registered:

| Provider | Request | What came back | What it teaches |
| --- | --- | --- | --- |
| GitHub | Browser authorization URL | Redirect to **Sign in to GitHub** | GitHub does not reveal whether an app exists until a person signs in. An agent cannot test this step for a user. |
| GitHub | Device flow code request | `404 {"error":"Not Found"}` | Device flow only works for a registered app with device flow enabled. |
| GitHub | Token exchange | `404 {"error":"Not Found"}` | Unknown apps are refused before any code is checked. |
| Slack | Browser authorization URL | Page built by JavaScript; no readable text | A crawler cannot inspect Slack's consent screen. A person has to look at it. |
| Slack | Token exchange | `{"ok":false,"error":"invalid_code"}` | Slack checks the authorization code first, so this error alone does not prove the app ID is right. |
| Google | Browser authorization URL | **"Access blocked: Authorization Error. The OAuth client was not found"** | This is the exact screen users see if the client ID is wrong or deleted. |
| Google | Token exchange | `401 invalid_client: The OAuth client was not found.` | Same check on the server side. |

**Where the agent stopped:** every provider requires a person to sign in and register the app before any user can connect. That matches the guides, which mark registration as the developer's job.

## 2. Registering a real GitHub OAuth App (for a person, about 5 minutes)

1. Open https://github.com/settings/applications/new (Settings, Developer settings, OAuth Apps, **New OAuth App**).
2. Fill in:
   - **Application name:** `OAuth Path test`
   - **Homepage URL:** `https://oauth-path.kadakchai-panda.workers.dev`
   - **Authorization callback URL:** `http://127.0.0.1:4173/callback` (required by the form; the device flow does not use it)
   - Tick **Enable Device Flow**.
3. Before you click **Register application**, note what the form shows:
   - Is there an option about **expiring user access tokens**? Is it on by default?
   - Does it say how many callback URLs are allowed?
4. After registering, copy the **Client ID**. It is public. Do not generate or share a client secret unless you want to test token refresh.
5. In this project folder (PowerShell):
   ```powershell
   $env:GITHUB_CLIENT_ID="paste-the-client-id"
   node scripts/github-device-flow.mjs
   ```
6. The script prints a short code. Open the link it shows, enter the code, read the consent screen, and click **Authorize**. For a second run, click **Cancel** to test denial.
7. When it finishes, revoke the app at https://github.com/settings/applications, then delete it under Developer settings if you like.

The script records:
- whether GitHub issued a token;
- whether the token expires and whether a refresh token came with it;
- which scopes were granted;
- whether an API call with the token worked.

It never prints or saves the token itself. The redacted report is saved to `artifacts/github-setup-attempt.json`.

## 3. Results of the real registration

Not run yet. Once the steps above are done, record here:
- what the form showed;
- the token behaviour;
- anything that differed from the GitHub guide.
