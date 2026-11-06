# Evidence and corrections

Reviewed on **4 November 2026**. This log records documentation checks, not completed provider setup. No provider client secret, OAuth grant, test account, approval submission, or security assessment was created during this audit.

## What the product is explaining

A provider OAuth app is the client registration at a service such as GitHub. The developer's integration is the code that calls that service's API. A user connection is the consent and token relationship for a particular user or installation. Registering one app does not connect all users automatically. Provider review, customer administrator approval, and each user's consent are separate gates.

A managed OAuth app can supply a pre-existing client registration through an integration platform. It may reduce setup work, but availability, supported scopes, permitted distribution, and provider policy still need checking. The assignment did not identify a specific managed-app directory, so this sample does not imply compatibility with any particular vendor's managed registration.

## Corrections from the first draft

| Earlier claim | Finding and change | Primary evidence |
| --- | --- | --- |
| Slack's review wait was not published. | Current documentation publishes separate preliminary and functional feedback windows. The guide now includes them and explains that feedback is not final approval. | [Review process](https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide/) |
| Slack Marketplace review was simply optional. | Unlisted pilots are distinct from commercial distribution. The guide now tells commercial builders to plan for Marketplace eligibility and review. | [Distribution](https://docs.slack.dev/app-management/distribution/), [commercial distribution clarification](https://docs.slack.dev/changelog/2025/05/29/tos-updates/) |
| Google brand review generally takes 2–3 business days. | The dedicated brand page describes an automated path that usually takes minutes and a manual fallback of 2–3 business days. | [Brand verification](https://developers.google.com/identity/verification/authentication-verification) |
| GitHub had no approval concerns. | The registration guide describes a self-service path, but organization data can require customer-owner approval. No central review in a setup page is not proof of unrestricted access. | [Registration](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app), [organization restrictions](https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/about-oauth-app-access-restrictions) |

## Provider-specific checks

### GitHub

The current [registration instructions](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) confirm up to 10 callbacks and the current token-expiry default. The [authorization reference](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) supplies the flow, state, PKCE, redirect, and refresh details. This matters because older advice that assumes one callback or permanent tokens can produce an incomplete implementation.

The guide's 1–3 hour estimate is our assumption for an existing OAuth backend, not a provider SLA or an estimate for building the whole integration.

### Slack

The [OAuth reference](https://docs.slack.dev/authentication/installing-with-oauth/) distinguishes bot and user scopes and HTTPS redirects. The [review process](https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide/) describes a required demo, test access, and queue behavior.

The [submission guidelines](https://docs.slack.dev/slack-marketplace/slack-marketplace-app-guidelines-and-requirements/) are particularly relevant to agent builders: an MCP-only product without meaningful Slack functionality can be ineligible.

An unresolved documentation discrepancy remains: the review process requires 10 active workspaces, while the updated guidelines describe low usage using workspace count **and** monthly active users. The [September installation announcement](https://docs.slack.dev/changelog/2026/09/01/slack-marketplace-install-requirement/) also requires maintaining 10 installations during review. The guide reports the discrepancy and directs the builder to current submission eligibility instead of assuming an exception.

### Google

The [app-state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview) distinguishes Internal/External audiences, testing, and Workspace administrator controls. The [sensitive-scope guide](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) publishes a review estimate of up to 10 days. The [restricted-scope guide](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) describes potentially several weeks and assessment obligations. The app does not turn those ranges into a promised approval date.

The restricted-scope page still contains a generic brand-review estimate. The guide uses the more specific automated/manual distinction from the [brand page](https://developers.google.com/identity/verification/authentication-verification) and calls out the difference.

## How to interpret evidence in generated guides

- **Read source:** the research pipeline obtained public content from the URL. This does not prove that the page is up to date or that a conclusion is correct.
- **AI draft:** a model organized retrieved evidence. It is not an approval decision or a completed setup attempt.
- **Extraction fallback:** the app could retrieve source evidence but could not complete model synthesis. This must remain visibly distinct from an AI draft.
- **Unknown:** the pipeline did not establish a requirement or duration. Absence of a requirement in retrieved pages does not establish that it does not exist.

Provider portals can require login, reject crawlers, or use content that is difficult to retrieve. An unfamiliar app is a successful demonstration only when the app honestly reports these limits and gives the developer a concrete next action.
