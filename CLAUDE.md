# CLAUDE.md — Listings App (AutoListing.io)

## Purpose
Real estate SaaS platform for agents and agencies. Handles listing ingestion, CRM, public-facing property websites, lead capture forms, billing, and team management.

## Status
- Pilot phase — 2 active users on production
- Shared Supabase project with the Socials app (single production instance — no staging)
- Deployed on Replit; GitHub is the source of truth for code
- App domain: `app.autolisting.io`

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
| `app.autolisting.io`, `localhost`, `*.replit.dev` | `admin` | Full admin portal |
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

- Credit-based usage model backed by Stripe
- `src/lib/billing/billingClient.ts` — `consumeCredit()`, `checkCreditBalance()`
- Feature usage checked via `useCreditCheck` hook before AI/premium actions
- Stripe webhooks handled by `stripe-webhook` Edge Function
- Billing-exempt orgs configured via `VITE_BILLING_EXEMPT_ORG_IDS` env var

## Known Technical Debt

- `src/pages/signup/OrganizationSignup.tsx` — legacy signup flow kept at `/signup/legacy`
- `supabase/types.ts` still references `blotato_*` and `airtable_*` tables — these are legacy schema remnants
- 90+ migration files — historical, many superseded by later migrations
- No test files — project relies on manual/E2E testing

## Git Workflow

- `main` — always deployable, synced to Replit. **Never commit directly to main.**
- Every task gets its own branch: `feature/description`, `fix/description`, `chore/description`
- Push branch → open PR on GitHub → review → merge to main → Replit auto-deploys
- **To roll back:** Go to GitHub → Pull requests → Closed → find the PR → click Revert → merge the revert PR. Every merged PR is a restore point.

## Coding Conventions

- TypeScript throughout — use `src/integrations/supabase/types.ts` for all DB types
- Never edit `types.ts` manually — regenerate via Supabase CLI: `supabase gen types typescript`
- Use `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key) on client — never service role key
- RLS handles data isolation — don't add manual org filtering as a substitute
- Respect domain routing — don't add admin UI components to marketing/public routes
