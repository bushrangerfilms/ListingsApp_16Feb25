/**
 * sync.ts — Mirror the canonical locale.config.ts to every consumer location.
 *
 * Run via:  npx tsx locale-config/sync.ts            (writes mirrors)
 *           npx tsx locale-config/sync.ts --check    (CI: exits 1 on drift)
 *
 * The canonical file lives at locale-config/locale.config.ts.  Each mirror is
 * an *exact byte copy* of the canonical file, prefixed with an auto-generated
 * banner that includes the SHA-256 of the canonical contents.  Drift detection
 * is therefore a hash compare against the banner, not a content diff.
 *
 * Mirror destinations (relative to the Listings repo root):
 *
 *   src/lib/locale/config.ts                          ← Listings frontend
 *   supabase/functions/_shared/locale.config.ts       ← Listings edge fns
 *   ../Socials/src/lib/locale/config.ts               ← Socials frontend
 *   ../Socials/server/services/locale.config.ts       ← Socials Node server
 *   ../Socials/supabase/functions/_shared/locale.config.ts ← Socials edge fns
 *
 * The Socials mirrors are out-of-tree relative to this repo's git history;
 * they only get written when the script is run from a checkout that has
 * `../Socials/` available (i.e. the standard /Users/bushrangerfilms/Documents/
 * Claude/ layout).  In CI for one repo, missing Socials paths are skipped
 * with a warning, not an error.  A separate Socials-side sync run handles
 * its own mirrors.  See README.md for the full rollout plan.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const CANONICAL = resolve(REPO_ROOT, 'locale-config/locale.config.ts');

interface Mirror {
  /** Absolute path to the destination file. */
  path: string;
  /** Human label for log output. */
  label: string;
  /** Whether this mirror is required (fail) or optional (warn) when missing. */
  required: boolean;
  /**
   * Path to a directory whose existence is the gating signal for this mirror.
   * For Listings mirrors this is the repo root.  For Socials mirrors it's the
   * Socials repo root, which may or may not be checked out alongside.
   */
  gateDir: string;
}

const SOCIALS_ROOT = resolve(REPO_ROOT, '../Socials');

const MIRRORS: Mirror[] = [
  // Listings — required, in-tree
  { path: resolve(REPO_ROOT, 'src/lib/locale/config.ts'), label: 'Listings frontend', required: true, gateDir: REPO_ROOT },
  { path: resolve(REPO_ROOT, 'supabase/functions/_shared/locale.config.ts'), label: 'Listings edge fns', required: true, gateDir: REPO_ROOT },
  // Socials — optional from this repo, written when ../Socials exists
  { path: resolve(SOCIALS_ROOT, 'src/lib/locale/config.ts'), label: 'Socials frontend', required: false, gateDir: SOCIALS_ROOT },
  { path: resolve(SOCIALS_ROOT, 'server/services/locale.config.ts'), label: 'Socials Node server', required: false, gateDir: SOCIALS_ROOT },
  { path: resolve(SOCIALS_ROOT, 'supabase/functions/_shared/locale.config.ts'), label: 'Socials edge fns', required: false, gateDir: SOCIALS_ROOT },
];

