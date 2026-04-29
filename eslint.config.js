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
  // Postcode helpers — per-market regex/labels ARE the data.
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
  // Brochure built-in cert logo registry — `locales` field IS the data
  // (each logo is mapped to the markets it's relevant for).
  "src/lib/brochure/certificationLogos.ts",
  // The lint rules themselves & their tests
  "eslint-rules/**/*.js",
  // Scripts: i18n tooling and product-seed scripts work with locale strings as data.
  "scripts/i18n-check.ts",
  "scripts/i18n-lint.ts",
  "scripts/seed-stripe-products.ts",
  "scripts/render-brochure.tsx",
  // Auto-generated DB types — can't be edited.
  "src/integrations/supabase/types.ts",
  // Locale picker UI — the LOCALE_OPTIONS table IS the data.
  "src/components/admin/OrganizationLocaleSelector.tsx",
  // Locale preview toggle — LOCALE_LABELS table IS the data.
  "src/components/admin/LocalePreviewToggle.tsx",
  // Site-content keys — module exports its own DEFAULT_LOCALE constant.
  "src/lib/siteContentKeys.ts",
];

// ─────────────────────────────────────────────────────────────────────────
// Locale-rules legacy allowlist  —  empty.  Every file that pre-dated the
// canonical rollout has either been migrated to `regionConfig` / `formatPrice`
// / `formatLocation` helpers or carries an explicit same-line
// `// locale-allowed: <reason>` waiver.  Add entries here only as a temporary
// staging area when introducing a new file that can't yet route through the
// canonical helpers; pair every entry with a follow-up cleanup PR.
// ─────────────────────────────────────────────────────────────────────────
const LEGACY_LOCALE_ALLOWLIST = [];

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
  ...(LEGACY_LOCALE_ALLOWLIST.length
    ? [{ files: LEGACY_LOCALE_ALLOWLIST, rules: LOCALE_RULES_OFF }]
    : []),
);
