# AutoListing.io — Comprehensive Logic Summary

## 1. Project Overview

AutoListing.io is a **multi-tenant SaaS property management platform** for real estate professionals (estate agents). It provides listings management, CRM, email automation, AI assistant, billing, and integrates with a companion "Socials" app that shares the same Supabase project.

**Tech Stack:**
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Shadcn/Radix UI
- **Backend:** Supabase (PostgreSQL, Edge Functions, Auth, Storage, Realtime)
- **State:** TanStack Query v5, React Context
- **Routing:** React Router DOM v6
- **Forms:** React Hook Form + Zod validation
- **AI:** Google Gemini 2.5 Flash API
- **Payments:** Stripe (subscriptions + credit packs)
- **Email:** Resend API
- **Image Upscaling:** Kie.ai Topaz API

**Codebase Size:** ~93,000 lines of code (67k frontend, 26k backend with 60+ Supabase Edge Functions)

---

## 2. Architecture & Domain Routing

### Domain Detection (`src/lib/domainDetection.ts`)
The app serves three distinct experiences from the same codebase based on hostname:

| Domain | Type | Routes Component |
|--------|------|-----------------|
| `autolisting.io`, `www.autolisting.io` | `marketing` | `MarketingRoutes` — public marketing/pricing pages |
| `app.autolisting.io`, `localhost`, `*.replit.dev` | `admin` | `AdminRoutes` — full admin portal with auth |
| Any other domain (custom domains) | `org-public` | `OrgPublicRoutes` — public listings for a specific org |

`getDomainType()` runs once at app mount. The result is passed to `AppRoutes` which renders the appropriate route tree.

### Provider Hierarchy (`src/App.tsx`)
```
QueryClientProvider
  └─ LocalePreviewProvider
       └─ AuthProvider
            └─ OrganizationViewProvider
                 └─ OrganizationProvider
                      └─ PublicListingsProvider
                           └─ BrowserRouter
                                └─ AuthAwareRoutes
```

---

## 3. Authentication & Authorization

### Auth Context (`src/contexts/AuthContext.tsx`)
- Uses **Supabase Auth** with email/password
- On auth state change, queries `organization_users` to determine role
- Exposes: `user`, `session`, `isAdmin`, `isSuperAdmin`, `isDeveloper`, `userRole`
- Supports **impersonation** (super admins can impersonate orgs with audit logging)
- Email confirmation is currently **DISABLED** for pilot phase

### Roles
| Role | Access |
|------|--------|
| `super_admin` | Everything including internal portal |
| `developer` | Internal portal (revenue metrics redacted) |
| `admin` | Full org admin access |
| `user` | Basic org access |

### Route Guards
- `ProtectedRoute` — requires `isAdmin` (any authenticated org member)
- `SuperAdminRouteGuard` — requires `isSuperAdmin` or `isDeveloper`
- `SuperAdminOnlyRouteGuard` — requires `isSuperAdmin` only
- `PilotModeRouteGuard` — checks pilot/billing status
- `OrganizationRoute` — resolves org from URL slug or custom domain
- `SignupGate` — controls access to signup pages

---

## 4. Organization & Multi-Tenancy

### Organization Context (`src/contexts/OrganizationContext.tsx`)
- Fetches all orgs the user belongs to via `organization_users` join
- Supports **org switching** via sidebar dropdown (stored in localStorage)
- Single-org users don't see the switcher
- During impersonation, uses the impersonated org instead

### Data Isolation
- All data tables include `organization_id` column
- **Row Level Security (RLS)** enforces tenant isolation at the database level
- Edge Functions use Service Role for privileged operations

### Organization Settings
Each org has region config: `locale`, `currency`, `timezone`, `vat_rate`, `country_code`

---

## 5. Listing Management

