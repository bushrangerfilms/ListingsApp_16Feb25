# CLAUDE.md — Listings App (AutoListing.io)

## Purpose
Real estate SaaS platform for agents and agencies. Handles listing ingestion, CRM, public-facing property websites, lead capture forms, billing, and team management.

## Status
- Pilot phase — 2 active users on production
- Shared Supabase project with the Socials app (single production instance — no staging)
- Deployed on Railway (Docker); GitHub is the source of truth for code
- App domain: `app.autolisting.io`
- Railway project: "AutoListing Listings" — auto-deploys from `main` on push to GitHub

## Tech Stack

### Frontend Only (no separate backend server)
- React 18 + TypeScript + Vite (port 5000)
- Tailwind CSS + shadcn/ui (Radix UI) — comprehensive component library
- React Router DOM v6 (client-side routing)
- React Query v5 (data fetching)
- React Hook Form + Zod (validation)
- i18next (multi-language: en-IE, en-GB, en-US)

### Backend
- All backend logic runs in **Supabase Edge Functions** (60+ functions)
- No Express server — Supabase handles auth, RLS, and API logic
- Stripe integration for billing (via Edge Functions)

### Database
- Supabase (PostgreSQL)
- Two schemas: `public`, `crm`
- `public` schema is shared with the Socials app — treat with extra care
- 90+ SQL migrations in `supabase/migrations/`
- Row Level Security (RLS) enforces organization-level data isolation

## Key Files & Paths

