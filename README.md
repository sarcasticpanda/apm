# OAuth Path

Know the path before you build. OAuth Path shows developers and agent builders what it takes to get a provider OAuth app ready: where to start, how much hands-on work to expect, which approvals apply and how long they take, what can block you, and where an agent stops and a human takes over.

- **Live experience:** https://oauth-path.kadakchai-panda.workers.dev
- **Source:** https://github.com/sarcasticpanda/apm

## What it does

1. **Guide library.** Six researched guides, chosen because each has a different hardest gate:
   - **GitHub:** light self-service registration, but a customer organization can block access.
   - **Slack:** an unlisted pilot is easy; commercial distribution requires Marketplace review with published feedback windows.
   - **Google:** the audience and scopes decide between minutes of automated brand checks and weeks of restricted-scope review.
   - **Dropbox:** testing is self-service, but once 50 users link you have two weeks to get production approval or new links freeze.
   - **Microsoft:** registration is easy, but each customer tenant's consent rules and your publisher verification decide whether its users can connect.
   - **Spotify:** development mode allows only 5 users. Since May 2025 more users need Spotify to accept your organization as a partner (at least 250k monthly active users), so for most new agents this gate is the blocker.

   Each guide shows a first action, a hands-on estimate kept separate from provider waiting time, a **"Who has to say yes"** panel (provider review / customer admin / user consent), an ordered checklist with owners and per-step citations, blockers with next actions, uncertainties, and dated official sources.
2. **Live research for any other app.** Enter a name ("Calendly") or a website. The agent works in stages:
   - It resolves the provider: built-in directory, then Wikidata's official-website record, then a verified domain guess, then web search.
   - It probes common developer portals and `llms.txt` documentation indexes.
   - It crawls the highest-ranked OAuth pages, skipping marketing and sign-in pages. Pages that only render with JavaScript are opened in a headless browser: Cloudflare Browser Rendering in production, Playwright locally. It renders up to two pages per request.
   - Workers AI (Llama 3.3 70B) drafts a cited guide.

   The model's review, admin-approval, and provider-timing claims are re-checked against the pages actually read. That covers the summary, approval wait, requirements, steps, and blockers. A time range passes only if both of its numbers appear in a cited page. Unsupported claims are removed or turned into "confirm with the provider" tasks. The model's own effort figure is shown as a labelled AI planning estimate, not a provider claim.
3. **Sharing.** Library guides share by link. A generated draft travels as a compressed snapshot in the URL, so another person can open it without re-running research. Guides also export to Markdown and print to PDF. Checklist progress stays in the viewer's browser.

## Run locally

Requires Node.js 22+.

```sh
npm ci
npm run dev            # http://localhost:4173 (PORT changes it)
npm test               # unit tests: SSRF guards, parsing, discovery, AI-claim validation, guide data
```

The browser suites need Playwright's browsers once, and the app running (locally, or set `BASE_URL` to a deployment):

```sh
npx playwright install chromium firefox webkit
npm run test:ui              # Chromium flows + axe accessibility scan
npm run test:browsers        # core flows in Chromium, Firefox, and WebKit
node tests/exploratory.mjs   # 320px, print, clipboard denial, error recovery, private-file and private-address rejection
npm run test:a11y            # what a screen reader is told (names, headings, landmarks, announcements) + keyboard-only flows
```

Probes against real services:

```sh
npm run probe:endpoints      # calls GitHub, Slack, and Google OAuth endpoints with an unregistered app and records the refusals
npm run probe:research -- https://oauth-path.kadakchai-panda.workers.dev '[{"name":"Calendly"}]'
npm run setup:github         # real GitHub OAuth App test via device flow; see docs/github-setup-attempt.md
```

Local development has no Workers AI binding, so live research returns a clearly labelled **extracted evidence** draft instead of an AI draft. JavaScript-only pages are rendered with the Playwright Chromium that the test suites already install.

## Deploy

```sh
npx wrangler login
npm run deploy         # copies public assets to .output/public and deploys worker.mjs
```

`wrangler.jsonc` defines the Worker, the static-assets binding, the Workers AI binding, and the Browser Rendering binding (`BROWSER`, with `nodejs_compat` for `@cloudflare/puppeteer`). No secrets are needed; keep Cloudflare credentials in Wrangler's login, never in the repo.

**Stack:** vanilla HTML, CSS, and JavaScript (no framework or client bundle). It uses self-hosted Bricolage Grotesque, Outfit, and DM Mono (OFL) from `@fontsource` and Phosphor icons (MIT); `scripts/build-icons.mjs` generates `icons.js`. It supports light and dark mode from the system setting and respects reduced motion.

## Key decisions

- **Separate the gates.** The core confusion is that registering an app, a provider's review, a customer admin's approval, and each user's consent are different decisions with different owners and timelines. Every guide models them separately so "it works in my account" is never mistaken for "approved for launch".
- **Six deep guides beat 100 shallow ones.** The take-home asks for a few varied apps. Each guide was drafted from official pages only, attacked claim by claim by a separate fact-checking agent, corrected, and its headline numbers re-checked by hand against the live pages. The live agent covers the long tail.
- **Effort and waiting are different numbers.** Hands-on estimates are labelled ours and exclude waiting. Provider review windows are quoted from the provider and never presented as a launch date.
- **Show the route, not a wall of text.** The first screen is a "Compare the routes" board: all six providers drawn as parallel lines across the same four stops (Register, Provider review, Customer admin, User consent), so the hardest gate for each is visible at a glance. Selecting a line lights it and shows that provider's notes; every provider card repeats the route in compact form. Gate states use shape and text as well as colour, so they read without colour vision and in dark mode.
- **Honesty over coverage.** When the agent cannot find OAuth docs, it says so and gives the next action. It never fills the gap with plausible-sounding policy.
- **Managed OAuth apps.** Borrowing a platform's pre-registered (and possibly pre-reviewed) app can remove registration and provider review. It does not remove user consent or customer-admin controls, and it usually limits you to that app's approved scopes and branding. The site explains this trade-off; it does not assume any specific vendor.

## Evidence and testing

- [docs/evidence.md](docs/evidence.md): sources, corrections found by review, and what stays unverified.
- [docs/qa-results.md](docs/qa-results.md): what was tested and the results, including live research trials.
- [docs/github-setup-attempt.md](docs/github-setup-attempt.md): how far an agent got against real OAuth endpoints, and the scripted GitHub registration test.
- [docs/demo.md](docs/demo.md): a five-minute demo script.
- [docs/screenshots/](docs/screenshots/): the deployed UI.

## Limits

- The agent attempted each provider's real authorization endpoints without an account. Every provider stopped it at registration and sign-in, as expected; see [docs/github-setup-attempt.md](docs/github-setup-attempt.md). A real GitHub registration and token test is scripted (`npm run setup:github`), but it needs a person's GitHub account. No provider review was submitted.
- The crawler reads server-rendered HTML, Markdown, and `llms.txt`, and renders up to two JavaScript-only pages per request. Docs behind sign-in still can't be read; the draft says so and asks for the docs URL. Browser Rendering has daily free-plan limits, and when they run out the draft falls back to what plain fetching found.
- The model can still misread a source. Drafts are labelled, cited, and meant to be reviewed before a launch commitment.
- Rate limiting is per Worker isolate (a demo guard, not production abuse control). On the local Node server, the DNS check and the fetch resolve separately, so a rebinding window remains. Cloudflare's egress cannot reach private networks.
- The library has 6 guides, not 100. Provider facts were checked on 4-5 November 2026 and will drift.
