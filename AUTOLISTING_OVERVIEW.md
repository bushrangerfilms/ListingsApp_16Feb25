# AutoListing.io — Product Overview

> Real estate SaaS for agents and agencies. Automates listing management, lead capture, CRM, and social media content from a single platform.

**Status:** Pilot — 2 active users | **Stage:** Cleanup & stabilisation before next feature phase

---

## What It Does

Agents add a property listing once. AutoListing.io handles the rest:

1. **Listings App** — Publishes the listing to a branded public website, captures buyer leads, manages the CRM pipeline, and sends email sequences
2. **Socials App** — Automatically generates a professional video, writes AI captions, schedules and posts to TikTok, Instagram, Facebook, and YouTube

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   AutoListing.io                    │
│                   (Listings App)                    │
│  CRM · Listings · Public Portal · Billing · Leads  │
└──────────────────────┬──────────────────────────────┘
                       │ webhook (new/updated listing)
                       ▼
┌─────────────────────────────────────────────────────┐
│              Vivid Property Clips                   │
│                  (Socials App)                      │
│  Video Generation · Scheduling · Social Posting    │
└─────────────────────────────────────────────────────┘
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
   ┌─────────────────┐   ┌────────────────────────┐
   │   Supabase      │   │   External APIs        │
   │  (shared DB)    │   │  Shotstack (video)     │
   │  public schema  │   │  Gemini AI (captions)  │
   │  crm schema     │   │  Upload-Post (social)  │
   │  social schema  │   │  Stripe (billing)      │
   └─────────────────┘   │  Resend (email)        │
                         └────────────────────────┘
```

---

## The Two Apps

### Listings App — AutoListing.io
| | |
|---|---|
| **Repo** | github.com/bushrangerfilms/ListingsApp_16Feb25 |
| **Local** | ~/Documents/Claude/Listings |
| **Deployed** | app.autolisting.io (migrating Replit → Vercel) |
| **Type** | React/TypeScript frontend + Supabase edge functions (no Express server) |

**Core features:**
- Listing creation, editing, publishing
- Branded public property portal (custom domain per org)
- Lead capture: enquiries, valuations, property alerts
- CRM: buyer/seller pipeline (Kanban), activity log, email sequences
- Team management and role-based access
- Credit-based billing via Stripe
- AI property descriptions (Gemini)
- Photo management and upscaling (Topaz/Kie.ai)
- Super admin portal (`/internal`) for platform management

**Supabase schemas:** `public` (shared), `crm` (owned)

---

### Socials App — Vivid Property Clips
| | |
|---|---|
| **Repo** | github.com/bushrangerfilms/socialsapp_16Feb25 |
| **Local** | ~/Documents/Claude/Socials |
| **Deployed** | socials.autolisting.io (migrating Replit → Vercel) |
| **Type** | React/TypeScript frontend + Express 5 backend (`server/`) + Supabase edge functions |

**Core features:**
- Automated video generation from listing photos (Shotstack)
- AI-generated social media captions per platform (Gemini)
- Smart scheduling: 3 posts over ~2 weeks per listing
- Multi-platform posting: TikTok, Instagram, Facebook, YouTube (Upload-Post API)
- Video Style 2 / Marketing Demo video formats
- Lead-gen quiz system
- Social account management per organisation
- Workflow monitoring dashboard
- Email notifications (Resend)

**Supabase schemas:** `social` (owned), `public` (shared), `crm` (read-only)

---

## Cross-Repo Impact Rule

> **Every change — code, DB schema, or dependency — must be assessed for impact across ALL THREE systems before work begins:**
> - **Listings repo** (`~/Documents/Claude/Listings`)
> - **Socials repo** (`~/Documents/Claude/Socials`)
> - **Supabase** (shared production DB — `public`, `crm`, `social` schemas)
>
> Examples of knock-on effects to check:
> - Renaming a DB column → update types/validation in BOTH repos, regenerate auto-generated type files
> - Dropping a DB table → confirm zero references in BOTH repos AND no FK dependencies
> - Changing a shared type or API contract → check all consumers in both repos
> - Merging a branch → check for conflicts caused by unmerged branches in the same repo
>
> The Listings and Socials apps share a single Supabase project. A schema change is live the moment it runs — there is no staging rollback. Always audit blast radius across all three systems before acting.

---

## UI Label Convention: Listing Statuses

> The database stores listing status as `Published`. In **all user-facing UI**, this must be displayed as **"For Sale"**. The `Published` value should only appear in backend code, database queries, and internal logic — never shown directly to end users. When displaying listing status in any new UI component, always map `Published` → `For Sale`.

---

## Shared Infrastructure

### Supabase
- **Single production project** (no staging environment yet)
- **Shared `public` schema** — used by both apps: organisations, users, roles, listings, webhook receipts, automation logs
- Auth is shared — one login works across both apps
- ⚠️ Always take a manual backup before schema changes
- ⚠️ Never drop tables or rename columns without confirming impact in BOTH repos

### Deployment: Replit → Vercel Migration (In Progress)

**Current state:** Both apps deployed on Replit with auto-deploy from GitHub `main`. Migrating to Vercel for native GitHub integration, global CDN, automatic SSL, and preview deployments per PR.

**Vercel plan:** Pro (4.5MB serverless body limit, 60s function timeout, unlimited custom domains)

#### How It Works on Vercel

| App | Vercel Deploy Type | Key Difference |
|-----|--------------------|----------------|
| **Listings** | Static site (Vite SPA) | Trivial — no backend, just `vercel.json` + SPA catch-all rewrite |
| **Socials** | Static site + Serverless Function | Express 5 wrapped as single serverless function at `/api` via `@vercel/node` |

**Socials serverless entry point:** `api/index.ts` — same Express app setup (CORS, rate limiting, middleware, all 15 route modules) but does NOT include `setupVite()`, `WorkflowProcessor.start()`, or `process.exit()` on missing env vars.

#### File Upload Refactor (Vercel 4.5MB Body Limit)

Large file uploads (videos up to 100MB) can't go through Vercel serverless functions. Solution: **direct-to-Supabase Storage via signed URLs**.

```
Frontend                          Server                    Supabase Storage
   │                                │                            │
   ├─ POST /api/storage/signed-url ─►│                            │
   │◄─ { signedUrl, path } ─────────┤                            │
   │                                │                            │
   ├─ PUT file ──────────────────────────────────────────────────►│
   │◄─ 200 OK ──────────────────────────────────────────────────┤
   │                                │                            │
   ├─ POST /api/.../register ──────►│ (small JSON metadata)      │
   │◄─ { id, mediaType, ... } ─────┤                            │