### Create Listing Flow
1. **CreateListing page** (`src/pages/CreateListing.tsx`)
   - Form validated by `listingSchema` (Zod) from `src/lib/listingSchema.ts`
   - Supports AI extraction from photos (base64 → `extract-property-details` edge function)
   - Supports AI extraction from pasted text
   - Categories: `Listing` (for sale), `Rental`, `Holiday Rental`, `New Development`
   - Building types: Detached, Semi-Detached, Terrace, Apartment, Land, Commercial, etc.
   - Photo upload with hero photo and social media photo selection

2. **ReviewListing page** (`src/pages/ReviewListing.tsx`)
   - Data passed via `location.state` + `sessionStorage`
   - User can edit all fields before posting
   - `getMissingFields()` validates required fields per category
   - On confirm:
     a. Checks rate limit (`check-rate-limit` edge function)
     b. Processes/uploads photos in batches (`process-images` edge function)
     c. Creates listing (`create-listing` edge function)

### Listing Schema Validation Rules
- **Always required:** Description (20+ chars), County, Building Type
- **Listing (For Sale):** Price (or POA), Bedrooms + Bathrooms (unless Land)
- **Rental:** Price, Bedrooms + Bathrooms (unless Land), Furnishing Status
- **Holiday Rental:** Booking Platform Link
- **Optional for all:** Address Line 1, Town, Eircode, Land Size

### Listing Status Workflow
- Statuses managed via `StatusUpdateDialog`
- Automated cron jobs:
  - `auto-archive-sold-listings` (midnight UTC) — archives sold listings after period
  - `auto-expire-new-status` (1am UTC) — removes "New" badge after expiry
  - `auto-complete-onboarding` (2am UTC) — checks/completes onboarding tasks

### Key Components
- `ListingCard.tsx` — card display with status badges, photo count
- `EditListingDialog.tsx` — inline editing of existing listings
- `EditPhotoManager.tsx` — manage photos on existing listings
- `PropertyDetails.tsx` — public property detail page
- `PublicListings.tsx` — public listings grid with search/filters
- `ListingsDashboard.tsx` — admin listings overview

---

## 6. CRM System

### Data Model (Supabase `crm` schema)
- `crm.seller_profiles` — sellers with stages (New Lead → Valuation Scheduled → Listed → etc.)
- `crm.buyer_profiles` — buyers with stages, interested_properties array, preferences
- `crm.crm_activities` — activity log (calls, emails, notes, stage changes)
- `crm.listings` — a view (`SELECT * FROM public.listings`) for cross-schema access

### Key Pages
- `AdminCRM.tsx` — main CRM page with list/kanban views, filtering by stage and property
- `CreateProfileDialog.tsx` — manual lead creation for buyers/sellers

### Profile Cards
- `BuyerProfileCard.tsx` — shows buyer details, source badge, automation status, interested properties
- `SellerProfileCard.tsx` — shows seller details, property address, automation status
- Both display `ActivityTimeline` and `SequenceControls` for email automation

### Lead Sources
- Manual entry, Property Alert, Property Enquiry, Valuation Request, Lead Magnet
- Source tracked via `source` field with corresponding badge display

### Buyer-Listing Matching
- `match-buyers-to-listing` edge function matches buyers to new listings
- `AdminCRM` filters buyers by `interested_properties` array matching listing IDs

---

## 7. Email Automation

### Components
- **Templates** (`AdminEmailTemplates.tsx`): Reusable HTML email templates with variables
- **Sequences** (`AdminEmailSequences.tsx` + `EmailSequenceBuilder.tsx`): Multi-step campaigns
- **Analytics** (`EmailAnalytics.tsx`): Open/click tracking

### Sequence Structure
```
EmailSequence → has many EmailSequenceSteps
  - profile_type: 'seller' | 'buyer'
  - trigger_stage: e.g., 'valuation_scheduled'
  - Each step: { template_key, delay_hours, step_number }
```

### Processing
- `process-email-sequences` edge function — processes email queue
- `send-email` edge function — sends via Resend API
- `track-email-event` — tracks opens/clicks
- `check-email-replies` — monitors for replies
- `update-email-preferences` — handles unsubscribe tokens

### Queue Tables
- `profile_email_queue` — pending emails for profile sequences
- Links to `email_sequences` and `email_sequence_steps`

