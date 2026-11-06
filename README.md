# OAuth Path

Know the path before you build. OAuth Path shows developers and agent builders what it takes to get a provider OAuth app ready: where to start, how much hands-on work to expect, which approvals apply and how long they take, what can block you, and where an agent stops and a human takes over.

- **Live experience:** https://oauth-path.kadakchai-panda.workers.dev
- **Source:** https://github.com/sarcasticpanda/apm

## What it does

1. **Guide library.** Three researched guides chosen because their approval paths differ:
   - **GitHub:** light self-service registration, but a customer organization can block access.
   - **Slack:** an unlisted pilot is easy; commercial distribution requires Marketplace review with published feedback windows.
   - **Google:** the audience and scopes decide between minutes of automated brand checks and weeks of restricted-scope review.

   Each guide shows a first action, a hands-on estimate kept separate from provider waiting time, a **"Who has to say yes"** panel (provider review / customer admin / user consent), an ordered checklist with owners and per-step citations, blockers with next actions, uncertainties, and dated official sources.
2. **Live research for any other app.** Enter a name ("Calendly") or a website. The agent works in stages:
   - It resolves the provider: built-in directory, then Wikidata's official-website record, then a verified domain guess, then web search.
   - It probes common developer portals and `llms.txt` documentation indexes.
   - It crawls the highest-ranked OAuth pages, skipping marketing and sign-in pages.
   - Workers AI (Llama 3.3 70B) drafts a cited guide.

   Every review, admin-approval, and timing claim the model makes is re-checked against the pages actually read. Unsupported claims are removed or turned into "confirm with the provider" tasks.
3. **Sharing.** Library guides share by link. A generated draft travels as a compressed snapshot in the URL, so another person can open it without re-running research. Guides also export to Markdown and print to PDF. Checklist progress stays in the viewer's browser.

## Run locally

Requires Node.js 22+.

```sh
npm ci
npm run dev            # http://localhost:4173 (PORT changes it)
npm test               # unit tests: SSRF guards, parsing, discovery, AI-claim validation, guide data
npm run test:ui        # Chromium flows + axe accessibility scan (app must be running; BASE_URL to target a deployment)
npm run test:browsers  # core flows in Chromium, Firefox, and WebKit
node tests/exploratory.mjs   # 320px, print, clipboard denial, error recovery, private-file and private-address rejection
```

Local development has no Workers AI binding, so live research returns a clearly labelled **extracted evidence** draft instead of an AI draft.

## Deploy

```sh
npx wrangler login
npm run deploy         # copies public assets to .output/public and deploys worker.mjs
```

`wrangler.jsonc` defines the Worker, the static-assets binding, and the Workers AI binding. No secrets are needed; keep Cloudflare credentials in Wrangler's login, never in the repo.

## Key decisions

- **Separate the gates.** The core confusion is that registering an app, a provider's review, a customer admin's approval, and each user's consent are different decisions with different owners and timelines. Every guide models them separately so "it works in my account" is never mistaken for "approved for launch".
- **Three deep guides beat 100 shallow ones.** The take-home asks for a few varied apps, so each guide is source-checked step by step. The live agent covers the long tail.
- **Effort and waiting are different numbers.** Hands-on estimates are labelled ours and exclude waiting. Provider review windows are quoted from the provider and never presented as a launch date.
- **Honesty over coverage.** When the agent cannot find OAuth docs, it says so and gives the next action. It never fills the gap with plausible-sounding policy.
- **Managed OAuth apps.** Borrowing a platform's pre-registered (and possibly pre-reviewed) app can remove registration and provider review. It does not remove user consent or customer-admin controls, and it usually limits you to that app's approved scopes and branding. The site explains this trade-off; it does not assume any specific vendor.

## Evidence and testing

- [docs/evidence.md](docs/evidence.md): sources, corrections found by review, and what stays unverified.
- [docs/qa-results.md](docs/qa-results.md): what was tested and the results, including live research trials.
- [docs/demo.md](docs/demo.md): a five-minute demo script.
- [docs/screenshots/](docs/screenshots/): the deployed UI.

## Limits

- No provider app was registered, no token was exchanged, and no review was submitted. Those steps need provider accounts and authorized credentials. The guides are documentation reviews, not completed setups.
- The crawler reads server-rendered HTML, Markdown, and `llms.txt`. Docs that render only with JavaScript (for example Xero's main OAuth guide) or sit behind sign-in can't be read. The draft then says so and asks for the docs URL.
- The model can still misread a source. Drafts are labelled, cited, and meant to be reviewed before a launch commitment.
- Rate limiting is per Worker isolate (a demo guard, not production abuse control). On the local Node server, the DNS check and the fetch resolve separately, so a rebinding window remains. Cloudflare's egress cannot reach private networks.
- The library has 3 guides, not 100. Provider facts were checked on 4–5 November 2026 and will drift.
