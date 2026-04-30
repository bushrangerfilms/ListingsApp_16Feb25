import { readFileSync, existsSync } from 'node:fs';
import './env.mjs';

const LOCAL_CREDS_FILE = '/Users/bushrangerfilms/Documents/Claude/.env.gsc-oauth.json';

function resolveCreds() {
  if (process.env.GSC_CLIENT_ID && process.env.GSC_CLIENT_SECRET && process.env.GSC_REFRESH_TOKEN) {
    return {
      client_id: process.env.GSC_CLIENT_ID,
      client_secret: process.env.GSC_CLIENT_SECRET,
      refresh_token: process.env.GSC_REFRESH_TOKEN,
      token_uri: process.env.GSC_TOKEN_URI || 'https://oauth2.googleapis.com/token',
    };
  }
  if (existsSync(LOCAL_CREDS_FILE)) {
    return JSON.parse(readFileSync(LOCAL_CREDS_FILE, 'utf8')).installed;
  }
  throw new Error('GSC credentials not found: set GSC_CLIENT_ID/GSC_CLIENT_SECRET/GSC_REFRESH_TOKEN env vars or place creds at ' + LOCAL_CREDS_FILE);
}

let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry - 60_000) return cachedToken;

  const creds = resolveCreds();
  if (!creds.refresh_token) throw new Error('No GSC refresh_token available');

  const res = await fetch(creds.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(data));

  cachedToken = data.access_token;
  cachedTokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

async function gscFetch(path, init = {}) {
  const token = await getAccessToken();
  const res = await fetch(`https://searchconsole.googleapis.com${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`GSC API ${res.status}: ${json.error?.message || text}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

export async function listSites() {
  return gscFetch('/webmasters/v3/sites');
}

export async function listSitemaps(siteUrl) {
  return gscFetch(`/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`);
}

export async function searchAnalyticsQuery(siteUrl, body) {
  return gscFetch(
    `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export async function urlInspection(siteUrl, inspectionUrl) {
  return gscFetch('/v1/urlInspection/index:inspect', {
    method: 'POST',
    body: JSON.stringify({ inspectionUrl, siteUrl }),
  });
}
