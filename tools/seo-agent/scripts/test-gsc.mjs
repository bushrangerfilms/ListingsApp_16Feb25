#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const CREDS_FILE = '/Users/bushrangerfilms/Documents/Claude/.env.gsc-oauth.json';
const creds = JSON.parse(readFileSync(CREDS_FILE, 'utf8')).installed;

if (!creds.refresh_token) {
  console.error('No refresh_token. Run auth-oauth.mjs first.');
  process.exit(1);
}

const tokenRes = await fetch(creds.token_uri, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    refresh_token: creds.refresh_token,
    grant_type: 'refresh_token',
  }),
});

const { access_token, error_description, error } = await tokenRes.json();
if (!access_token) {
  console.error('Token refresh failed:', error, error_description);
  process.exit(1);
}

console.log('✓ Access token minted\n');

const sitesRes = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites', {
  headers: { Authorization: `Bearer ${access_token}` },
});
const sites = await sitesRes.json();
console.log('GSC properties:');
console.log(JSON.stringify(sites, null, 2));

const sitemapsRes = await fetch(
  'https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain:autolisting.io/sitemaps',
  { headers: { Authorization: `Bearer ${access_token}` } }
);
const sitemaps = await sitemapsRes.json();
console.log('\nSitemaps for autolisting.io:');
console.log(JSON.stringify(sitemaps, null, 2));

const today = new Date();
const end = today.toISOString().slice(0, 10);
const startDate = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const queryRes = await fetch(
  'https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain:autolisting.io/searchAnalytics/query',
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate,
      endDate: end,
      dimensions: ['query'],
      rowLimit: 10,
    }),
  }
);
const queries = await queryRes.json();
console.log(`\nTop 10 queries last 28 days (${startDate} → ${end}):`);
console.log(JSON.stringify(queries, null, 2));
