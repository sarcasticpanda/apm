# QA inventory

This is the planned acceptance inventory. A checkbox here is not proof of a passing test. Actual commands, browser observations, and deployment results belong in a separate result log or the final handoff.

## Library and guide use

- The library loads all three guides from `guides.json`, with no fabricated 100-app count.
- App-name search, keyword search, effort filters, and a zero-results state work.
- Every card opens the matching guide; Back returns to the library.
- Setup effort is distinct from provider waiting time; assumptions are visible.
- A guide shows the next action, specific tasks, sources, blockers, and human handoffs.
- Checklist progress survives reload and is scoped to the correct provider.
- Corrupt or unavailable browser storage does not prevent reading a guide.
- Known-guide links open the right guide in a fresh browser context.

## Unfamiliar-app research

- A provider name alone can trigger lookup or a clear disambiguation action.
- A full official website can trigger lookup without requiring a second field.
- Try a provider outside the three curated examples, such as Linear, Notion, or Dropbox.
- The result contains actual provider source URLs and avoids invented approval timing.
- Read-source status, model synthesis, fallback extraction, and failed fetches are truthful.
- Progress messages and final states agree with the work that really happened.
- Failed research has a useful next step and can be retried without reloading.
- Generated share links work without the creator's local storage.
- Malformed shared drafts cannot run JavaScript, inject links with unsafe schemes, or crash the application.
- User intent, audience, and scopes are either collected or recorded as assumptions.

## Boundaries and security

- Reject unsupported protocols, credentials in URLs, localhost/private hosts, and private redirect destinations.
- Limit request sizes, fetch count, response content, and total research time.
- Static hosting exposes only public assets, never project/configuration/credential files.
- API requests with incorrect methods or malformed JSON return clear bounded errors.
- Research does not create provider apps, accept terms, or claim account-level testing.
- Provider credentials remain outside frontend code, logs, downloadable artifacts, and share URLs.

## Visual and accessibility review

- Inspect desktop and narrow mobile screenshots of the first view, open guide, research loading, research result, and error state.
- Check long names, long source URLs, full progress, empty results, and unavailable storage.
- Check keyboard order, visible focus, labels, expanded-state announcements, and no keyboard traps.
- Verify adequate body and caption sizes, contrast, hover feedback, and reduced-motion support.
- Confirm no horizontal overflow, clipped headings, overlapping controls, or sticky-header obstruction.
- Exercise actual controls after screenshots; a nice screenshot alone is insufficient.

## Deployment and submission

- Production returns the UI, public assets, and functioning research API over HTTPS.
- The deployed build and local source correspond; production is checked after deployment.
- The README has correct run/test/deploy commands and honest AI configuration requirements.
- The deployed URL is recorded only after a successful deployment.
- A source repository URL is recorded only if a remote exists and was actually pushed.
- Evidence log identifies important corrections, uncertainty, and unattempted account-level work.

## Deliberate exclusions

The assignment permits no paid provider accounts, completed approvals, or production readiness. This sample therefore does not claim OAuth-provider approvals, security-assessment completion, comprehensive legal review, all 100 guides, or exhaustive support for every documentation site.
