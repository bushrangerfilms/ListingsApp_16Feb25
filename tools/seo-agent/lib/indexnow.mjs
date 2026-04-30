import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../config/checks.json', import.meta.url), 'utf8'));

export async function verifyKeyFile() {
  const host = config.site.domain;
  const key = config.indexnow?.key;
  if (!key) return { ok: false, reason: 'no key configured' };
  const url = `https://${host}/${key}.txt`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, status: res.status, url };
    const text = (await res.text()).trim();
    if (text !== key) return { ok: false, reason: 'key file content mismatch', url };
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: e.message, url };
  }
}

export async function submitToIndexNow(urls) {
  if (!config.indexnow?.key) throw new Error('No indexnow.key in config/checks.json');
  if (!Array.isArray(urls) || urls.length === 0) return { skipped: true, reason: 'no urls' };

  const verify = await verifyKeyFile();
  if (!verify.ok) {
    return { skipped: true, reason: 'key file not reachable; cannot submit', verify };
  }

  const host = config.site.domain;
  const key = config.indexnow.key;
  const keyLocation = verify.url;

  const body = {
    host,
    key,
    keyLocation,
    urlList: urls.slice(0, 10_000),
  };

  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });

  return {
    submitted: urls.length,
    status: res.status,
    ok: res.status >= 200 && res.status < 300,
    body: await res.text().then(t => t.slice(0, 500)).catch(() => ''),
  };
}
