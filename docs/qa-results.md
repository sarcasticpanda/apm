# Completed checks

Updated 5 November 2026. Provider evidence was reviewed on 4 November and re-checked on 5 November 2026; see [evidence.md](evidence.md).

## Published version

- URL: https://oauth-path.kadakchai-panda.workers.dev (Cloudflare Worker `oauth-path`, with static assets and a Workers AI binding)
- Source: https://github.com/sarcasticpanda/apm
- No provider credentials are stored in the project or requested by the app.

## How the review was run

Eight independent reviewer agents audited one dimension each: backend security and correctness, frontend behaviour, visual design, the three curated guides against the live docs, submission completeness, and live research on production. A second agent per dimension then tried to refute each finding. **19 code and evidence findings were confirmed, 2 were refuted, and 1 stayed uncertain.** Seventeen confirmed findings were fixed, along with the uncertain one, and the code fixes have regression tests. Two are documented as known limits rather than fixed: the DNS-check/fetch rebinding window on the local Node server, and per-isolate rate limiting. The visual-design and live-research reviews produced the design fixes and the research rebuild listed below.

A **second review round** used three reviewers plus three skeptics on the fix commit itself, and it **confirmed 10 more issues, all now fixed with tests**:

- Names under two letters, such as "C++", could resolve to an unrelated search hit.
- A Wikidata person with a matching name could be accepted as the provider.
- The upper bound of a time range ("2-14 days") went unchecked.
- Three reserved IPv6 ranges were treated as public.
- Two parsing paths were still superlinear.
- Timing claims inside steps and requirements were not checked, although the README said they were.
- A stale "guide not found" banner stayed on screen.
- A false banner appeared if history fired before the library loaded.
- Two documentation details were wrong: a missing `playwright install` step and a URL count.

## Automated checks (all passing)

| Suite | Command | Result |
| --- | --- | --- |
| Unit and data | `npm test` | **28 / 28 passed**: SSRF guards (incl. IPv6 loopback/mapped/NAT64/site-local forms), linear-time parsing, prototype-key and too-short names, Wikidata description gating, cross-domain doc redirects, `llms.txt` discovery, marketing/sign-in exclusion, AI summary/difficulty/approval-wait/step timing gating, oversized bodies, guide gates and citations |
| Browser flows | `npm run test:ui` | **Passed locally and on production.** Production ran real name-only Linear research in `ai` mode (5 pages) |
| Accessibility | axe in `test:ui`, plus a light/dark scan | **0 WCAG A/AA violations** in home, curated-guide, and generated-guide states, in both **light and dark mode** (automated coverage, not a certification) |
| Cross-browser | `npm run test:browsers` | **Chromium, Firefox, WebKit all passed on production**: guide + gates, saved progress, citation keeps URL, browser Back closes guide, generated draft, 390px layout. WebKit blocks automated clipboard reads, so its shared-link reopen step is skipped |
| Edge cases | `node tests/exploratory.mjs` | **Passed on production**: 320px + reduced motion, print/PDF, denied clipboard, research error recovery, library retry, private files and private addresses rejected |

## Live research trials on production

Run against the deployed Worker after the fixes, with name or URL input only:

| Input | Result | Time |
| --- | --- | --- |
| `Calendly` | AI draft, 4 OAuth pages (PKCE, scopes, token refresh); resolved via Wikidata | 26 s |
| `https://www.dropbox.com` | AI draft from `docs.dropboxapi.com` OAuth guide; review mentioned, no timeline claimed | 26 s |
| `Zendesk` | AI draft, 3 OAuth pages from `developer.zendesk.com` | 19 s |
| `Strava` | AI draft, 4 OAuth pages; sign-in wall excluded | 33 s |
| `Typeform` | AI draft, 2 OAuth pages; website found by verified domain guess | 24 s |
| `Xero` | AI draft from 1 page (Custom Connections). The main OAuth guide is JavaScript-rendered and unreadable by the crawler; this is reported in the draft | 15 s |

Before the fixes, the same run failed on Calendly ("could not identify"), produced no guide for Xero, and fabricated a "SpaceXAI plugin" guide for Dropbox. The root causes are in [evidence.md](evidence.md#what-live-research-trials-taught-us).

## Fixed in this round

- **Research:** prototype-key crash; unsupported review claims in the AI summary, difficulty, and approval wait; IPv6 special forms treated as public; quadratic regexes (a crafted page could block for ~15 s); no overall deadline; multi-word and out-of-directory names failing; duplicate HTML/Markdown sources.
- **Frontend:** browser Back left a closed guide on screen; citation clicks re-rendered the guide or erased a shared `#draft=` link; network errors showed raw browser text; the grid's live region re-announced every keystroke; a crafted shared draft could write into a curated guide's checklist.
- **Design:** the UI was rebuilt using the installed design skills (taste-skill, frontend-design, ui-ux-pro-max). Their audit found the old page leaning on common generated-design patterns:
  - a cream background with green and monospace labels;
  - an all-caps label above every heading;
  - decorative dots;
  - an arrow on every link;
  - em-dashes;
  - rows of three equal cards.

  The new design is a route board. Each provider's approval path is one line with shape-coded gates. It uses a cool neutral palette with one cobalt accent, self-hosted IBM Plex, Phosphor icons, and full dark mode. Motion is limited to one route-drawing animation, which is off under reduced motion. It was checked by screenshot at 1440, 390, and 320 px in light and dark mode, and the whole page has no horizontal overflow.

## Limits of validation

No provider app was registered, no token exchanged, and no review submitted. Live research quality varies by provider: JavaScript-only or sign-in-gated docs can't be read, and the model can still misread a page, so drafts stay labelled for review. Rate limiting is per Worker isolate. Screen-reader sessions with real assistive technology were not run.
