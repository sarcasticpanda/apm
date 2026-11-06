# Five-minute demo

1. **Frame the problem (30s).** Open https://oauth-path.kadakchai-panda.workers.dev. The route board shows each provider as one line through Register, Provider review, Customer admin, and User consent. The three lines differ at a glance: GitHub has no review, Slack's review is required, and Google's depends on scopes. One OAuth app is one registration; each user's connection is a separate consent.
2. **GitHub, the light path (60s).** Open GitHub. Point out:
   - the first action;
   - the 1–3 hour estimate, labelled ours;
   - the **Who has to say yes** panel: no central review, but an organization owner may still need to approve.

   Tick a step and reload to show that progress is saved.
3. **Contrast Slack and Google (60s).** Slack: provider review is *required for commercial launch*, with feedback windows quoted from Slack, plus the 10-installs-throughout-review rule. Google: review *depends on scopes*, from minutes for automated branding to weeks for restricted data.
4. **Live research by name (90s).** Type **Calendly** (not in the library). While it runs (~25s), explain the stages: name → Wikidata official site → developer portal and `llms.txt` → ranked OAuth pages → cited AI draft. When it finishes, show the research activity log, the sources, and the approval-wait line. It says no review was established instead of inventing one.
5. **Reviewer's choice (60s).** Let the reviewer pick an app. If its docs need JavaScript or sign-in, the draft says so and asks for the docs URL. Pasting the developer-docs URL usually gives a sharper draft.
6. **Share (30s).** Copy the generated guide's link into a private window. It opens the same snapshot without your checklist. Markdown download and Print/PDF also work.

Be explicit: documentation was checked and re-checked, but no provider app was registered and no approval was submitted. See `docs/evidence.md` for the corrections and `docs/qa-results.md` for what was tested.
