import { readFileSync, existsSync } from 'node:fs';

const ENV_FILE = '/Users/bushrangerfilms/Documents/Claude/.env.seo-agent';

function loadEnv() {
  if (!existsSync(ENV_FILE)) return {};
  const out = {};
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

export async function sendDigest({ to, subject, html, text }) {
  const env = { ...process.env, ...loadEnv() };
  const apiKey = env.RESEND_API_KEY;
  const from = env.SEO_AGENT_FROM_EMAIL || 'SEO Agent <noreply@autolisting.io>';

  if (!apiKey) {
    return { skipped: true, reason: 'no RESEND_API_KEY in ~/.env.seo-agent' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  const body = await res.json();
  if (!res.ok) {
    return { sent: false, error: body, status: res.status };
  }
  return { sent: true, id: body.id };
}
