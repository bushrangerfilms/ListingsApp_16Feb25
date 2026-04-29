# `locale-config/` — single source of truth for all locale-keyed behaviour

This directory exists because the same locale fact (e.g. _"Murphy's prices should
display in USD"_) was previously stored in **three** different files in two
different shapes, and they kept drifting on every PR. Every drift produced a
customer-visible bug. This directory makes that class of bug a compile error.

## Files

| File | Purpose | Hand-edited? |
|---|---|---|
| `locale.config.ts` | The canonical source. Types, the `LOCALE_CONFIGS` map, lookup tables, formatters. | **Yes — edit this and only this** |
| `locale.config.check.ts` | Exhaustiveness + invariant checks. Run via `npx tsx`. Exits 1 on failure. | Yes (when adding new invariants) |
| `sync.ts` | Mirrors the canonical file to every consumer location. `--check` mode for CI. | Rarely — only when the mirror set changes |

## Mirror destinations (after Checkpoint A lands)

Running `npx tsx locale-config/sync.ts` writes the canonical file (with an
auto-generated banner + SHA-256) to:

```
Listings/src/lib/locale/config.ts                       ← Listings frontend
Listings/supabase/functions/_shared/locale.config.ts    ← Listings edge fns
../Socials/src/lib/locale/config.ts                     ← Socials frontend
../Socials/server/services/locale.config.ts             ← Socials Node server
../Socials/supabase/functions/_shared/locale.config.ts  ← Socials edge fns
```

Mirrors carry a `// ⚠️ AUTO-GENERATED ... DO NOT EDIT` banner and their hash.
Drift detection is a one-line `sha256` compare in `sync.ts --check`.

## Workflows

### Adding a new market (e.g. `en-DE`)

1. Open `locale.config.ts`. Extend `MarketLocale` / `MarketCountry` /
   `MarketCurrency` unions. **TypeScript will now error in `LOCALE_CONFIGS`,
   `COUNTRY_TO_LOCALE`, `LOCALE_TO_COUNTRY`, `LOCALE_TO_CURRENCY`** until
   you fill in values for the new market.
2. Fill in those values.
3. `npx tsx locale-config/locale.config.check.ts` — exhaustiveness checks.
4. `npx tsx locale-config/sync.ts` — regenerate mirrors.
5. Open a follow-up DB migration to widen the `country_code` / `currency`
   CHECK constraints (see the pattern in
   `supabase/migrations/20260429170000_widen_locale_constraints.sql`).

### Changing a field shape

1. Edit `RegionConfig` and update every entry in `LOCALE_CONFIGS`.
2. Run the check + sync scripts.
3. Update consumer call-sites in a follow-up commit.

### Verifying nothing has drifted

```bash
npx tsx locale-config/locale.config.check.ts   # exhaustiveness
npx tsx locale-config/sync.ts --check          # mirror drift
```

Both commands exit non-zero on any failure and are safe to run as CI gates.

## Rollout

This directory was added in the **Checkpoint A** PR. It is dormant until later
checkpoints rewire consumers:

- **A** _(this PR)_ — canonical file + check + sync scaffolding. **No runtime
  imports change.**  Mirrors are written but not yet imported.
- **B** — switch every Socials edge function (`prepare-image-post`,
  `prepare-branded-carousel-post`, etc.) from inline locale literals to the
  mirror's `formatPrice` / `formatLocation` / etc. This is what stops the €
  appearing on US image posts.
- **C** — switch both frontends (`useRegionConfig`, `useLocale`) from the
  legacy `regionConfig/` directories to the mirror. Delete the legacy
  directories in the same PR.
- **D** — add ESLint rules forbidding hardcoded `€` / `£` / `Co. ` / `Eircode`
  / `BER` / etc. literals outside `locale-config/`. Run them, fix every
  flagged hardcode (drives the `SellerProfileCard` / `LeadMagnetQuiz` /
  `ReviewListing` cleanups).
- **E** — multi-currency Stripe pricing. `pricing.yaml` becomes a sibling
  source of truth, similar pattern.
- **F** — codegen DB CHECK constraints from `MarketLocale` / `MarketCurrency`,
  decommission the legacy launch-flag system.

See the audit thread (PR description on the original audit) for the full plan
and rationale.

## Guarantees this directory provides

- **Compile-time exhaustiveness.** Every `Record<MarketLocale, T>` rejects a
  build that's missing a market.
- **Runtime exhaustiveness.** `locale.config.check.ts` verifies that every
  market is consistent (locale ↔ country ↔ currency lookups round-trip,
  postcode regexes compile, formatters produce expected idioms).
- **Sync correctness.** `sync.ts --check` fails CI if any mirror has drifted
  from the canonical file.
- **Single doorway.** `resolveLocaleFromOrg(org)` is the only sanctioned way
  to turn a DB org row into a `RegionConfig`. Lint rules in Checkpoint D
  forbid raw `country_code` access elsewhere.

## Things this directory deliberately does NOT own

- Plan pricing in cents (lives in `plan_definitions` and — once Checkpoint E
  lands — in `pricing.yaml`).
- Stripe price IDs (managed by `stripe-setup` from `pricing.yaml`).
- DB schema (lives in `supabase/migrations/`, but constraint values are
  codegen'd from the locale union — see Checkpoint F).
- i18n message catalogues (separate concern — per-language UI strings live
  in `public/locales/<lang>/*.json`).
