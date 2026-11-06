# Completed checks

Handoff updated 5 November 2026. Provider evidence was reviewed 4 November 2026; see evidence.md for source dates and unresolved discrepancies.

## Published version

- URL: https://oauth-path.kadakchai-panda.workers.dev
- Cloudflare Worker: `oauth-path`
- Current deployment version: `d28f0e0e-b7ed-4527-9b81-92461bfc602c`
- Bound services: static assets and Workers AI.
- No provider credentials are stored in the project or requested by the app.

## Automated checks

`npm test`: **15 passed**, covering public URL/DNS/redirect restrictions, extraction, actual read-source references, missing evidence, unknown names, model fallback, dropped invalid citations, unsupported approval claims, truthful agent capabilities, public asset boundaries, and curated guide integrity.

`npm run test:ui` passed locally and against the published URL using Chromium. Checked library/search/filter/empty states, saved progress, fresh-browser sharing, Markdown downloads, real Linear name-only research, compressed draft sharing, malicious/malformed snapshots, and desktop/tablet/mobile layouts. Production trial read five public Linear pages and returned `mode: ai`. The live response was then replayed in the browser to make rendering/share checks deterministic.

The axe scans found **zero WCAG A/AA violations in the tested home, curated-guide, and generated-guide states**. This is automated coverage, not a claim of complete accessibility certification. Initial low-contrast labels were corrected before rerunning the checks.

`node tests/exploratory.mjs` passed locally and against the published URL: 320px layout with reduced motion, print/PDF visibility, denied-clipboard fallback, recoverable research errors, library loading retry, private file denial, and private-address rejection.

Desktop and mobile screenshots were visually inspected, including actual scrolled guide content. No horizontal overflow or clipped primary controls was found at the tested sizes: 1440×1000, 768×1024, 390×844, and 320×740. Screenshots, exported sample PDF, and machine-readable reports are in the local ignored `artifacts/` directory.

## Live content trials and corrections

- Linear: read official OAuth, actor authorization, and manifest pages; generated a cited AI draft.
- Todoist: a documentation URL outside the curated library and identity seed map produced a cited AI draft in Cloudflare preview.
- An initial model response confused user consent with provider review. A guard now converts unsupported provider/admin approval gates to a confirmation task, and a regression test covers that case.
- Model-generated capability lists could overstate what the research agent does. The service now uses a fixed, truthful capability/handoff boundary: reading and drafting are automated; account access, credentials, tests, and submissions require the developer.
- A model difficulty label such as “high” is no longer displayed as a time estimate. Unsupported durations stay unknown; accepted estimates are explicitly labeled as AI planning estimates.

## Limits of validation

No provider app was registered, OAuth token exchanged, or review submitted. No paid plan or security assessment was purchased. Crawlers and AI can fail; fallback findings are visibly labeled. Chromium was exercised; separate Safari/Firefox and assistive-technology sessions were not run. Runtime rate limiting is a lightweight per-instance demo limit, not a production abuse-control guarantee. Source links and model paraphrases still require developer judgment.