| File | Purpose |
|------|---------|
| `src/main.tsx` | React entry point |
| `src/App.tsx` | Master routing — domain detection → route sets |
| `src/lib/domainDetection.ts` | Detects domain type (marketing / admin / org-public) |
| `src/lib/appUrls.ts` | URL helpers for multi-domain routing |
| `src/contexts/AuthContext.tsx` | Auth state, impersonation, roles |
| `src/contexts/OrganizationContext.tsx` | Multi-tenancy, org switching |
| `src/integrations/supabase/client.ts` | Supabase client with cross-domain cookie auth |
| `src/integrations/supabase/types.ts` | Auto-generated DB types (don't edit manually) |
| `src/lib/billing/billingClient.ts` | Credit system (consume/balance) |
| `src/lib/billing/pricing.ts` | Pricing tiers and plans |
| `src/lib/featureFlags.ts` | Feature flag system |
| `CURSOR_CONTEXT.md` | Detailed architecture and logic guide (read this!) |

## Multi-Domain Routing (Critical)

This app serves three different site types from one codebase — routing is determined by hostname:

| Domain | Type | What It Renders |
|--------|------|----------------|
| `autolisting.io`, `www.autolisting.io` | `marketing` | Marketing homepage, pricing, signup |
| `app.autolisting.io`, `localhost`, `*.vercel.app`, `*.up.railway.app` | `admin` | Full admin portal |
| Custom org domains | `org-public` | Public property listings for that org |

Detection logic: `src/lib/domainDetection.ts` → `getDomainType()`

## Key Page Routes

**Admin Routes** (under `/admin/`):
- `/admin/listings` — Listings dashboard
- `/admin/create` — Create listing
- `/admin/crm` — CRM kanban board
- `/admin/communications` — Email sequences and templates
- `/admin/analytics` — Analytics hub
- `/admin/billing` — Billing / credits
- `/admin/team` — Team management
- `/admin/settings` — Org settings

**Super Admin Routes** (under `/internal/` — `super_admin` role required):
- `/internal` — Platform dashboard
- `/internal/organizations` — All orgs
- `/internal/users` — All users
- `/internal/billing` — Billing analytics
- `/internal/feature-flags` — Feature flag toggles
- `/internal/pilot` — Pilot settings

**Public Routes**:
- `/:orgSlug` — Public listings portal
- `/:orgSlug/property/:id` — Property detail
- `/lead-magnet/:orgSlug/:quizType` — Lead gen quiz

## Active Integrations

| Service | Purpose |
|---------|---------|
| **Supabase Auth** | Authentication, cross-domain cookies |
| **Stripe** | Subscription billing + credit packs |
| **Google Gemini 2.5 Flash** | AI property descriptions, lead matching |
| **Resend** | Transactional email (via `send-email` edge function) |
| **Kie.ai / Topaz** | Photo upscaling (`upscale-photos` edge function) |

## Removed Integrations (Do Not Re-add)

- **Blotato** — Referenced in Supabase types (`blotato_accounts`, `blotato_posts` tables) but no longer used by this app. Social posting is handled entirely by the Socials app.
- **Airtable** — Referenced in Supabase types (`airtable_listings`, `airtable_field_reference`) but no longer the listing data source. Listings are created directly in this app and synced via the shared `public` schema.

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase public (anon) key |
| `VITE_SOCIALS_HUB_URL` | No | Link to Socials app (default: `https://socials.autolisting.io`) |
| `VITE_APP_DOMAIN` | No | Override app domain (default: `https://app.autolisting.io`) |
| `VITE_BILLING_EXEMPT_ORG_IDS` | No | Comma-separated org IDs exempt from credit billing |

## Supabase Tables — Quick Reference

**public schema** (SHARED with Socials app — be careful):
- `organizations` — Tenant data (domain, branding, settings)
- `user_roles` — Role assignments: `super_admin`, `developer`, `admin`, `user`
- `user_organizations` — User-org memberships
- `listings` — Core property listing data
- `feature_flags` — Feature flag toggles
- `impersonation_sessions` — Super admin impersonation audit log

**crm schema** (owned by this app):
- `seller_profiles` — Seller/agent leads with pipeline stage
- `buyer_profiles` — Buyer leads with interested properties
- `crm_activities` — Activity log (calls, emails, notes, stage changes)
- Email queue, templates, sequences tables

## User Roles & Access

```
super_admin → full platform access including /internal
developer   → extended access for testing
admin       → org admin access
user        → standard org member
```

RLS policies enforce org isolation. All queries scoped by `organization_id`.

## Billing System

- 7-tier plan system: Free / Essentials (€40/wk) / Growth (€70/wk) / Professional (€130/wk) / Multi-Branch S/M/L
- Credits run under the hood — users see clean plan tiers, not credit counts
- `src/lib/billing/billingClient.ts` — `getOrgPlanSummary()`, `checkPlanLimit()`, `consumeCredit()`
- `src/lib/billing/types.ts` — `PlanName`, `PlanTier`, `OrgPlanSummary` types
- `src/hooks/usePlanInfo.ts` — reads from `v_organization_plan_summary` view
- Plan limits enforced in `create-listing` edge function via `sp_check_plan_limits()`
- Pilot customers: `billing_override` JSONB on org bypasses plan limits
- Stripe webhooks handled by `stripe-webhook` Edge Function
- `plan_prices` table supports multi-currency (EUR/GBP/USD)
- Social Hub zoning: `social_hubs` table, listings assigned to hubs, auto-created per org

## Signup & Onboarding

- Public signup enabled via `marketing_visible` + `public_signup_enabled` feature flags
- Marketing landing page at `autolisting.io` with dynamic pricing from `plan_definitions`
- Signup: 3 fields (business name + email + password) → free tier → auto-login
- `create-organization` edge function defaults to `account_status: 'free'`, `current_plan_name: 'free'`
- Onboarding checklist (`src/components/onboarding/OnboardingChecklist.tsx`): 6 tasks with auto-detection
- Login page (`AdminLogin.tsx`): clean form only, no pilot messaging

## Internationalisation

- 6 markets: IE, GB, US, CA, AU, NZ — `src/lib/regionConfig/` with per-market config
- `RegulatoryConfig` per market: licence field labels, placeholders, regulatory body names, phone formats
- All licence/registration displays use `regulatory.licenceDisplayLabel` (not hardcoded "PSRA")
- DB column remains `psr_licence_number` (generic text field) — labels are locale-driven

## Known Technical Debt

- `src/pages/signup/OrganizationSignup.tsx` — legacy signup flow kept at `/signup/legacy`
- `supabase/types.ts` still references `blotato_*` and `airtable_*` tables — these are legacy schema remnants
- 90+ migration files — historical, many superseded by later migrations
- No test files — project relies on manual/E2E testing

## Git & Deploy Workflow

- `main` — always deployable, synced to Railway. **Never commit directly to main.**
- Every task gets its own branch: `feature/description`, `fix/description`, `chore/description`
- **Full deploy flow (automate all steps):**
  1. Push branch → open PR → squash-merge to `main`
  2. Check Railway deploy status via GraphQL API (auto-deploy webhook is unreliable)
  3. If no new deploy triggered, fire `serviceInstanceRedeploy` mutation (see `memory/railway-deployment.md` for IDs)
  4. Poll deployment status until `SUCCESS` or report failure
- **To roll back:** Go to GitHub → Pull requests → Closed → find the PR → click Revert → merge the revert PR. Every merged PR is a restore point.

## Coding Conventions

- TypeScript throughout — use `src/integrations/supabase/types.ts` for all DB types
- Never edit `types.ts` manually — regenerate via Supabase CLI: `supabase gen types typescript`
- Use `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key) on client — never service role key
- RLS handles data isolation — don't add manual org filtering as a substitute
- Respect domain routing — don't add admin UI components to marketing/public routes

## Internationalisation (i18n) Rules

**6 markets supported:** IE, GB, US, CA, AU, NZ. Locale type: `MarketLocale` from `src/lib/locale/markets.ts`.

### Locale Detection (IP Geolocation)
Locale is detected via IP geolocation (same approach as Stripe/Netflix) and applied app-wide:
1. `seedLocaleFromGeo()` in `src/main.tsx` runs **before** React mounts
2. Writes detected locale to `localStorage('autolisting_locale')` which i18n reads first
3. Detection chain: sessionStorage cache → IANA timezone (sync) → `api.country.is` (async)
4. Org locale from DB overrides after login (`OrgLocaleSync` in `App.tsx`)
5. **DO NOT modify `src/lib/i18n/index.ts`** — previous attempt (custom i18next detector) caused white screen in production

### Key geo files:
- `src/lib/geo/detectCountry.ts` — IP geolocation + timezone fallback + sessionStorage cache
- `src/lib/geo/seedLocale.ts` — seeds localStorage before React/i18n initialize

### Never hardcode:
- Currency symbols (`€`, `£`, `$`) — use `formatCurrency()` from `useLocale()` or `formatPrice()` from billing
- Locale strings in `Intl.NumberFormat` / `toLocaleDateString` — use org locale with `|| 'en-IE'` fallback
- Country names as display text — use `regionConfig` or org data
- Property terminology (flat vs apartment, solicitor vs attorney) — use `regionConfig.legal` or edge locale config

### Key files:
- `src/lib/locale/markets.ts` — `MarketLocale`, `MarketCountry`, `MarketCurrency` types + mappings
- `src/lib/regionConfig/` — per-market config (measurements, energy ratings, legal terms, tax)
- `src/lib/locale/legalConfig.ts` — `getLegalConfig(countryCode)` for DPA, governing law, VAT
- `src/config/company.ts` — `getDataProtectionAuthority(countryCode)` for privacy compliance
- `src/hooks/useLocale.ts` — `useLocale()` hook for frontend locale/currency/formatting
- `supabase/functions/_shared/locale-config.ts` — edge function locale config for all 6 markets

### Market gating:
- New markets gated by feature flags (`ca_launch`, `au_launch`, `nz_launch`)
- Use `useMarketRollout()` from `src/hooks/useUKRollout.ts` for any market
- `OrganizationLocaleSelector.tsx` shows markets based on flag status

### Quality checks:
- Run `npm run i18n:lint` to scan for hardcoded locale references
- Run `npm run i18n:check` to verify translation completeness
