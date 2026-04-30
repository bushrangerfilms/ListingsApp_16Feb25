#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHECKS = ['gsc-snapshot', 'sitemap-audit', 'page-meta', 'cwv', 'link-check'];

const RUN_TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const REPORTS_DIR = path.join(__dirname, 'reports', RUN_TIMESTAMP);
mkdirSync(REPORTS_DIR, { recursive: true });

function runCheck(name) {
  return new Promise((resolve) => {
    const script = path.join(__dirname, 'checks', `${name}.mjs`);
    const p = spawn('node', [script], { env: process.env });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => { stdout += d.toString(); });
    p.stderr.on('data', (d) => { stderr += d.toString(); });
    p.on('close', (code) => {
      let parsed = null;
      try { parsed = JSON.parse(stdout); } catch { /* fallthrough */ }
      const result = {
        check: name,
        exit_code: code,
        ok: code === 0 && parsed !== null,
        stderr: stderr.slice(0, 2000) || undefined,
        data: parsed,
        raw_stdout: parsed ? undefined : stdout.slice(0, 4000),
      };
      writeFileSync(path.join(REPORTS_DIR, `${name}.json`), JSON.stringify(result, null, 2));
      resolve(result);
    });
  });
}

const startTime = Date.now();
const results = await Promise.all(CHECKS.map(runCheck));
const elapsedMs = Date.now() - startTime;

const aggregate = {
  run_timestamp: RUN_TIMESTAMP,
  reports_dir: REPORTS_DIR,
  elapsed_ms: elapsedMs,
  checks: Object.fromEntries(results.map((r) => [r.check, r])),
};

writeFileSync(path.join(REPORTS_DIR, '_aggregate.json'), JSON.stringify(aggregate, null, 2));

console.log(JSON.stringify({
  run_timestamp: RUN_TIMESTAMP,
  reports_dir: REPORTS_DIR,
  elapsed_ms: elapsedMs,
  summary: results.map((r) => ({
    check: r.check,
    ok: r.ok,
    exit_code: r.exit_code,
  })),
}, null, 2));