---

## 8. AI Assistant

### Configuration
- Powered by **Google Gemini 2.5 Flash** API
- Per-org configuration with custom knowledge base documents
- Training system with banned phrases, tone guidelines, freeform instructions
- Conversation history stored in database

### Edge Functions
- `query-ai-assistant` — main chat endpoint (strips `google/` prefix from model name)
- `train-ai-assistant` — manages training data

### Components (`src/components/ai-assistant/`)
- `ChatTester.tsx` — test conversations
- `KnowledgeBaseUploader.tsx` — upload documents
- `DocumentsList.tsx` — manage knowledge base
- `TrainingConfig.tsx` — configure AI behavior
- `IntegrationConfig.tsx` — embeddable chatbot setup
- `PropertyDataConfig.tsx` — property data access settings

### Public Chatbot
- Embeddable widget via `AIAssistantWidget.tsx`
- Accessible on public listing pages

---

## 9. Credit-Based Billing System

### Account States (`src/lib/billing/types.ts`)
`trial` → `active` → (can become) `payment_failed` → `unsubscribed` → `archived`
Also: `trial_expired`

### Feature Types That Consume Credits
`post_generation`, `video_generation`, `image_enhancement`, `ai_assistant`, `property_extraction`, `email_send`

### Credit Flow (`src/lib/billing/billingClient.ts`)
1. `consumeCredits({ organizationId, featureType, quantity })` — deducts credits
2. Checks if org is exempt (billing_exempt flag from pilot invite codes)
3. Checks sufficient balance
4. Creates `CreditTransaction` and `CreditUsageEvent`
5. Credits stored as `NUMERIC(12,2)` for fractional tracking

### Stripe Integration
- `stripe-checkout` edge function — creates checkout sessions
- `stripe-webhook` edge function — handles Stripe events
- `stripe-portal` edge function — customer portal redirect
- Plans: Starter, Pro with currency-specific Stripe Price IDs
- Credit packs: 100, 500, 2000, 5000

### Billing Pages
- `UpgradeToPro.tsx` — subscription checkout
- `ManageSubscription.tsx` — billing portal, plan management

### Dunning & Lifecycle
- `account-lifecycle` edge function — automated state transitions
- Handles trial expiry, payment failures, grace periods

---

## 10. Internationalization (i18n)

### Status
- Infrastructure built, **feature-flagged OFF** by default
- Supports `en-IE`, `en-GB`, `en-US`

### Implementation (`src/hooks/useLocale.ts`)
- `useLocale()` hook returns `t()` translation function and `currency`
- When i18n disabled: `noopT` fallback derives labels from translation keys
  - Extracts last segment of dot-separated key
  - `SPECIAL_PHRASES` map for custom overrides
  - `formatSegment()` converts camelCase to Title Case
- Translation files in `src/locales/en-IE/`

### Region Config Hooks (`src/hooks/useRegionConfig.ts`)
- `useEnergyRatings()` — BER (IE), EPC (UK)
- `useAddressConfig()` — Eircode (IE), Postcode (UK), ZIP (US)
- `useBuildingTypes()` — region-specific building type names
- `useMeasurementConfig()` — sq m vs sq ft
- `useLandMeasurements()` — acres vs hectares

---

## 11. Super Admin Portal

### Access
- Routes under `/internal/*`
- Guarded by `SuperAdminRouteGuard` / `SuperAdminOnlyRouteGuard`
- Layout: `SuperAdminLayout` with dedicated sidebar

### Pages (`src/pages/internal/`)
| Page | Purpose |
|------|---------|
| `SuperAdminDashboard` | Overview dashboard |
| `OrganizationsPage` | Browse/search/manage orgs |
| `UsersPage` | User directory, password reset |
| `BillingDashboardPage` | Revenue, credit usage metrics |
| `AnalyticsPage` | Platform-wide analytics |
| `FeatureFlagsPage` | Toggle feature flags |
| `PilotSettingsPage` | Manage invite codes |
| `DiscountCodesPage` | Discount code management |
| `AuditLogPage` | System audit trail |
| `AlertsPage` | Alerting system |
| `GdprCompliancePage` | GDPR tools |
| `SupportToolsPage` | Support utilities |
| `AITrainingPage` | Global AI prompt management |
| `ImageUpscalingPage` | Topaz upscaling management |
| `UsageRatesPage` | Credit usage rate configuration |

