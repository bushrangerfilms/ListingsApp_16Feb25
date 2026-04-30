#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../config/checks.json', import.meta.url), 'utf8'));
const DOMAIN = config.site.domain;
const ROUTES = config.site.marketing_routes;
const CONCURRENCY = 8;

function extractLinks(html, baseUrl) {
  const links = new Set();
  const re = /<a[^>]*href=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;
    try { links.add(new URL(href, baseUrl).toString()); }
    catch { /* skip malformed */ }
  }
  return [...links];
}

async function head(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15_000) });
    if (res.status === 405 || res.status === 403) {
      const r2 = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15_000) });
      return { url, status: r2.status, ok: r2.ok };
    }
    return { url, status: res.status, ok: res.ok };
  } catch (e) {
    return { url, error: e.name === 'TimeoutError' ? 'timeout' : e.message };
  }
}

async function pool(items, fn, concurrency) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

const allLinks = new Set();
const linkSources = new Map();

for (const route of ROUTES) {
  const url = `https://${DOMAIN}${route}`;
  try {
    const res = await fetch(url);
    const html = await res.text();
    const links = extractLinks(html, url);
    for (const l of links) {
      allLinks.add(l);
      if (!linkSources.has(l)) linkSources.set(l, []);
      linkSources.get(l).push(route);
    }
  } catch (e) {
    /* skip */
  }
}

const linkArray = [...allLinks];
const checked = await pool(linkArray, head, CONCURRENCY);

const broken = checked.filter(r => r.error || (r.status && r.status >= 400)).map(r => ({
  ...r,
  found_on: linkSources.get(r.url) || [],
}));

console.log(JSON.stringify({
  total_links_checked: linkArray.length,
  broken_count: broken.length,
  broken,
}, null, 2));