function readCanonical(): string {
  if (!existsSync(CANONICAL)) {
    console.error(`❌ Canonical file not found at ${CANONICAL}`);
    process.exit(2);
  }
  return readFileSync(CANONICAL, 'utf8');
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** Banner text added on top of every generated mirror.  Body sha is over the
 *  canonical file content only — the banner is excluded so we can verify a
 *  mirror's body matches the claimed hash, not just that the banner is intact. */
function buildBanner(hash: string): string {
  return `// ⚠️  AUTO-GENERATED FROM /locale-config/locale.config.ts — DO NOT EDIT.
// Edit the canonical file at locale-config/locale.config.ts in the Listings
// repo, then run \`npx tsx locale-config/sync.ts\` to regenerate every mirror.
// Drift between mirrors is detected at CI time via the SHA below — a mirror
// is in-sync iff sha256(content-after-banner) === canonical-sha256.
// canonical-sha256: ${hash}
`;
}

function buildMirrorContent(canonical: string, hash: string): string {
  return `${buildBanner(hash)}\n${canonical}`;
}

const BANNER_END_MARKER = '// canonical-sha256: ';

function extractHashFromMirror(mirrorContent: string): string | null {
  const match = mirrorContent.match(/canonical-sha256:\s*([a-f0-9]{64})/);
  return match ? match[1] : null;
}

function extractBodyFromMirror(mirrorContent: string): string | null {
  const idx = mirrorContent.indexOf(BANNER_END_MARKER);
  if (idx === -1) return null;
  const newlineAfterBanner = mirrorContent.indexOf('\n', idx);
  if (newlineAfterBanner === -1) return null;
  // Content after the banner — buildMirrorContent inserts a single \n before the body.
  return mirrorContent.slice(newlineAfterBanner + 1).replace(/^\n/, '');
}

function ensureDir(filePath: string) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function writeMirror(mirror: Mirror, content: string) {
  ensureDir(mirror.path);
  writeFileSync(mirror.path, content, 'utf8');
}

interface Result {
  label: string;
  status: 'in-sync' | 'updated' | 'created' | 'drift' | 'missing-optional' | 'missing-required';
  detail?: string;
}

function processMirror(mirror: Mirror, expectedContent: string, expectedHash: string, mode: 'write' | 'check'): Result {
  if (!existsSync(mirror.gateDir)) {
    if (mirror.required) {
      return { label: mirror.label, status: 'missing-required', detail: `gate dir ${mirror.gateDir} does not exist` };
    }
    return { label: mirror.label, status: 'missing-optional', detail: `${mirror.gateDir} not present (sibling repo not checked out)` };
  }

  if (!existsSync(mirror.path)) {
    if (mode === 'check') {
      return { label: mirror.label, status: mirror.required ? 'missing-required' : 'missing-optional', detail: `${mirror.path} does not exist` };
    }
    writeMirror(mirror, expectedContent);
    return { label: mirror.label, status: 'created' };
  }

  const existing = readFileSync(mirror.path, 'utf8');
  const claimedHash = extractHashFromMirror(existing);
  const body = extractBodyFromMirror(existing);
  const actualBodyHash = body == null ? null : sha256(body);

  // In-sync iff the claimed hash matches the canonical AND the body actually
  // hashes to that claim.  This catches both stale mirrors AND mirrors whose
  // body was edited without updating the banner.
  if (claimedHash === expectedHash && actualBodyHash === expectedHash) {
    return { label: mirror.label, status: 'in-sync' };
  }

  if (mode === 'check') {
    const reasons: string[] = [];
    if (claimedHash !== expectedHash) {
      reasons.push(`banner sha=${claimedHash?.slice(0, 12) ?? '(none)'}, expected ${expectedHash.slice(0, 12)}`);
    }
    if (actualBodyHash !== expectedHash) {
      reasons.push(`body sha=${actualBodyHash?.slice(0, 12) ?? '(none)'}, expected ${expectedHash.slice(0, 12)} (mirror was edited?)`);
    }
    return { label: mirror.label, status: 'drift', detail: reasons.join('; ') };
  }

  writeMirror(mirror, expectedContent);
  return { label: mirror.label, status: 'updated' };
}

function main() {
  const mode: 'write' | 'check' = process.argv.includes('--check') ? 'check' : 'write';

  const canonical = readCanonical();
  const hash = sha256(canonical);
  const expected = buildMirrorContent(canonical, hash);

  console.log(`📝 canonical sha256:${hash.slice(0, 16)}…  (${mode} mode)\n`);

  const results = MIRRORS.map((m) => processMirror(m, expected, hash, mode));

  let exitCode = 0;
  for (const r of results) {
    const icon = ({
      'in-sync': '✓ ',
      'updated': '↻ ',
      'created': '+ ',
      'drift': '✗ ',
      'missing-optional': '· ',
      'missing-required': '✗ ',
    })[r.status];
    const line = `  ${icon}${r.label.padEnd(28)} ${r.status}${r.detail ? `  (${r.detail})` : ''}`;
    if (r.status === 'drift' || r.status === 'missing-required') {
      console.error(line);
      exitCode = 1;
    } else {
      console.log(line);
    }
  }

  console.log('');
  if (exitCode !== 0) {
    if (mode === 'check') {
      console.error(`❌ Drift detected.  Run \`npx tsx locale-config/sync.ts\` to regenerate mirrors.`);
    } else {
      console.error(`❌ Sync failed for required mirrors.`);
    }
  } else {
    console.log(`✅ All required mirrors ${mode === 'check' ? 'match canonical' : 'in sync'}.`);
  }

  process.exit(exitCode);
}

main();