### Backend
- `internal-admin-api` edge function — server-side authorization for all internal operations
- Role-based data redaction (developers can't see revenue/credit metrics)

---

## 12. Lead Magnet Forms

### Public Quizzes
- **Ready to Sell:** `/lead-magnet/{orgSlug}/ready-to-sell` — weighted scoring quiz
- **Worth Estimate:** `/lead-magnet/{orgSlug}/worth-estimate` — AI-powered valuation

### Flow
1. User takes quiz (no auth required)
2. Results calculated (deterministic scoring or AI market research)
3. Full report gated behind email/consent form
4. On email submit: CRM lead created/upserted, full report unlocked

### Backend
- `lead-magnet-api` edge function
- Tables: `lead_magnets` (per-org config), `lead_submissions` (answers + results), `market_research_cache`
- Auto-provisioned for all orgs via database trigger
- UTM tracking: `utm_source`, `utm_campaign`, `c`, `pid`, `v` params

---

## 13. Webhooks

### Configuration
- Per-org webhook URLs configurable in admin settings
- Events: listing created, updated, status changed, deleted

### Security
- HMAC signing for payload authenticity
- Automatic retry logic with exponential backoff
- Delivery logging

### Edge Functions
- `send-listing-webhook` — sends webhook payloads
- `send-test-webhook` — tests webhook configuration

---

## 14. Photo Management

### Upload Flow
1. Photos selected in `PhotoUploader.tsx`
2. Hero photo and social media photos designated by index
3. On listing submission, `process-images` edge function:
   - Resizes images
   - Uploads to Supabase Storage
   - Returns public URLs

### AI Upscaling (Topaz)
- `upscale-photos` — single listing upscale
- `upscale-org-photos` — batch org-wide upscale
- `topaz-webhook` — callback handler from Kie.ai
- Jobs tracked in `photo_upscale_jobs` table
- Rate limit: 20 requests per 10 seconds

---

## 15. Database Schema

### Schemas
- `public` — shared multi-tenant data (listings, organizations, users, billing)
- `crm` — CRM-specific data (seller_profiles, buyer_profiles, activities)
- `crm.listings` is a **view** of `public.listings`

### Key Tables
| Table | Schema | Purpose |
|-------|--------|---------|
| `organizations` | public | Tenant orgs with region settings |
| `organization_users` | public | User-org membership with roles |
| `listings` | public | Property listings |
| `listing_photos` | public | Photo metadata and URLs |
| `seller_profiles` | crm | Seller CRM profiles |
| `buyer_profiles` | crm | Buyer CRM profiles |
| `crm_activities` | crm | Activity timeline |
| `email_sequences` | public | Email automation sequences |
| `email_sequence_steps` | public | Steps within sequences |
| `email_templates` | public | Reusable email templates |
| `profile_email_queue` | public | Email send queue |
| `ai_assistant_configs` | public | Per-org AI settings |
| `ai_conversations` | public | Chat history |
| `ai_knowledge_documents` | public | Knowledge base files |
| `webhook_configs` | public | Webhook endpoints |
| `webhook_deliveries` | public | Webhook delivery log |
| `billing_profiles` | public | Stripe billing info |
| `credit_ledger` | public | Credit transactions |
| `credit_usage_events` | public | Feature usage tracking |
| `usage_rates` | public | Credit cost per feature |
| `lead_magnets` | public | Per-org lead magnet config |
| `lead_submissions` | public | Quiz answers and results |
| `demo_video_analytics` | public | Video engagement tracking |
| `photo_upscale_jobs` | public | Topaz upscaling jobs |
| `organization_connected_socials` | public | Cross-app social connections |

### Security
- RLS policies on all tables filtered by `organization_id`
- Service Role bypass for edge functions
- IP-based rate limiting on public endpoints

---

## 16. Key File Map

### Entry Points
- `src/App.tsx` — root component, routing, provider tree
- `src/main.tsx` — React DOM render
- `index.html` — HTML shell

### Core Logic
- `src/lib/domainDetection.ts` — hostname → route group mapping
- `src/lib/listingSchema.ts` — Zod schema for listing validation
- `src/lib/billing/` — billing client, types, pricing
- `src/lib/featureFlags.ts` — feature flag system
- `src/lib/appUrls.ts` — URL generation helpers

### Contexts
- `src/contexts/AuthContext.tsx` — auth state, roles, impersonation
- `src/contexts/OrganizationContext.tsx` — current org, org switching
- `src/contexts/OrganizationViewContext.tsx` — super admin org view
- `src/contexts/PublicListingsContext.tsx` — public listings state
- `src/contexts/ContentContext.tsx` — CMS content

### Hooks
- `src/hooks/useLocale.ts` — i18n, currency, translation
- `src/hooks/useRegionConfig.ts` — region-specific config
- `src/hooks/useCreditCheck.ts` — credit balance checks
- `src/hooks/useFeatureFlag.ts` — feature flag queries
- `src/hooks/useOnboarding.ts` — onboarding checklist
- `src/hooks/useOnboardingAutoDetect.ts` — auto-detect completed tasks
- `src/hooks/usePropertyServices.ts` — enabled property categories
- `src/hooks/usePlanInfo.ts` — billing plan details

### Admin Pages (`src/pages/`)
- `AdminCRM.tsx` — CRM management
- `AdminEmailSequences.tsx` — email sequence list
- `AdminEmailTemplates.tsx` — email template editor
- `AdminAIAssistant.tsx` — AI assistant configuration
- `AdminAnalytics.tsx` / `AdminUnifiedAnalytics.tsx` — analytics dashboards
- `AdminBilling.tsx` — billing overview
- `AdminSettings.tsx` — org settings
- `AdminBranding.tsx` — branding/logo
- `AdminWebsiteSettings.tsx` — custom domain, public site config
- `ListingsDashboard.tsx` — listings overview
- `CreateListing.tsx` — new listing form
- `ReviewListing.tsx` — listing review before posting

### Public Pages
- `PublicListings.tsx` — public property search
- `PropertyDetails.tsx` — single property view
- `ValuationRequest.tsx` — valuation request form
- `LeadMagnetQuiz.tsx` — lead capture quizzes

### Edge Functions (`supabase/functions/`)
See Section 17 below for complete list.

---

## 17. Edge Functions Reference

### Listings
| Function | Purpose |
|----------|---------|
| `create-listing` | Create new listing (validates org membership) |
| `get-listings` | Fetch org listings |
| `get-public-listings` | Fetch public listings for a slug |
| `update-listing-details` | Update listing fields |
| `update-listing-status` | Change listing status |
| `delete-listing` | Soft/hard delete |
| `toggle-archive` | Archive/unarchive |
| `extract-property-details` | AI extraction from image/text |
| `enhance-listing-copy` | AI description enhancement |
| `process-images` | Resize and upload photos |
| `upload-hero-photo` | Upload hero image |

### CRM
| Function | Purpose |
|----------|---------|
| `match-buyers-to-listing` | Auto-match buyers to new listings |
| `submit-property-alert` | Public property alert signup |
| `submit-property-enquiry` | Public property enquiry |
| `submit-valuation-request` | Public valuation request |
| `manage-profile-sequence` | Attach/manage email sequences |

### Email
| Function | Purpose |
|----------|---------|
| `send-email` | Send via Resend API |
| `process-email-sequences` | Process email queue |
| `track-email-event` | Track opens/clicks |
| `check-email-replies` | Monitor replies |
| `update-email-preferences` | Unsubscribe management |

### AI
| Function | Purpose |
|----------|---------|
| `query-ai-assistant` | Chat with AI (Gemini) |
| `train-ai-assistant` | Manage training data |

### Billing
| Function | Purpose |
|----------|---------|
| `stripe-checkout` | Create Stripe checkout session |
| `stripe-webhook` | Handle Stripe events |
| `account-lifecycle` | Automated billing state management |

### Auth & Org Management
| Function | Purpose |
|----------|---------|
| `create-organization` | New org creation |
| `create-org-user` | Add user to org |
| `remove-org-user` | Remove user from org |
| `list-org-users` | List org members |
| `accept-invitation` | Accept team invite |
| `send-invitation` | Send team invite |
| `admin-reset-password` | Super admin password reset |

### Lead Magnets
| Function | Purpose |
|----------|---------|
| `lead-magnet-api` | Quiz submission, scoring, CRM integration |

### Image Upscaling
| Function | Purpose |
|----------|---------|
| `upscale-photos` | Single listing upscale |
| `upscale-org-photos` | Batch org upscale |
| `topaz-webhook` | Kie.ai callback handler |

### Cron Jobs
| Function | Schedule |
|----------|----------|
| `auto-archive-sold-listings` | Midnight UTC |
| `auto-expire-new-status` | 1am UTC |

### Internal Admin
| Function | Purpose |
|----------|---------|
| `internal-admin-api` | All super admin operations |
| `request-pilot-access` | Pilot access requests |

### Webhooks
| Function | Purpose |
|----------|---------|
| `send-listing-webhook` | Send webhook payloads |
| `send-test-webhook` | Test webhook config |

### Analytics
| Function | Purpose |
|----------|---------|
| `track-video-event` | Demo video engagement |

### Utilities
| Function | Purpose |
|----------|---------|
| `check-rate-limit` | IP-based rate limiting |
| `send-feedback` | User feedback submission |
| `get-marketing-content` | CMS content |
| `get-testimonials` | Testimonials |
| `notify-agent` | Agent notifications |

---

## 18. Environment Variables

### Supabase
- `VITE_SUPABASE_URL` — Supabase project URL (frontend)
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon key (frontend)
- `SUPABASE_ACCESS_TOKEN` — Service role token
- `DATABASE_URL` — PostgreSQL connection string

### APIs
- `GOOGLE_AI_API_KEY` — Gemini API key
- `STRIPE_SECRET_KEY` — Stripe secret key

### Notes
- Frontend env vars must be prefixed with `VITE_`
- Access via `import.meta.env.VITE_*` on frontend
- Edge functions access secrets via `Deno.env.get()`

---

## 19. Cross-App Integration

The CRM app and Socials app share the same Supabase project:
- `organization_connected_socials` table stores social platform connections
- Credits are shared across both apps via the same ledger
- `sourceApp` parameter in `consumeCredits()` tracks which app consumed credits
- Photo upscaling in CRM feeds into video generation in Socials

---

## 20. Important Conventions

### Supabase Client
- Frontend: `src/integrations/supabase/client.ts`
- Some tables not in TypeScript types — accessed via `(supabase as any).from('table_name')`
- CRM tables use `crm` schema

### Translation Keys
- Components use `t('key.path')` from `useLocale()`
- When i18n is OFF, `noopT` derives display text from the key's last segment
- `SPECIAL_PHRASES` in `useLocale.ts` override specific keys

### Form Validation
- Schemas defined in `src/lib/listingSchema.ts`
- Uses `.refine()` for cross-field validation (category-specific rules)
- Refine errors placed on `category` path, then `clearErrors('category')` to avoid false UI errors
- Toast shows field names from manual checks, not raw Zod messages

### Photo Handling
- Photos stored in Supabase Storage
- `heroPhotoIndex` designates the main listing photo
- `socialMediaPhotoIndices` designates photos for social media posts
- `process-images` edge function handles resizing before storage

### Organization Onboarding
- `useOnboarding.ts` — checklist state management
- `useOnboardingAutoDetect.ts` — auto-detects completed tasks across CRM and Socials
- Tasks: Add listing, Set up branding, Configure AI, Connect socials, etc.
