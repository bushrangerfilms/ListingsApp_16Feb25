/**
 * i18n Completeness Check
 * Validates that all translation keys in the base locale (en-IE) exist in other locale files.
 *
 * Usage: npx tsx scripts/i18n-check.ts
 *
 * Checks:
 * - All keys in en-IE/*.json exist in en-GB/*.json, en-US/*.json, etc.
 * - Reports missing keys per locale and namespace
 */

import * as fs from 'fs';
import * as path from 'path';

const LOCALES_DIR = path.resolve(__dirname, '../public/locales');
const BASE_LOCALE = 'en-IE';
const TARGET_LOCALES = ['en-GB', 'en-US', 'en-CA', 'en-AU', 'en-NZ'];

interface MissingKey {
  locale: string;
  namespace: string;
  key: string;
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = value;
    }
  }

  return result;
}

function loadJson(filePath: string): Record<string, unknown> | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Main
const baseDir = path.join(LOCALES_DIR, BASE_LOCALE);

if (!fs.existsSync(baseDir)) {
  console.log(`Base locale directory not found: ${baseDir}`);
  console.log('Create translation files in public/locales/en-IE/ first.\n');
  process.exit(0);
}

const namespaces = fs.readdirSync(baseDir)
  .filter(f => f.endsWith('.json'))
  .map(f => f.replace('.json', ''));

if (namespaces.length === 0) {
  console.log('No namespace files found in base locale.\n');
  process.exit(0);
}

console.log(`\nBase locale: ${BASE_LOCALE}`);
console.log(`Namespaces: ${namespaces.join(', ')}`);
console.log(`Target locales: ${TARGET_LOCALES.join(', ')}\n`);

const allMissing: MissingKey[] = [];
const summary: Record<string, { total: number; missing: number }> = {};

for (const ns of namespaces) {
  const baseFile = path.join(baseDir, `${ns}.json`);
  const baseData = loadJson(baseFile);

  if (!baseData) {
    console.log(`  Warning: Could not load ${baseFile}`);
    continue;
  }

  const baseKeys = Object.keys(flattenObject(baseData));

  for (const locale of TARGET_LOCALES) {
    const targetFile = path.join(LOCALES_DIR, locale, `${ns}.json`);
    const localeKey = `${locale}/${ns}`;

    if (!fs.existsSync(targetFile)) {
      summary[localeKey] = { total: baseKeys.length, missing: baseKeys.length };
      for (const key of baseKeys) {
        allMissing.push({ locale, namespace: ns, key });
      }
      continue;
    }

    const targetData = loadJson(targetFile);
    if (!targetData) {
      summary[localeKey] = { total: baseKeys.length, missing: baseKeys.length };
      continue;
    }

    const targetKeys = new Set(Object.keys(flattenObject(targetData)));
    const missing = baseKeys.filter(k => !targetKeys.has(k));

    summary[localeKey] = { total: baseKeys.length, missing: missing.length };

    for (const key of missing) {
      allMissing.push({ locale, namespace: ns, key });
    }
  }
}

// Report
console.log('Translation Completeness Report');
console.log('═'.repeat(60));

for (const [localeNs, stats] of Object.entries(summary)) {
  const pct = stats.total > 0 ? Math.round(((stats.total - stats.missing) / stats.total) * 100) : 100;
  const status = stats.missing === 0 ? 'COMPLETE' : `${stats.missing} missing`;
  console.log(`  ${localeNs.padEnd(25)} ${pct}% (${status})`);
}

console.log('');

if (allMissing.length === 0) {
  console.log('All translations complete!\n');
  process.exit(0);
} else {
  // Show first 20 missing keys
  if (allMissing.length > 20) {
    console.log(`First 20 of ${allMissing.length} missing keys:\n`);
  } else {
    console.log(`Missing keys:\n`);
  }

  for (const m of allMissing.slice(0, 20)) {
    console.log(`  ${m.locale}/${m.namespace}: ${m.key}`);
  }

  if (allMissing.length > 20) {
    console.log(`  ... and ${allMissing.length - 20} more`);
  }

  console.log(`\nTotal: ${allMissing.length} missing translation(s).\n`);
  process.exit(1);
}
