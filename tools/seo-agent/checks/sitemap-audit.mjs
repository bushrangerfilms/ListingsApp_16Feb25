#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../config/checks.json', import.meta.url), 'utf8'));
const SITEMAP_URL = `https://${config.site.domain}/sitemap.xml`;
const EXPECTED_ROUTES = config.site.marketing_routes;

const findings = [];

async function loadLiveSitemap() {
  const res = await fetch(SITEMAP_URL);
  if (!res.ok) {
    findings.push({ severity: 'error', kind: 'sitemap_unreachable', detail: `${SITEMAP_URL} returned ${res.status}` });
    return null;
  }
  return res.text();
}

const xml = await loadLiveSitemap();
const liveUrls = [];
if (xml) {
  const matches = xml.match(/<loc>([^<]+)<\/loc>/g) || [];
  for (const m of matches) liveUrls.push(m.replace(/<\/?loc>/g, '').trim());
}

const livePathsSet = new Set(liveUrls.map(u => {
  try { return new URL(u).pathname; } catch { return u; }
}));

const expectedSet = new Set(EXPECTED_ROUTES);

const missing = [...expectedSet].filter(r => !livePathsSet.has(r));
const extra = [...livePathsSet].filter(r => !expectedSet.has(r));

if (missing.length) {
  findings.push({
    severity: 'warning',
    kind: 'sitemap_missing_routes',
    detail: `Routes in config but not in sitemap: ${missing.join(', ')}`,
    auto_fix: 'add_to_sitemap',
    routes: missing,
  });
}
if (extra.length) {
  findings.push({
    severity: 'info',
    kind: 'sitemap_extra_routes',
    detail: `Routes in sitemap but not in config (may be intentional): ${extra.join(', ')}`,
  });
}

const robotsRes = await fetch(`https://${config.site.domain}/robots.txt`);
const robotsText = await robotsRes.text();
const hasSitemapLine = /^Sitemap:\s*https?:\/\//im.test(robotsText);
if (!hasSitemapLine) {
  findings.push({
    severity: 'warning',
    kind: 'robots_missing_sitemap_line',
    detail: 'robots.txt does not reference sitemap.xml',
    auto_fix: 'add_robots_sitemap_line',
  });
}

const socialsRobotsRes = await fetch('https://socials.autolisting.io/robots.txt');
if (socialsRobotsRes.ok) {
  const socialsRobots = await socialsRobotsRes.text();
  if (!/Disallow:\s*\//.test(socialsRobots) && !/noindex/i.test(socialsRobots)) {
    findings.push({
      severity: 'info',
      kind: 'socials_robots_permissive',
      detail: 'socials.autolisting.io is admin app — verify robots.txt is intentionally permissive (HTML noindex meta should still apply)',
    });
  }
}

const appRobotsRes = await fetch('https://app.autolisting.io/robots.txt');
if (appRobotsRes.ok) {
  const appRobots = await appRobotsRes.text();
  if (!/Disallow:\s*\//.test(appRobots) && !/noindex/i.test(appRobots)) {
    findings.push({
      severity: 'info',
      kind: 'app_robots_permissive',
      detail: 'app.autolisting.io is admin app — verify robots.txt is intentionally permissive (HTML noindex meta should still apply)',
    });
  }
}

console.log(JSON.stringify({
  sitemap_url: SITEMAP_URL,
  live_urls_in_sitemap: liveUrls,
  expected_routes: EXPECTED_ROUTES,
  findings,
}, null, 2));
