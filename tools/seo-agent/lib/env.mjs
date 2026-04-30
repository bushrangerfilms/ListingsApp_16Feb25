import { readFileSync, existsSync } from 'node:fs';

const ENV_FILE = '/Users/bushrangerfilms/Documents/Claude/.env.seo-agent';

let loaded = false;

export function loadEnv() {
  if (loaded) return process.env;
  loaded = true;
  if (!existsSync(ENV_FILE)) return process.env;
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return process.env;
}

loadEnv();
