/**
 * scripts/lint-locale.ts — Run ESLint, fail only on `locale/*` rule violations.
 *
 * The repo carries 500+ pre-existing `@typescript-eslint/no-explicit-any` /
 * `prefer-const` / `no-require-imports` violations.  Gating CI on the full
 * `npm run lint` would block every PR until that backlog is paid down — out
 * of scope for the locale-architecture rollout.
 *
 * This script narrows the gate to the new invariant: zero hardcoded locale
 * literals outside the canonical and the explicit allowlist.  Pre-existing
 * lint debt is tracked separately.
 *
 * Usage:
 *   npx tsx scripts/lint-locale.ts
 *
 * Exit codes:
 *   0  no `locale/*` rule violations
 *   1  one or more `locale/*` rule violations
 *   2  ESLint itself failed to run (config error, etc.)
 */

import { ESLint } from 'eslint';

async function main() {
  const eslint = new ESLint({
    cwd: process.cwd(),
    errorOnUnmatchedPattern: false,
  });

  let results: ESLint.LintResult[];
  try {
    results = await eslint.lintFiles(['.']);
  } catch (err) {
    console.error('❌ ESLint failed to run:', err instanceof Error ? err.message : err);
    process.exit(2);
  }

  const localeViolations: Array<{ file: string; line: number; rule: string; message: string }> = [];

  for (const result of results) {
    for (const msg of result.messages) {
      if (msg.ruleId && msg.ruleId.startsWith('locale/')) {
        localeViolations.push({
          file: result.filePath,
          line: msg.line,
          rule: msg.ruleId,
          message: msg.message,
        });
      }
    }
  }

  if (localeViolations.length === 0) {
    const filesScanned = results.length;
    console.log(`✅ No locale rule violations across ${filesScanned} files.`);
    process.exit(0);
  }

  console.error(`❌ ${localeViolations.length} locale rule violation(s):\n`);

  // Group by file for readable output
  const byFile = new Map<string, typeof localeViolations>();
  for (const v of localeViolations) {
    if (!byFile.has(v.file)) byFile.set(v.file, []);
    byFile.get(v.file)!.push(v);
  }

  const cwd = process.cwd();
  for (const [file, violations] of byFile.entries()) {
    const relPath = file.startsWith(cwd) ? file.slice(cwd.length + 1) : file;
    console.error(`${relPath}`);
    for (const v of violations) {
      console.error(`  ${v.line.toString().padStart(4)}:  ${v.rule.padEnd(40)}  ${v.message}`);
    }
    console.error('');
  }

  console.error(`To fix: route through helpers from @/lib/locale/config (formatPrice, formatLocation, addressConfig.postalCodeLabel, regionConfig.property.energyRatings.label).`);
  console.error(`To temporarily allow: add the file to LEGACY_LOCALE_ALLOWLIST in eslint.config.js, or add a same-line "// locale-allowed: <reason>" comment.`);

  process.exit(1);
}

main();
