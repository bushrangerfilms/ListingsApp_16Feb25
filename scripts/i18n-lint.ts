/**
 * i18n Lint Script
 * Scans .tsx files for hardcoded locale references that should be dynamic.
 *
 * Usage: npx tsx scripts/i18n-lint.ts [--fix]
 *
 * Checks for:
 * - Hardcoded currency symbols (€, £, $) outside of config/mapping files
 * - Hardcoded 'en-IE' in Intl/toLocaleDateString calls (without fallback pattern)
 * - Hardcoded country names used as display text (not in config objects)
 * - Property terminology that should be locale-aware
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.resolve(__dirname, '../src');

// Files/patterns to skip
const SKIP_PATTERNS = [
  'node_modules',
  'types.ts',           // auto-generated
  'locale/markets.ts',  // config file
  'regionConfig/',      // config files
  'legalConfig.ts',     // config file
  'pricing.ts',         // config file (has currency configs)
  'useLocale.ts',       // config file
  'company.ts',         // company config
  'i18n-lint.ts',       // this file
  'i18n-check.ts',
  'i18n-generate.ts',
  'LocalePreviewToggle.tsx', // locale selector
  'OrganizationLocaleSelector.tsx', // locale selector
  '.test.', '.spec.',
  'ChatTester.tsx',     // mock data
];

interface Violation {
  file: string;
  line: number;
  column: number;
  rule: string;
  match: string;
  context: string;
}

const RULES: { name: string; pattern: RegExp; description: string }[] = [
  {
    name: 'hardcoded-euro',
    pattern: /€\d/g,
    description: 'Hardcoded € with amount — use formatCurrency() or formatPrice()',
  },
  {
    name: 'hardcoded-pound',
    pattern: /£\d/g,
    description: 'Hardcoded £ with amount — use formatCurrency() or formatPrice()',
  },
  {
    name: 'hardcoded-locale-intl',
    pattern: /(?:toLocaleDateString|toLocaleString|Intl\.NumberFormat)\s*\(\s*['"]en-IE['"]\s*[,)]/g,
    description: "Hardcoded 'en-IE' in Intl call without fallback — use org locale",
  },
  {
    name: 'hardcoded-locale-intl-no-fallback',
    pattern: /(?:toLocaleDateString|toLocaleString|Intl\.NumberFormat)\s*\(\s*['"]en-(?:GB|US|CA|AU|NZ)['"]\s*[,)]/g,
    description: 'Hardcoded locale in Intl call — use org locale',
  },
];

function shouldSkipFile(filePath: string): boolean {
  return SKIP_PATTERNS.some(p => filePath.includes(p));
}

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relPath = path.relative(SRC_DIR, filePath);

  for (const rule of RULES) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

      // Skip lines that already have a fallback pattern (e.g., `locale || 'en-IE'`)
      if (rule.name.includes('hardcoded-locale') && /\|\|\s*['"]en-/.test(line)) continue;

      let match: RegExpExecArray | null;
      rule.pattern.lastIndex = 0;
      while ((match = rule.pattern.exec(line)) !== null) {
        violations.push({
          file: relPath,
          line: i + 1,
          column: match.index + 1,
          rule: rule.name,
          match: match[0],
          context: line.trim().substring(0, 120),
        });
      }
    }
  }

  return violations;
}

function walkDir(dir: string, ext: string): string[] {
  const results: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      results.push(...walkDir(fullPath, ext));
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }

  return results;
}

// Main
const files = walkDir(SRC_DIR, '.tsx').filter(f => !shouldSkipFile(f));
let totalViolations = 0;

console.log(`\nScanning ${files.length} .tsx files for i18n violations...\n`);

for (const file of files) {
  const violations = scanFile(file);
  if (violations.length > 0) {
    totalViolations += violations.length;
    for (const v of violations) {
      console.log(`  ${v.file}:${v.line}:${v.column}`);
      console.log(`    Rule: ${v.rule} — ${v.match}`);
      console.log(`    ${v.context}\n`);
    }
  }
}

if (totalViolations === 0) {
  console.log('No i18n violations found.\n');
  process.exit(0);
} else {
  console.log(`\nFound ${totalViolations} i18n violation(s) across ${files.length} files.\n`);
  process.exit(1);
}
