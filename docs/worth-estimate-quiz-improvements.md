# Worth Estimate Quiz — Improvement Backlog

Living doc for follow-up work on the `WORTH_ESTIMATE` lead magnet quiz. Work is tackled one issue at a time in logical order — each issue gets its own planning session and PR when we pick it up.

**Status legend:** 🔴 not started · 🟡 in progress · 🟢 shipped · ⚪ out of scope

---

## Already shipped (2026-04-14)

- 🟢 **Custom-domain URL verification gating** — Gate lead magnet URLs on `custom_domain_status = 'verified'` across Socials and Listings. Socials PR #175, Listings PR #153. Also backfilled cleanup migration that cleared 16 legacy junk domains.
- 🟢 **`market_trend` CHECK-constraint crash** — `lead_submissions` INSERT was failing because `getDefaultMarketResearch` returned `trend: "stable"` (lowercase) vs the CHECK constraint's title-case enum. Normalised at the insert site. Listings PR #156.
- 🟢 **Gemini → Claude for market research** — Gemini 2.5 Flash was returning truncated JSON; switched to Claude Opus 4.6 with tool use + `strict: true` for guaranteed structured output. Listings PR #157.
- 🟢 **30-day orphan purge + anonymized daily activity digest** — `purge_orphaned_lead_submissions()` cron at 03:00 UTC; `lead-magnet-activity-digest` edge function at 08:00 UTC. Listings PR #158.
- 🟢 **Issue 1 — Eircode-drives-location + live map + AI resolution.** Listings PR #159. Claude Opus 4.6 resolves the Eircode inline via 4 new tool output fields (`resolved_town`, `resolved_county`, `resolution_confidence`, `resolution_failed`). `areaKey` cache is now `IE:{routing_key}` — no more Townland-typo poisoning. Live Google Maps iframe preview in the form (free embed, no API key, same pattern as `PropertyDetails.tsx:552`). "I don't have my Eircode" fallback discloses Town + County. Gated results card shows "Based on your Eircode, we found your property near X" trust moment before the email gate. New columns `resolved_town`, `resolved_county`, `resolution_confidence` on `lead_submissions`. Verified in prod with rural + urban + cache hit + fallback + conflict tests (user types Dublin but eircode is Galway → Claude correctly ignores typed town).

---

## Open issues (prioritized)

### 🟢 1. Eircode should drive location, not Townland — **SHIPPED (PR #159)**

Previously blocked: the entire accuracy of the quiz. Now fixed. See "Already shipped" above for details. Leave this section here for history; implementation details below are frozen as the as-shipped state.

---

### 🟡 2. Comparable properties not rendering — **IN PROGRESS on `feat/crm-quiz-details-and-new-contact-badge`**

