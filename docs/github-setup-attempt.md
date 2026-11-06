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

## 3. Results of the real registration (7 November 2026)

A person (the project owner) registered a real OAuth App called **OAuth Path test** and authorized it with the device flow. The agent drove the browser with Playwright where GitHub allowed it. The redacted report is `artifacts/github-setup-attempt.json`; it contains no token.

**Registration form, observed**

| Guide claim | What the form showed | Verdict |
| --- | --- | --- |
| Up to 10 callback URLs | "You may add up to 10 redirect URIs" | Confirmed |
| Avoid wildcard callback matching | An **Allow wildcard matching** checkbox, off by default, with a warning that it sends tokens to all subdomains and paths | Confirmed |
| Expiring user tokens are on by default | **Expire user access tokens** was ticked by default | Confirmed |
| Device flow must be enabled per app | **Enable Device Flow** checkbox; the agent's earlier unregistered probe got 404 until a real app had it ticked | Confirmed |

**Consent screen, observed**

- Title: "Authorize OAuth Path test", "by Saubhagya Kashyap", "wants to access your account".
- Requested access: **Personal user data: Profile information (read-only)**, matching the `read:user` scope.
- Trust signals shown to the user: "**Not** owned or operated by GitHub", "Created **less than a day ago**", "**Fewer than 10** GitHub users", and the requesting location and time.
- **The Authorize button stayed disabled while an automated browser was in control.** It worked only when the person clicked it. This is the clearest evidence for the agent and human boundary: an agent can prepare everything, but user consent has to come from the user.

**Token and API call, observed**

| Check | Result |
| --- | --- |
| Device code request | 200, code valid for 15 minutes, poll every 5 seconds |
| Token issued after Authorize | bearer token, granted scope `read:user` |
| Access token lifetime | **8 hours** (expires_in 28800) |
| Refresh token | **Issued**, valid for about **6 months** (15,638,400 seconds) |
| API call with the token | `GET /user` returned 200, `X-OAuth-Scopes: read:user` |
| Refresh exchange | Not run: it needs the client secret, which was deliberately never created |

**What this changed in the GitHub guide:** the token-expiry step now states the observed 8-hour and 6-month lifetimes. The evidence status records a real end-to-end test. A new hand-off notes that a person must click Authorize.

**Not tested:** organization access restrictions (needs an organization with restrictions enabled), wider scopes, and token refresh.

**Clean-up:** revoke the authorization at https://github.com/settings/applications (Authorized OAuth Apps), then delete the app under Developer settings when it is no longer needed for a demo.
