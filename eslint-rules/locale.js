/**
 * eslint-rules/locale.js — Custom ESLint rules forbidding hardcoded locale-specific
 * literals outside the canonical locale-config.
 *
 * Rationale: Every customer-visible bug from the locale audit (€ on US image posts,
 * "Co. Los Angeles" on US carousels, "Eircode" labels for non-IE orgs, etc.) was a
 * hardcoded literal that should have been a call into `regionConfig` / `formatPrice`
 * / `formatLocation`. These rules turn the next such hardcode into a build error
 * instead of a customer report.
 *
 * Each rule:
 *   - Visits string literals, template-literal segments, and JSX text nodes
 *   - Tests for a category-specific banned pattern
 *   - Skips files allowlisted in eslint.config.js (canonical sources, generated mirrors)
 *   - Allows opt-out via `// eslint-disable-next-line locale/<rule> -- <reason>`
 *     (use `--report-unused-disable-directives` in CI to keep waivers honest)
 *
 * Adding a new rule: add it to `rules` below.  Wire it in eslint.config.js.
 *
 * If you hit one of these errors and the fix isn't obvious:
 *   - Currency symbol → use `formatPrice(amount, regionConfig)` from
 *     `@/lib/locale/config` (or the shim re-export from `@/lib/regionConfig`).
 *   - "Co. " prefix → use `formatLocation({ town, county }, regionConfig)`.
 *   - "Eircode" / "Postcode" / "ZIP Code" → `addressConfig.postalCodeLabel`.
 *   - "BER" / "EPC" / "HERS" / "EnerGuide" / "NatHERS" →
 *     `regionConfig.property.energyRatings.label`.
 *   - "PSRA" / "Propertymark" / "DRE" → `regionConfig.legal.regulatory.regulatoryBody`
 *     or `licenceDisplayLabel`.
 *   - 'en-IE' / 'en-GB' literal → use `MarketLocale` enum values via a const,
 *     or compare via `countryToLocale(org.country_code)`.
 */

/** Walk the source for the line containing the reported node + check for an inline waiver token. */
function hasInlineWaiver(context, node) {
  const sourceCode = context.getSourceCode ? context.getSourceCode() : context.sourceCode;
  if (!sourceCode || !node.loc) return false;
  const line = sourceCode.lines[node.loc.start.line - 1] || '';
  // Allow `// locale-allowed: <reason>` as a quieter waiver alternative to eslint-disable
  return /\/\/\s*locale-allowed\s*:/.test(line);
}

/**
 * Generic factory for "ban these substrings in any string-bearing AST node" rules.
 *
 * @param {object} options
 * @param {string} options.id — rule id segment after `locale/`
 * @param {string} options.description — short rule description
 * @param {Array<{pattern: RegExp, message: string}>} options.bans — list of banned patterns
 *        with the message shown when matched.
 * @param {(value: string) => boolean} [options.skip] — optional per-string short-circuit
 *        (e.g. "skip if string is too short to matter").
 */
function banSubstrings({ id, description, bans, skip }) {
  return {
    meta: {
      type: 'problem',
      docs: { description, recommended: true },
      schema: [],
      messages: bans.reduce((acc, b, i) => {
        acc[`ban${i}`] = b.message;
        return acc;
      }, {}),
    },
    create(context) {
      function check(node, value) {
        if (typeof value !== 'string') return;
        if (skip && skip(value)) return;
        if (hasInlineWaiver(context, node)) return;
        for (let i = 0; i < bans.length; i++) {
          const ban = bans[i];
          if (ban.pattern.test(value)) {
            context.report({ node, messageId: `ban${i}` });
            return; // one report per node — don't double-fire
          }
        }
      }

      return {
        Literal(node) {
          check(node, node.value);
        },
        TemplateElement(node) {
          check(node, node.value && node.value.cooked);
        },
        JSXText(node) {
          check(node, node.value);
        },
      };
    },
    _id: id, // metadata for the export below
  };
}

