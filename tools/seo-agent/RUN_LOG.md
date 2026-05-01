# SEO Agent Run Log

## 2026-05-01 09:28
- Findings: 6 (metadata PR: 3, issue: 8, digest: 3)
- PRs opened: metadata — `seo/autofix-metadata-2026-05-01` (pending creation, see below)
- Issue: `seo: fortnightly report 2026-05-01` (pending creation)
- IndexNow: no new URLs added this run — not submitted
- Notes:
  - `gh` CLI not available in this environment; GitHub API interactions performed via curl with PAT
  - GSC data thin (site first verified 2026-04-30, 1 day old) — zero impressions expected, not alarming
  - Homepage missing canonical/JSON-LD in static HTML is intentional per vite.config.ts `postProcess` (avoids white-label domain contamination); Google sees it via JS execution (confirmed by GSC user_canonical)
  - /features and /support placeholder titles ("Seo") caused by missing i18n keys in all non-IE locales — fixed by hardcoding SEO props directly (PricingPage.tsx pattern)
  - Previous run issue #256 still open; comment added noting persisting findings
