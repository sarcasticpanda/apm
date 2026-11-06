# OAuth Path

An OAuth setup guide finder for developers and agent builders. Compare three researched providers, track setup tasks, and investigate an app outside the library using public documentation.

**Live experience:** https://oauth-path.kadakchai-panda.workers.dev

The app is deployed to the owner's Cloudflare account with a Workers AI binding. Source is in this local Git repository; a public Git hosting remote has not been created.

## Run

Use Node.js 22 or newer:

```sh
npm ci
npm run dev
```

Open `http://localhost:4173`. `PORT` changes the local port. Local Node development reads public documentation and uses a clearly marked extraction fallback because it has no Workers AI binding.

```sh
npm test
npm run test:ui
node tests/exploratory.mjs
npm run build
npm run preview
```

The build copies only public browser assets into `.output/public`. Wrangler preview uses the Worker configuration and your Cloudflare access; model availability and account limits can affect AI research.

## Deploy to Cloudflare

```sh
npx wrangler login
npm run deploy
```

`wrangler.jsonc` defines the Worker, static-assets binding, and Workers AI binding. Keep Cloudflare credentials in Wrangler's local authentication or an appropriate CI secret. Never add them to source files or a shared guide. The public address is printed by the successful deployment command; do not treat a preview address as proof of a production deployment.

## What this demonstrates

- **GitHub:** registration is relatively light, but customer organization access is a separate gate.
- **Slack:** an unlisted pilot and commercial Marketplace distribution have different requirements; eligibility can matter as much as OAuth code.
- **Google:** audience and scopes determine brand verification, data review, and possible security-assessment work.
- **Live research:** an app name or website starts a bounded documentation investigation. Available evidence is organized into a guide with sources, unknowns, blockers, and human handoffs.
- **Sharing:** curated links identify a provider; generated links carry the draft so another browser can read it without the creator's checklist storage.

## Key product decisions

The first decision is to understand what must happen before the intended users can connect. Guides therefore separate configuration, developer effort, provider waiting time, customer-administrator decisions, and per-user consent.

Three varied providers are more useful for the assignment than 100 shallow templates. Each library guide includes an evidence date, explicit assumptions, step-level source references, and blockers. Hands-on estimates assume an existing integration and exclude product development. Published review windows remain estimates, not promised launch dates.

A provider OAuth app is the client registration. The integration is the developer's API code. A connection is the user's or workspace's consent/token relationship. A managed OAuth registration may reduce setup work but does not automatically remove provider policy or consent obligations.

## Research architecture

- Vanilla HTML, CSS, and browser JavaScript keep the original project simple.
- `guides.json` holds reviewed examples independently from rendering code.
- `research.mjs` performs bounded source discovery and retrieval, then uses the available Workers AI binding to synthesize a cited draft.
- If model synthesis is unavailable, the response identifies its extraction fallback. Missing evidence stays unknown rather than becoming an invented approval policy.
- `server.mjs` provides local development. `worker.mjs` exposes the research API on Cloudflare and serves an explicit public asset set.
- Checklist progress stays in the current browser. Generated drafts are shared through URLs; avoid putting confidential product details into research inputs or shared drafts.

## Evidence and testing

Read [the evidence log](docs/evidence.md) for sources, corrections, and uncertainty. The review caught material errors in the earlier draft: Slack does publish review-feedback windows, commercial distribution should not be described as an unlimited unlisted bypass, and Google's automated brand check differs from manual review.

[The QA inventory](docs/qa-plan.md) covers library navigation, checklists, unfamiliar-app research, sharing, errors, request boundaries, accessibility, mobile layouts, and deployment. [The result log](docs/qa-results.md) records completed checks. Backend tests live in `backend.test.mjs`; data and browser tests are in `tests/`. Browser tests need the app running and save screenshots/reports in ignored `artifacts/`. Set `BASE_URL` to check a deployed environment. The UI suite makes one real research request, then replays that captured response for rendering/share assertions. Set `REUSE_LIVE=1` only when deliberately reusing an earlier capture.

## Limits

No provider app was registered, OAuth token exchange completed, or approval submitted. Those steps need provider accounts, product details, and authorized credentials. Documentation review is not a completed setup attempt.

The research agent can miss login-only, JavaScript-only, or crawler-blocked documents. A model can misread a source, and a read page can be outdated. Generated drafts require review before implementation or a launch commitment. Name-only discovery can be ambiguous; supplying the official website gives a better starting point.

This is a focused take-home slice, not an approval service or a production security claim. It does not contain all 100 providers, completed assessments, guaranteed review dates, or a centrally maintained guide database. Provider credentials remain outside the submission.
