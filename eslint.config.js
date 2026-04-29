import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import locale from "./eslint-rules/locale.js";

// ─────────────────────────────────────────────────────────────────────────
// Locale-rules categorical exemptions  —  these files own locale data by design.
// ─────────────────────────────────────────────────────────────────────────
const LOCALE_CANONICAL_FILES = [
  // Canonical source + sync tooling
  "locale-config/**/*.{ts,js}",
  // Generated mirrors (never hand-edited)
  "src/lib/locale/config.ts",
  "supabase/functions/_shared/locale.config.ts",
  // Back-compat shim over the canonical
  "src/lib/regionConfig/index.ts",
  // Pre-canonical edge-function locale data + postcode helpers — older twin
  // of the canonical above. Will be migrated to the canonical mirror in a
  // later checkpoint; exempt for now because they DO need to carry the
  // per-locale literals that drive user-facing output.
  "supabase/functions/_shared/locale-config.ts",
  "supabase/functions/_shared/postcodes.ts",
  "src/lib/regionConfig/postcodes.ts",
  // Locale-detection helpers — input is a raw locale string; comparisons
  // against literal locale ids are intentional.
  "src/lib/locale/markets.ts",
  "src/lib/locale/legalConfig.ts",
  "src/lib/locale/detectFromAddress.ts",
  "src/lib/geo/detectCountry.ts",
  "src/lib/geo/seedLocale.ts",
  "src/lib/i18n/index.ts",
  "src/hooks/useLocale.ts",
  "src/hooks/useUKRollout.ts",
  // Pricing / billing — currency strings ARE the data here.
  "src/lib/billing/pricing.ts",
  // The lint rules themselves & their tests
  "eslint-rules/**/*.js",
  // Scripts: i18n tooling and product-seed scripts work with locale strings as data.
  "scripts/i18n-check.ts",
  "scripts/i18n-lint.ts",
  "scripts/seed-stripe-products.ts",
  "scripts/render-brochure.tsx",
  // Auto-generated DB types — can't be edited.
  "src/integrations/supabase/types.ts",
];