**Root cause confirmed.** Frontend-only. `FullResult.comparable_sales` type at [LeadMagnetQuiz.tsx:53-68](../src/pages/lead-magnet/LeadMagnetQuiz.tsx#L53-L68) declares `Array<{address, price, bedrooms}>`, but the Claude tool schema at [lead-magnet-api/index.ts:1140-1156](../supabase/functions/lead-magnet-api/index.ts#L1140-L1156) returns `Array<{description, sale_price, approx_sqm, price_per_sqm, distance_km}>`. JSX at [LeadMagnetQuiz.tsx:1327-1354](../src/pages/lead-magnet/LeadMagnetQuiz.tsx#L1327-L1354) reads `sale.address` / `sale.price` / `sale.bedrooms` — all undefined. The literal "bed" on every row is `{bedrooms} bed` rendering with `bedrooms = undefined`. Data in DB is correct; frontend is the only thing wrong.

**Fix plan (agreed):**
1. Update `FullResult.comparable_sales` type to match Claude's shape
2. Rewrite the JSX to render description + sale_price badge + (sqm / price_per_sqm / distance_km) metrics row
3. Use existing `useLocale()` `locale` + `currency` in scope; no new imports
4. No PDF change needed (comparable_sales not in the PDF block)

**Bundled with:** Issue 4 Part A (CRM quiz details) and the new-contact notification feature (sidebar badge + NEW pills) — same PR because all three are frontend-only and touch related CRM / lead-magnet code paths.

---

### 🟡 1. Eircode-drives-location details (frozen as-shipped state)

**Problem.** The form asks for Eircode (optional), Townland (required), County dropdown (required, 10 hardcoded Irish options + "Other"). The backend **completely ignores Eircode** — `calculateWorthEstimate` at `supabase/functions/lead-magnet-api/index.ts:726` builds `areaKey` from `{town}_{county}` (the free-text Townland), and the Claude prompt at line 1109 interpolates the Townland as the location. So if a user enters eircode `H53 YA97` with Townland "Ballinasloe", the estimate is anchored on Ballinasloe town — but the property may be 25 minutes away. Claude's market research is anchored to the wrong market, and `market_research_cache` gets poisoned by Townland typos.

Current state audited — **no existing geocoding integration anywhere in the repo**, but [`PropertyDetails.tsx:552`](Listings/src/pages/PropertyDetails.tsx#L552) already uses the free Google Maps iframe embed (`https://maps.google.com/maps?q=${eircode}&output=embed`) for the public property detail page. Zero API key, zero cost, works internationally.

### Architecture

**No new external APIs, no new secrets, no paid geocoding.** We reuse two things we already have:

1. **Free Google Maps iframe embed** for the visual map preview (matches `PropertyDetails.tsx:552` exactly).
2. **Claude Opus 4.6** (already integrated for market research) does the eircode → `{town, county}` resolution inline, as an extra output field in the existing `report_market_research` tool call. Claude's training data includes Irish eircodes; Opus 4.6 handles this reliably for all but the most obscure rural codes, where we gracefully fall back.

### Files

**New:**
- `supabase/migrations/20260414160000_eircode_drives_location.sql` — adds `resolved_town`, `resolved_county`, `resolution_confidence` columns to `lead_submissions`
- `src/lib/regionConfig/postcodes.ts` — locale-aware postcode config (Ireland config today, structured so UK/US/CA/AU/NZ drop in later for Issue #6)

**Edited:**
- `src/pages/lead-magnet/LeadMagnetQuiz.tsx` — Step 1 form restructure, map iframe, validation
- `supabase/functions/lead-magnet-api/index.ts` — tool schema extension, prompt rewrite, areaKey logic, insert path

### Frontend changes — `LeadMagnetQuiz.tsx`

Step 1 (Property Location) becomes:

```
Eircode *
[ H53 YA97                      ]
Your Eircode pinpoints your exact location for a more
accurate estimate than a town name alone.

[ map iframe preview — renders when eircode format-valid ]

I don't have my Eircode → reveals fallback:
  Town or area
  [ e.g., Ballinasloe             ]
  County  [ dropdown ▾              ]
```

**Field rules:**
- **Eircode:** required by default, text input, client-side regex validation (Irish format: `/^[AC-FHKNPRTV-Y]\d{2}\s?[0-9AC-FHKNPRTV-Y]{4}$/i`). Labels / placeholders / regex come from `postcodes.ts` per org locale (Ireland today).
- **Map preview:** `<iframe src="https://maps.google.com/maps?q={encodedEircode}&output=embed" />`, renders only when the eircode field is a valid format. 200px tall, rounded, `loading="lazy"`. Reuses exact pattern from `PropertyDetails.tsx:552`.
- **"I don't have my Eircode" link:** collapsible disclosure that reveals the existing `town` + `county` fields. When the fallback is open, eircode becomes optional and `town` + `county` become required. One of the two must be present to proceed.
- **County dropdown (in fallback only):** keep the existing 10-option Irish list for now. It's only used when the user can't provide an eircode, which is the minority case. Issue #6 will fully locale-ize it.
- **Validation:** `canProceed()` for Step 1 = `(validEircode) || (town && county)`. Format error on eircode shows inline: "Please enter a valid Eircode (e.g., H53 YA97), or use the fallback below."

### Backend changes — `lead-magnet-api/index.ts`

**1. Tool schema extension** — add four fields to `MARKET_RESEARCH_TOOL.input_schema.properties` (and `required`):

```ts
resolved_town: {
  type: "string",
  description: "The town/settlement you determined the postcode resolves to. If the user provided a town fallback instead of a postcode, echo that back.",
},
resolved_county: {
  type: "string",
  description: "The county/state/administrative region for the resolved area.",
},
resolution_confidence: {
  type: "string",
  enum: ["high", "medium", "low"],
  description: "high = you recognize the exact postcode, medium = you can infer the general area, low = best-guess from partial knowledge",
},
resolution_failed: {
  type: "boolean",
  description: "Set true only if you cannot resolve the postcode to an area at all. When true, market data fields may still be populated from the user's fallback town/county.",
},
```

**2. Prompt rewrite** — `performAIMarketResearch` builds a prompt that leads with the eircode when present:

```
You are a property valuation expert in Ireland.

Research current market data for a property at:
- Eircode: {eircode}
- Property type: {propertyTypeLabel}
- Bedrooms: {bedrooms}
- Approximate age: {propertyAge}
- Land size: {landSize}

Task 1: Resolve the Eircode to an actual location.
  • Return the exact town or nearest settlement in `resolved_town`.
  • Return the county in `resolved_county`.
  • Set `resolution_confidence` to "high" if you recognize the exact Eircode routing key and identify a specific area, "medium" if only the general area, "low" if guessing.
  • If you cannot resolve the Eircode at all, set `resolution_failed: true` and use "Unknown" for `resolved_town` / `resolved_county`.

Task 2: Research current market comparables for the resolved area (last 6-12 months in nearby comparable areas). Price per sqm, volatility, trend, comparables array, market insights.

Call the `report_market_research` tool exactly once with your complete findings.
```

When no eircode (fallback mode), the prompt uses the user's town/county directly and instructs Claude to echo them back as `resolved_town` / `resolved_county` with `resolution_confidence: "low"`.

**3. `calculateWorthEstimate` areaKey rewrite** — the cache key is now built from Claude's resolution, not the user input:

```ts
// Before Claude: provisional areaKey from eircode prefix for cache lookup
// Irish eircode routing key = first 3 chars (e.g., "H53" for the Ballinasloe area)
const provisionalAreaKey = answers.eircode
  ? `IE:${normalizeEircode(answers.eircode).slice(0, 3)}`
  : `IE:${(answers.town || '').toLowerCase().replace(/\s+/g, '_')}_${(answers.county || '').toLowerCase()}`;

// Check cache first using the provisional key
let research = await getCachedResearch(supabase, provisionalAreaKey, propertyType);

if (!research) {
  // Cache miss — call Claude, which both resolves the eircode AND does the research
  research = await performAIMarketResearch(supabase, provisionalAreaKey, propertyType, answers);
  // Claude's response includes resolved_town / resolved_county — the cache is already written
  // under provisionalAreaKey inside performAIMarketResearch
}
```

The cache key stays stable across users in the same area because the **eircode routing key is the same for everyone in that area** — no more typo-poisoning.

**4. Results flow** — `result` returned from `calculateWorthEstimate` now includes the resolved fields, which get persisted to the new columns on insert:

```ts
return {
  refused: false,
  estimate_low,
  estimate_high,
  confidence,
  drivers_json: drivers,
  market_trend: normalizeMarketTrend(research.trend),
  market_insights: research.market_insights || null,
  comparable_sales: research.comparable_sales || null,
  research_source: researchSource,
  research_snapshot_id: research.id || null,
  valuation_model_version: "v1",
  resolved_town: research.resolved_town,                     // NEW
  resolved_county: research.resolved_county,                  // NEW
  resolution_confidence: research.resolution_confidence,      // NEW
};
```

The `handleSubmit` insert already uses `...dbFields` spread, so these land in the new columns automatically once the migration is applied.

**5. Results page trust moment** — the gated result display gets a small confirmation line: *"Based on your Eircode, we found your property near **{resolved_town}, Co. {resolved_county}**."* If `resolution_confidence = 'low'` or `resolution_failed = true`, softer copy: *"We couldn't verify the exact area — estimate is based on {resolved_town}, Co. {resolved_county} as a best guess."*

### Migration SQL

```sql
-- Capture Claude's eircode resolution alongside the valuation.
-- `resolved_town` / `resolved_county` are the authoritative area the estimate
-- is anchored to; they may differ from the user-typed town when eircode
-- resolution kicks in.

ALTER TABLE public.lead_submissions
  ADD COLUMN IF NOT EXISTS resolved_town text,
  ADD COLUMN IF NOT EXISTS resolved_county text,
  ADD COLUMN IF NOT EXISTS resolution_confidence text
    CHECK (resolution_confidence IS NULL
           OR resolution_confidence IN ('high', 'medium', 'low'));

COMMENT ON COLUMN public.lead_submissions.resolved_town IS
  'Town the AI resolved from the user''s eircode (or echoed from user-typed '
  'town when no eircode provided). This — not answers_json.town — is the '
  'authoritative location the estimate is anchored on.';
```

### Locale config stub — `src/lib/regionConfig/postcodes.ts`

```ts
export interface PostcodeConfig {
  label: string;          // "Eircode"
  placeholder: string;    // "e.g., H53 YA97"
  regex: RegExp;
  helperText: string;
  helperLink: string;     // "I don't have my Eircode"
  countryName: string;    // "Ireland"
  routingKeyLength: number; // first N chars = cache key
}

export const POSTCODE_CONFIGS: Record<string, PostcodeConfig> = {
  IE: {
    label: "Eircode",
    placeholder: "e.g., H53 YA97",
    regex: /^[AC-FHKNPRTV-Y]\d{2}\s?[0-9AC-FHKNPRTV-Y]{4}$/i,
    helperText: "Your Eircode pinpoints your exact location for a more accurate estimate.",
    helperLink: "I don't have my Eircode",
    countryName: "Ireland",
    routingKeyLength: 3,
  },
  // GB, US, CA, AU, NZ configs added when Issue #6 lands
};

export function getPostcodeConfig(countryCode: string): PostcodeConfig {
  return POSTCODE_CONFIGS[countryCode.toUpperCase()] || POSTCODE_CONFIGS.IE;
}

export function normalizeEircode(input: string): string {
  return input.toUpperCase().replace(/\s+/g, "");
}
```

### Verification

1. **Happy path, rural eircode.** Submit with `H53 YA97` only (no town). Expect: map iframe shows correct location, Claude returns `resolved_town` = "Ballinasloe" (or similar) with `resolution_confidence: "medium"` or `"high"`, results page shows "Based on your Eircode, we found your property near Ballinasloe, Co. Galway."
2. **Happy path, Dublin 2.** Submit with `D02 XY45`. Expect: Claude resolves to Dublin 2 (Georgian district), estimate reflects D2 premium (~€6–8k/sqm), comparables are D2 properties.
3. **Fallback path.** Open "I don't have my Eircode", enter "Cork", county "Cork", submit. Expect: runs with town/county input, `resolution_confidence: "low"`, estimate returns.
4. **Garbage eircode.** Submit with `XXXXX`. Expect: client-side regex error, user prompted to fix or use fallback. Never reaches backend.
5. **Unresolvable rare eircode.** Submit with a legitimate-format but very rural eircode that Claude doesn't know. Expect: `resolution_failed: true`, softer copy on results page, estimate still returns (using Claude's best-guess area).
6. **Cache hit.** Submit two quizzes with eircodes in the same routing key (e.g., `H53 YA97` and `H53 AB12`). Expect: second submission uses cached research under key `IE:H53`, no new Claude call.
7. **Cache isolation by property type.** Submit semi-detached vs apartment in same area. Expect: two separate cache entries.
8. **Existing 25 completed submissions unaffected.** `resolved_town` / `resolved_county` NULL for old rows. New rows get populated.
9. **Map iframe renders correctly.** Inspect Step 1 with a valid eircode — confirm map loads, pin matches location.
10. **Legal compliance check.** Eircode is now stored in `lead_submissions.answers_json.eircode` AND flows through Claude. Confirm no new PII leakage — map iframe goes to Google but that's the existing property-detail page pattern, already covered by privacy policy.

---

*(Issue 2 moved up — now in progress. See status above.)*

---

### 🟢 3. Unlock modal reframing — **SHIPPED**

The gated results page and unlock modal were reframed as a consent signature, not a paywall:
- Dropped the blurred preview card (`GatedResultPreview`) entirely — no more blurred estimate, no more `🔒 … ready to unlock` copy.
- Replaced the gated results page with a plain "Your full report is ready. Add your details below to view it." card + a `View my report` button. For `WORTH_ESTIMATE`, the Eircode trust moment (`Based on your Eircode, we found your property near …`) is preserved at the top of the card.
- Modal has no visible headline — uses an `sr-only` `DialogTitle` / `DialogDescription` to satisfy Radix a11y. Submit button is `View my report`, no lock icon.
- Name is now required (asterisk + `required` attr + validation in `handleUnlock` + disabled state on the submit button).
- Field order unchanged: Name → Email → Phone. Consent checkbox copy unchanged.
- `GatedResultPreview` component removed entirely along with `Lock` / `Unlock` imports.
- PDF is still generated in-app on the next screen — no "we'll email your report" framing.

---

### 🟡 4. CRM: surface full quiz details + fire real-time agent notification — **PART A IN PROGRESS**

**Part A: Quiz details in CRM profile view — IN PROGRESS on `feat/crm-quiz-details-and-new-contact-badge`.**
Bundled with Issue 2 in one PR. Plan agreed:
- Widen `fetchLeadSubmission` query in [`SellerProfileCard.tsx:74`](../src/components/SellerProfileCard.tsx#L74) to include `answers_json`, `resolved_town`, `resolved_county`, `resolution_confidence`
- New inline `QuizResponsesSection` component below the existing Lead Source block
- Hardcoded `QUIZ_FIELD_LABELS` map (mirrors `worthEstimateSteps` labels); TODO to lift to shared locale config with Issue #6
- Hardcoded `QUIZ_FIELD_ORDER` array so agents see grouped fields (location first, then property details, then extras)
- Empty/missing fields are skipped
- Select values render as raw codes for now (`"semi"`, `"needs_work"`); pretty labels come with Issue #6
- AI-resolved location card shown at top of section with confidence badge

**Also bundled: new-contact notification ("number notification just like post awaiting approval") — user-requested addition.** Three sub-pieces:
1. **New hook `useNewSellersCount.ts`** — React Query + Supabase `postgres_changes` realtime subscription, backed by `localStorage['crm_last_ack_{orgId}']`. Returns the count of `seller_profiles` created after the last ack timestamp. Default fallback is `now() - 30 days` to avoid flooding new users.
2. **Sidebar badge on CRM nav item** in [`AppSidebar.tsx:60`](../src/components/AppSidebar.tsx#L60). New `CrmNavItem` component calls the hook and renders an inline red count pill when `count > 0`. Styling mirrors the `PlatformHeader.tsx:206-344` bell badge pattern.
3. **NEW pill on seller cards.** `SellerProfileCard` gets an `isNew` prop; `AdminCRM.tsx` captures the pre-mount ack timestamp in `useState(() => getCrmLastAck(orgId))`, then immediately bumps the localStorage ack forward in a `useEffect`. This way: landing on the CRM clears the sidebar badge, but NEW pills stay visible during the current visit (they use the pre-mount snapshot). Also adds a realtime subscription on AdminCRM that auto-prepends new sellers to the list while the user is on the page.

Scope: covers **all new seller_profiles** regardless of source (lead_magnet, manual, converted enquiry). Buyers not covered (separate table, separate nav tab — same pattern applies later if wanted).

**Part B: Real-time agent notification email — 🟢 SHIPPED (PRs #162–#163, 2026-04-15).** Bundled email flow now fires reliably with rich context:
- 60s `waitUntil` bundling so a single email is sent if the lead completes the form AND clicks "contact agent" within the window
- Header pills: `✓ Completed form` and `📞 Requested contact`
- Google Maps link card embedded in the email
- Lead name surfaced in subject + header
- DB columns added: `contact_requested_at`, `contact_additional_info`
- Renames: `unlock` → `form completed`, `contact-agent` → `contact-request`
- Eircode demoted from required → recommended-but-optional, with Address / Town / County visible by default

---

### 🟢 5. PDF report: server-side render + branding — **SHIPPED (Socials PR #182, Listings PRs #168, #169, and brand-colour PR — 2026-04-15)**

**What shipped.** PDF generation is now server-side via a Puppeteer endpoint on the Socials Express server (`POST /api/lead-magnet-pdf` in `server/routes/lead-magnet-routes.ts`, render logic in `server/services/lead-magnet-pdf-service.ts`). The endpoint returns the PDF with `Content-Disposition: attachment` so Firefox no longer auto-opens the downloaded file in its built-in PDF.js viewer (the original Issue 1 bug from `lead-magnet-outstanding-issues.md`).

The renderer is system Chromium (apt-installed in the Socials Dockerfile, `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`) plus an HTML template using Google Fonts (Inter + Playfair Display), fixed A4 height, no shadows, `-webkit-print-color-adjust: exact` — same patterns as the Shearfest Sponsors Prospectus stack the user has used before.

**Branding now applied:**
- Org logo at the top (from `organizations.logo_url`), with a coloured-initials fallback when missing
- Org `primary_color` and `secondary_color` are fetched server-side via the slug and threaded through CSS custom properties — used for the brand bar, header rule, stat-card backgrounds, section title underlines, todo numbering bullets, comp-table headers, and footer accent. Hex validated; falls back to slate (`#0f172a` / `#475569`) when missing or malformed.
- Sections: branded header with org name + report title, stat cards (Score+Band for READY_TO_SELL or Estimated Value for WORTH_ESTIMATE), Key Areas to Address, Action Plan with numbered bullets, Value Drivers, Market Insights, Comparable Sales, Recommended Next Steps, footer with org contact + AutoListing.io tagline.
- Frontend now sends only `{type, orgSlug, result, locale, generatedAt}` — no client-supplied org branding (server fetches authoritatively from the database).

**Reference PRs:**
- Socials PR #182 — initial server-side endpoint + Puppeteer setup
- Listings PR #168 — frontend swap from jsPDF to fetch
- Listings PR #169 — hotfix restoring jspdf as a dep (transitive `pako` resolution trap; see `memory/lead-magnet-pdf-architecture.md`)
- Socials + Listings brand-colour polish PRs — fetch org from DB, thread brand colours through template

**Still open under this issue:** none. Future polish ideas (cover page, comparable-sales map thumbnails, multi-page templates) can become follow-up issues if/when needed.

---

### 🔴 6. International locale readiness

**Problem.** The Worth Estimate quiz is built around Irish conventions:
- Currency hardcoded to €
- "Eircode" label hardcoded (UK = postcode, US = ZIP, etc.)
- "County" label hardcoded (US = state, UK = borough/city, AU = state)
- Valuation prompt hardcoded to "Ireland" context
- Default market research numbers are EUR/sqm, Irish-centric
- `formatNumber` / currency formatting hardcoded

**Fix sketch.** Leverage the existing 6-market locale infrastructure (`src/lib/regionConfig/`, `src/lib/locale/legalConfig.ts`, `useLocale` hook, edge-side `_shared/locale-config.ts`). Key tasks:
- Label strings (Eircode/Postcode/ZIP, County/State/Borough) driven by org locale
- Currency symbol + formatting driven by org currency
- Claude market research prompt includes `{country}` + `{currency}` as locale params
- Default fallback market research tables per locale (not hardcoded Irish semi-detached numbers)
- `area_key` normalization must not assume Irish postcode format
- PDF + email templates localised

**Files likely touched.** `src/pages/lead-magnet/LeadMagnetQuiz.tsx`, `supabase/functions/lead-magnet-api/index.ts` (prompt + defaults + `calculateWorthEstimate`), the relevant region config files.

**Open questions.**
- Launch markets for Worth Estimate: does this need to work for all 6 markets day 1, or gated per `{country}_launch` feature flag?
- Default market research tables for UK / US / CA / AU / NZ — can Claude populate these on first use (per-area cache), or do we seed defaults?

---

## Suggested order of attack (updated)

**Round 1 — UX correctness:**
1. 🟢 **Issue 1 (Eircode-drives-location)** — shipped PR #159
2. 🟢 **Issue 2 (Comparable properties rendering)** — shipped PR #160
3. 🟢 **Issue 3 (Unlock modal reframing)** — SHIPPED

**Round 2 — Agent experience:**
4. 🟡 **Issue 4 Part A (CRM quiz details)** — IN PROGRESS
   🟢 **Issue 4 Part B (real-time agent notification email)** — SHIPPED via PRs #162–#163 (bundled email + pills + map + rename)
5. 🟢 **Issue 5 (PDF branding + server-side render)** — SHIPPED via Socials PR #182 + Listings PRs #168, #169, and brand-colour follow-up

**Round 3 — Market expansion:**
6. 🔴 **Issue 6 (International locale)** — blocker for UK/US/CA/AU/NZ; not blocking Irish pilot

## In-flight work snapshot (for context resumption)

**Current branch:** `feat/crm-quiz-details-and-new-contact-badge` (Listings repo, branched from `b971b83` which is PR #159 merged).

**Goal of this PR:** ship Issue 2 fix + Issue 4 Part A (CRM quiz details) + new Part C (sidebar CRM badge for new contacts + NEW pills on new cards).

**Plan file:** `/Users/bushrangerfilms/.claude/plans/parallel-watching-salamander.md` (fully fleshed out, user-approved).

**Task list to resume from:**
1. ✅ Fresh branch created
2. 🟡 Part A: Fix `FullResult.comparable_sales` type (LeadMagnetQuiz.tsx:53-68) + rewrite JSX (lines 1327-1354) with description / sale_price badge / sqm / price-per-sqm / distance metrics row
3. 🟡 Part B: Widen `fetchLeadSubmission` query in SellerProfileCard.tsx (line 74) + add `QuizResponsesSection` subcomponent inline + hardcoded QUIZ_FIELD_LABELS / QUIZ_FIELD_ORDER
4. 🟡 Part C: new hooks `src/hooks/useNewSellersCount.ts` + helpers `getCrmLastAck(orgId)` / `setCrmLastAck(orgId)`
5. 🟡 Part C: `CrmNavItem` component in AppSidebar.tsx calling `useNewSellersCount()` and rendering red count pill
6. 🟡 Part C: AdminCRM.tsx captures pre-mount ack in `useState`, bumps localStorage ack forward in `useEffect`, passes `isNew` to SellerProfileCard per row, subscribes to realtime INSERTs to auto-prepend
7. 🟡 Part C: SellerProfileCard gets `isNew?: boolean` prop → renders `<Badge variant="destructive">NEW</Badge>` next to seller name
8. 🟡 `npx tsc --noEmit` clean
9. 🟡 Commit + PR + merge

**Design decisions already locked in:**
- Use the existing `PlatformHeader.tsx` bell-badge pattern 1:1 (Supabase `postgres_changes` INSERT subscription + React Query invalidation)
- `localStorage`-backed ack timestamp, not server-side (acceptable for pilot; revisit later)
- Fallback ack = `now() - 30 days` for first-time users
- Scope of "new contact" = ALL new `seller_profiles` rows for the org, any source
- Scope excludes `buyer_profiles` (separate table, follow-up)
- Comparable_sales NOT surfaced in CRM view (not "fields collected from the customer")
- Quiz field select values render as raw codes (`"semi"`), pretty labels are Issue #6

**Verification plan:** 9 test cases total across Parts A/B/C, listed in full in the plan file.