```

- Server only handles small JSON requests (signed URL generation + metadata registration)
- Files go directly from browser to Supabase Storage, bypassing Vercel entirely
- Works identically on both Replit and Vercel (backwards-compatible)
- Affected routes: `storage-routes.ts`, `direct-upload-routes.ts` (old multer routes preserved for backwards compat)
- Small uploads (<4.5MB): end cards, quiz images, logos — still use server-side multer (within limit)

#### Migration Branches (Code Complete, Not Yet Merged)

| Repo | Branch | Changes |
|------|--------|---------|
| Listings | `chore/vercel-migration` | `vercel.json`, domain detection cleanup (`.vercel.app` replaces Replit patterns), CORS update for Vercel preview origins |
| Socials | `chore/vercel-migration` | `vercel.json`, `api/index.ts` serverless wrapper, signed upload URL endpoints, `storage-upload.ts` + `media-detect.ts` client utilities, UploadWizard + MusicPage updated to direct upload flow |

#### Zero-Downtime Cutover Plan

1. **Build in parallel** — all work on feature branches, Replit stays live and untouched
2. **Verify on Vercel preview URLs** — every branch push creates a preview deployment
3. **Lower DNS TTL** to 60s, 48 hours before switch
4. **Merge branches to `main`** — Vercel auto-deploys production builds
5. **Flip DNS** — all domains at once (`autolisting.io`, `www`, `app`, `socials`) to Vercel
6. **Rollback plan** — revert DNS records, traffic returns to Replit within 1-2 minutes
7. **Keep Replit running** 48 hours as fallback, then decommission

#### Domains

| Domain | Purpose |
|--------|---------|
| `autolisting.io` | Marketing homepage |
| `www.autolisting.io` | Marketing homepage (redirect) |
| `app.autolisting.io` | Listings admin portal |
| `socials.autolisting.io` | Socials app |
| ~11 custom org domains | Org-specific public portals |

### GitHub Deploy Flow
```
Local (Claude Code) → feature branch → PR → merge to main → GitHub → Vercel auto-deploy
```
Vercel also creates **preview deployments** for every branch push — testable at unique `.vercel.app` URLs.

**Rules — always follow these:**
- Never commit directly to `main`
- Every task = its own branch (`feature/`, `fix/`, `chore/`)
- `main` must always be in a deployable, working state
- Review changes in the GitHub PR before merging — last checkpoint before going live

### Rolling Back to a Previous Version
If something breaks after a merge:
1. Go to the repo on GitHub
2. Open **Pull requests → Closed** → find the PR
3. Click **Revert** — GitHub creates a new PR that undoes the changes
4. Merge the revert PR → Vercel auto-deploys the previous version

Vercel also keeps previous deployments available — you can instantly rollback to any prior deployment from the Vercel dashboard.

Every merged PR is a safe restore point. This is why we always use PRs, never direct pushes to main.

---

## Current Cleanup Status

### ✅ Done
- CLAUDE.md created in both repos (AI context files)
- Project-level permissions added to both repos
- Socials README.md rewritten (was completely wrong — referenced Airtable/Blotato)
- Removed `blotato_post_id` from types and validation schemas
- Renamed `/api/blotato-posts` → `/api/activity-posts`
- Removed `blotato_post_id` legacy field from API responses
- 21 debug scripts moved to `scripts/dev/`
- Fixed Gemini env var inconsistency (`GEMINI_API` is the correct name)
- Removed 4 one-time edge functions from Socials: `backfill-content-jobs`, `backfill-stuck-slots`, `run-has-post-migration`, `resync-incomplete-listings`
- Removed 14 one-time edge functions from Listings: `migrate-airtable-*`, `fix-*`, `run-*-migration`, `add-video-status-column`, `debug-photo-issue`, `check-tables`, `get-listings-schema`, `send-test-webhook`, `send-listing-webhook`
- Removed `generate-recurring-schedules-debug` from Socials (debug scheduler with risky `test_insert` flag)
- Removed `migrate-listing-photos` from Listings (one-time photo migration, now complete)
- Dropped `blotato_posts` table from Supabase (zero code refs, FK → blotato_accounts)
- Dropped `blotato_accounts` table from Supabase (zero code refs; FK constraint from org_social_accounts dropped first)
- Note: `blotato_account_id` column remains in `org_social_accounts` — rename handled in Phase 2

### ⚠️ Requires care (DB changes — backup first)
- Fix `client_id` legacy lookup in `automation-routes.ts` (TODOs at lines 220, 268)
- ~~Rename `blotato_account_id` → `upload_post_account_id`~~ ✅ Done (DB + types.ts + validation.ts)
- Rename `airtable_record_id` column → `crm_record_id` (coordinated migration across both apps)

### 🔭 Future / larger refactor
- Create staging Supabase project for safe schema testing
- Break up monolithic route files (routes.ts is 2,424 lines)
- Structured logging to replace 700+ console.log statements

---

## Known Technical Debt

| Item | App | Risk | Notes |
|------|-----|------|-------|
| `airtable_record_id` column name | Both | Low | Legacy name — it's actually the CRM record ID. Rename when safe. |
| `blotato_account_id` column | Socials | Low | Stores Upload-Post account ID. Rename when safe. |
| Hardcoded Supabase URL fallback | Socials | Medium | `workflow-routes.ts:917` — fix to require env var |
| No staging environment | Both | High | Any schema mistake affects live users |
| Monolithic route files | Socials | Medium | routes.ts 2424 lines, others 1300-2159 lines |
| Legacy `client_id` dual lookup | Socials | Medium | Every workflow query does dual lookup — clean up |

---

## Environment Variables

### Listings App
| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_SOCIALS_HUB_URL` | Link to Socials app |
| `VITE_APP_DOMAIN` | App domain override |

### Socials App
| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (server only) |
| `SHOTSTACK_API_KEY` | Video rendering |
| `GEMINI_API` | AI captions (NOT `GEMINI_API_KEY`) |
| `RESEND_API_KEY` | Email notifications |
| `AUTOMATION_SECRET` | Internal function auth |
| `UPLOAD_POST_API_KEY` | Social media posting |

---

## Roadmap (Post-Cleanup)

*To be defined — add planned features here in priority order*

---

*Last updated: March 2026 | Maintained alongside CLAUDE.md in each repo*
