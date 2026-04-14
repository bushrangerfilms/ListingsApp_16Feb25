# Worth Estimate Quiz — Improvement Backlog

Living doc for follow-up work on the `WORTH_ESTIMATE` lead magnet quiz. Work is tackled one issue at a time in logical order — each issue gets its own planning session and PR when we pick it up.

**Status legend:** 🔴 not started · 🟡 in progress · 🟢 shipped · ⚪ out of scope

---

## Already shipped (2026-04-14)

- 🟢 **Custom-domain URL verification gating** — Gate lead magnet URLs on `custom_domain_status = 'verified'` across Socials and Listings. Socials PR #175, Listings PR #153. Also backfilled cleanup migration that cleared 16 legacy junk domains.
- 🟢 **`market_trend` CHECK-constraint crash** — `lead_submissions` INSERT was failing because `getDefaultMarketResearch` returned `trend: "stable"` (lowercase) vs the CHECK constraint's title-case enum. Normalised at the insert site. Listings PR #156.
- 🟢 **Gemini → Claude for market research** — Gemini 2.5 Flash was returning truncated JSON; switched to Claude Opus 4.6 with tool use + `strict: true` for guaranteed structured output. Listings PR #157.
- 🟢 **30-day orphan purge + anonymized daily activity digest** — `purge_orphaned_lead_submissions()` cron at 03:00 UTC; `lead-magnet-activity-digest` edge function at 08:00 UTC. Listings PR #158.

---

## Open issues (prioritized)

### 🟡 1. Eircode should drive location, not Townland — **PLAN READY**

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

### 🔴 2. Comparable properties not rendering

**Problem.** The "Recent Sales in Your Area" section renders a list where every item reads literally `bed` with no data. Claude is returning a valid `comparable_sales` array in the tool-use response (verified in the DB — 5 items with description / sale_price / approx_sqm / price_per_sqm / distance_km), but the frontend is rendering the wrong field or the wrong shape.

**Fix sketch.** Find the component that renders Recent Sales in `LeadMagnetQuiz.tsx` (or a results subcomponent), inspect the expected shape, fix the mapping.

**Files likely touched.** `src/pages/lead-magnet/LeadMagnetQuiz.tsx` results view, possibly a dedicated `ComparableSalesList` component.

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

### 🔴 4. CRM: surface full quiz details + fire real-time agent notification

**Problem.** When a lead unlocks, the CRM profile shows name, email, source, submitted date, estimate range and confidence — but **not** the quiz field answers (eircode, bedrooms, property type, condition, etc.). The agent has no context for the follow-up call. Also: the real-time email-notification-to-agent path exists (`handleUnlock` in `lead-magnet-api`) but the user reports they're not receiving it — needs investigation.

**Fix sketch — two parts.**

**Part A: Surface quiz details in CRM profile view.** Add a "Quiz Responses" section to the seller profile page showing the raw `answers_json` rendered as labeled rows (or at minimum the key fields: eircode, property type, bedrooms, condition, floor area, property age). Pull from `lead_submissions.answers_json` joined on `seller_profile_id`.

**Part B: Fix / verify the real-time agent notification email.** Trace `handleUnlock` in `lead-magnet-api/index.ts` (around line 425) — it calls `send-email` with a template for the agent notification. Check:
- Is the template `lead_magnet_notification` (or whatever it's named) actually in `email_templates` for platform-default?
- Is `send-email` being called with the right `to` address?
- Are there any silent errors in the call?
- Does the notification include enough quiz field context to be useful?

**Files likely touched.** `src/pages/admin/crm/SellerProfileDetail.tsx` (or wherever the CRM seller profile renders), `supabase/functions/lead-magnet-api/index.ts` `handleUnlock` + notification email template.

---

### 🔴 5. PDF report: logo + design styling

**Problem.** The generated PDF is plain-text Times New Roman with no branding, logo, or visual polish. Agents share this with their leads — it reflects on their brand, which reflects on AutoListing's.

**Fix sketch.**
- Add the org's logo at the top (from `organizations.logo_url`).
- Use the org's `primary_color` / `secondary_color` for headings and accents (same branding variables already used by `send-email`).
- Section cards with rounded corners + subtle shadows for the estimate, value drivers, market insights, next steps.
- Better typography — system sans (Inter / SF Pro / Helvetica).
- Cover page? Footer with org contact info?

**Files likely touched.** Wherever the PDF is generated — need to trace. Likely a frontend jsPDF / html2canvas path or a server-side template. (Investigation step: find the PDF generation code path.)

**Open questions.**
- Client-side (jsPDF) or server-side (puppeteer edge function)? Current implementation unknown.
- Reuse the email template's HTML as the PDF source? Would keep brand consistency across email and PDF.

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

## Suggested order of attack

**Round 1 — UX correctness (blocking real usage):**
1. **Issue 1 (Eircode-drives-location)** — fixing this makes downstream estimates actually accurate
2. **Issue 2 (Comparable properties rendering)** — visible broken UI, trust-killer, tiny fix
3. 🟢 **Issue 3 (Unlock modal reframing)** — SHIPPED

**Round 2 — Agent experience:**
4. **Issue 4 (CRM details + real-time notification)** — agent can actually act on leads
5. **Issue 5 (PDF branding)** — the artefact agents share externally

**Round 3 — Market expansion:**
6. **Issue 6 (International locale)** — needed for UK / US / CA / AU / NZ launch, not blocking Irish pilot

**Order is a suggestion — happy to reorder if any of these are more urgent than they look to me.**