const rules = {
  'no-hardcoded-currency-symbol': banSubstrings({
    id: 'no-hardcoded-currency-symbol',
    description:
      'Disallow hardcoded currency symbols (€, £, $\\d, C$, A$, NZ$). Use formatPrice() from @/lib/locale/config.',
    bans: [
      { pattern: /€/, message: 'Hardcoded "€". Use formatPrice(amount, regionConfig) from @/lib/locale/config so the symbol matches the org currency.' },
      { pattern: /£/, message: 'Hardcoded "£". Use formatPrice(amount, regionConfig) from @/lib/locale/config so the symbol matches the org currency.' },
      // Compound currency markers (CAD/AUD/NZD) — always wrong outside formatters
      { pattern: /(?:^|[^A-Za-z])(C\$|A\$|NZ\$)\d/, message: 'Hardcoded compound currency symbol (C$/A$/NZ$). Use formatPrice(amount, regionConfig).' },
      // Bare "$<digit>" — catches $300, $1,500,000 etc. without flagging "${var}" template parts (those aren't in literal values).
      { pattern: /(?:^|[^A-Za-z\\])\$\d/, message: 'Hardcoded "$<number>". Use formatPrice(amount, regionConfig) — bare $ is ambiguous between USD/CAD/AUD/NZD.' },
    ],
    // Skip pure CSS-class strings ("$" doesn't appear in Tailwind, so any $ is suspect; this is a defensive skip for very short fragments)
    skip: (s) => s.length < 2,
  }),

  'no-hardcoded-locale-id': banSubstrings({
    id: 'no-hardcoded-locale-id',
    description:
      "Disallow hardcoded locale strings ('en-IE', 'en-GB', etc.). Use MarketLocale constants or countryToLocale() from @/lib/locale/config.",
    bans: [
      { pattern: /\ben-(IE|GB|US|CA|AU|NZ)\b/, message: "Hardcoded locale id. Compare against constants from @/lib/locale/config (e.g. resolveLocaleFromOrg(org).locale === LOCALE_TO_COUNTRY[...]) or use countryToLocale()." },
    ],
  }),

  'no-hardcoded-county-prefix': banSubstrings({
    id: 'no-hardcoded-county-prefix',
    description: 'Disallow the Irish "Co. " county prefix in user-facing strings. Use formatLocation() from @/lib/locale/config.',
    bans: [
      // "Co. " followed by a capitalised word — typical pattern. Avoids "Co." matches in code comments / class names.
      { pattern: /\bCo\.\s+\$?\{?[A-Z]/, message: 'Hardcoded "Co. " prefix. Use formatLocation({ town, county }, regionConfig) — the prefix is added only for IE.' },
    ],
  }),

  'no-hardcoded-postal-label': banSubstrings({
    id: 'no-hardcoded-postal-label',
    description:
      'Disallow hardcoded postal-code labels (Eircode, Postcode, ZIP Code, Postal Code). Use addressConfig.postalCodeLabel.',
    bans: [
      { pattern: /\bEircode\b/, message: 'Hardcoded "Eircode". Use addressConfig.postalCodeLabel from regionConfig — only IE shows "Eircode".' },
      // Bare "Postcode" / "ZIP Code" / "Postal Code" — but only as user-facing words, not as TS type/identifier fragments.
      // We require word-boundaries.
      { pattern: /\bZIP Code\b/, message: 'Hardcoded "ZIP Code". Use addressConfig.postalCodeLabel.' },
      { pattern: /\bPostal Code\b/, message: 'Hardcoded "Postal Code". Use addressConfig.postalCodeLabel.' },
      // "Postcode" alone is too generic — it's the GB term but also appears in code identifiers like postcodeConfig.
      // Catch only when it's the displayed label, identified by being part of a sentence (preceded/followed by a space).
      { pattern: / Postcode\b|\bPostcode /, message: 'Hardcoded "Postcode". Use addressConfig.postalCodeLabel.' },
    ],
  }),

  'no-hardcoded-energy-label': banSubstrings({
    id: 'no-hardcoded-energy-label',
    description:
      'Disallow hardcoded energy-rating labels (BER, EPC, HERS, EnerGuide, NatHERS). Use regionConfig.property.energyRatings.label.',
    bans: [
      { pattern: /\bBER Rating\b/, message: 'Hardcoded "BER Rating". Use regionConfig.property.energyRatings.label.' },
      { pattern: /\bEPC Rating\b/, message: 'Hardcoded "EPC Rating". Use regionConfig.property.energyRatings.label.' },
      { pattern: /\bHERS (Index|Rating)\b/, message: 'Hardcoded HERS energy label. Use regionConfig.property.energyRatings.label.' },
      { pattern: /\bEnerGuide Rating\b/, message: 'Hardcoded "EnerGuide Rating". Use regionConfig.property.energyRatings.label.' },
      { pattern: /\bNatHERS Rating\b/, message: 'Hardcoded "NatHERS Rating". Use regionConfig.property.energyRatings.label.' },
    ],
  }),
};

const plugin = {
  meta: { name: 'eslint-plugin-locale', version: '1.0.0' },
  rules,
};

export default plugin;