// ─────────────────────────────────────────────────────────────────────────
// Locale-rules legacy allowlist  —  files that pre-date the canonical rollout
// and still contain hardcoded locale literals.  Each entry is a TODO; ship a
// per-file cleanup PR that routes through `regionConfig` / `formatPrice` /
// `formatLocation`, then remove the file from this list.  Once the list is
// empty, the legacy work is done.
// ─────────────────────────────────────────────────────────────────────────
const LEGACY_LOCALE_ALLOWLIST = [
  // (Lead-magnet quiz + landing pages cleaned up — they no longer carry
  // hardcoded "BER Rating" / locale-id literals.  "Eircode" defaults remain
  // behind same-line `// locale-allowed:` waivers because the metadata is
  // overridden at render via postcodeConfig.label / localizeQuestion.)
  // CRM lead view — hardcoded €/Co./Eircode in quiz field labels.
  "src/components/SellerProfileCard.tsx",
  // (Listing creation/review/edit + ValuationRequest + PropertyDetails were
  // migrated in the listing-forms cleanup PR — they no longer carry hardcoded
  // locale literals.  listingSchema.ts entry below also removed.)
  // Brochure editors — hardcoded "Eircode" placeholder, default € examples.
  // (The 8 brochure TEMPLATES under templates/ were migrated to canonical
  // lookups in the brochure-cleanup PR — they're no longer on this list.)
  "src/pages/BrochureEditor.tsx",
  "src/components/brochure/BrochureCoverEditor.tsx",
  "src/components/brochure/BrochureLegalEditor.tsx",
  "src/components/brochure/BrochureHeaderEditor.tsx",
  "src/components/brochure/BrochureCertificationEditor.tsx",
  "src/lib/brochure/designTokens.ts",
  "src/lib/brochure/certificationLogos.ts",
  // Marketing footer / legal / public pages — IE company info + €fallbacks.
  "src/components/marketing/MarketingFooter.tsx",
  "src/pages/marketing/SupportPage.tsx",
  "src/pages/marketing/MarketingHome.tsx",
  "src/pages/marketing/PricingPage.tsx",
  "src/pages/marketing/FeaturesPage.tsx",
  "src/pages/TermsConditions.tsx",
  "src/pages/PrivacyPolicy.tsx",
  "src/pages/CookiePolicy.tsx",
  // Public site / shop window — €fallback when org currency is null.
  "src/pages/AdminShopWindowDisplay.tsx",
  "src/pages/ShopWindowDisplay.tsx",
  "src/pages/PublicListings.tsx",
  // Listings schema helpers (listingSchema.ts cleaned up in listing-forms PR).
  "src/lib/listingSearch.ts",
  "src/config/company.ts",
  // Admin pages — €in usage rates, IE defaults.
  "src/pages/internal/UsageRatesPage.tsx",
  "src/pages/internal/AITrainingPage.tsx",
  "src/pages/internal/PilotSettingsPage.tsx",
  "src/pages/AdminBranding.tsx",
  "src/pages/AdminEmailSettings.tsx",
  "src/pages/AdminMatchingAnalytics.tsx",
  "src/pages/AdminEmailCampaignAnalytics.tsx",
  "src/pages/AdminWebsiteSettings.tsx",
  "src/pages/AdminCRMAnalytics.tsx",
  "src/pages/AdminTeamPerformance.tsx",
  "src/pages/AdminSourceAttribution.tsx",
  "src/pages/AdminPredictiveAnalytics.tsx",
  "src/pages/AdminMarketingContent.tsx",
  "src/pages/AdminAnalytics.tsx",
  "src/pages/AdminUnifiedAnalytics.tsx",
  "src/pages/AdminContent.tsx",
  "src/pages/AdminListingAnalytics.tsx",
  "src/pages/AdminOrganizationSettings.tsx",
  // Admin components touching locale.
  "src/components/admin/OrganizationLocaleSelector.tsx",
  "src/components/admin/OrganizationDetailDrawer.tsx",
  "src/components/admin/LocalePreviewToggle.tsx",
  // AI assistant — has IE example outputs in mock content.
  "src/components/ai-assistant/ChatTester.tsx",
  "src/components/ai-assistant/IntegrationConfig.tsx",
  "src/components/ai-assistant/TrainingConfig.tsx",
  // Misc components.
  "src/components/PublicHeader.tsx",
  "src/components/PlatformHeader.tsx",
  "src/components/CustomDomainSetup.tsx",
  "src/components/analytics/sections/ListingsSection.tsx",
  "src/components/analytics/sections/OverviewSection.tsx",
  // Hooks & lib.
  "src/hooks/useFeatureFlag.ts",
  "src/hooks/useOrgContent.ts",
  "src/lib/siteContentKeys.ts",
  "src/lib/organizationHelpers.ts",
  "src/lib/admin/adminApi.ts",
  // App/routing/contexts.
  "src/App.tsx",
  "src/contexts/OrganizationViewContext.tsx",
  "src/contexts/OrganizationContext.tsx",
  // Edge functions  —  these are the next-priority cleanups (they hit posting/email/AI flows).
  "supabase/functions/al-chat/index.ts",
  "supabase/functions/create-organization/index.ts",
  "supabase/functions/enhance-listing-copy/index.ts",
  "supabase/functions/extract-property-details/index.ts",
  "supabase/functions/generate-brochure-content/index.ts",
  "supabase/functions/lead-magnet-activity-digest/index.ts",
  "supabase/functions/lead-magnet-api/index.ts",
  "supabase/functions/notify-agent/index.ts",
  "supabase/functions/process-email-sequences/index.ts",
  "supabase/functions/stripe-setup/index.ts",
  "supabase/functions/submit-property-enquiry/index.ts",
  "supabase/functions/submit-valuation-request/index.ts",
  "supabase/functions/update-listing-details/index.ts",
];

const LOCALE_RULES_ON = {
  "locale/no-hardcoded-currency-symbol": "error",
  "locale/no-hardcoded-locale-id": "error",
  "locale/no-hardcoded-county-prefix": "error",
  "locale/no-hardcoded-postal-label": "error",
  "locale/no-hardcoded-energy-label": "error",
};

const LOCALE_RULES_OFF = Object.fromEntries(
  Object.keys(LOCALE_RULES_ON).map((k) => [k, "off"]),
);

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      locale,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      ...LOCALE_RULES_ON,
    },
  },
  // Canonical / locale-data files — locale literals here are the data.
  { files: LOCALE_CANONICAL_FILES, rules: LOCALE_RULES_OFF },
  // Legacy allowlist — files awaiting per-file cleanup PRs.
  { files: LEGACY_LOCALE_ALLOWLIST, rules: LOCALE_RULES_OFF },
);
