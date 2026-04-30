#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { urlInspection } from '../lib/gsc-client.mjs';

const config = JSON.parse(readFileSync(new URL('../config/checks.json', import.meta.url), 'utf8'));
const SITE = config.site.gsc_property;
const ROUTES = config.site.marketing_routes;
const ORIGIN = `https://${config.site.domain}`;

async function inspect(route) {
  const url = `${ORIGIN}${route}`;
  try {
    const res = await urlInspection(SITE, url);
    const ir = res.inspectionResult || {};
    const ix = ir.indexStatusResult || {};
    const mu = ir.mobileUsabilityResult || {};
    return {
      route,
      url,
      verdict: ix.verdict,
      coverage_state: ix.coverageState,
      indexing_state: ix.indexingState,
      last_crawl_time: ix.lastCrawlTime,
      page_fetch_state: ix.pageFetchState,
      robots_txt_state: ix.robotsTxtState,
      crawled_as: ix.crawledAs,
      google_canonical: ix.googleCanonical,
      user_canonical: ix.userCanonical,
      mobile_usability_verdict: mu.verdict,
      mobile_usability_issues: (mu.issues || []).length,
      inspection_link: ir.inspectionResultLink,
    };
  } catch (e) {
    return { route, url, error: e.message, status: e.status };
  }
}

const results = [];
for (const route of ROUTES) {
  results.push(await inspect(route));
}

const not_indexed = results.filter(r => r.verdict && r.verdict !== 'PASS' && !r.error);
const errors = results.filter(r => r.error);

const findings = [];
for (const r of not_indexed) {
  findings.push({
    severity: r.coverage_state?.startsWith('Crawled') ? 'info' : 'warning',
    kind: 'page_not_indexed',
    route: r.route,
    detail: `${r.verdict}: ${r.coverage_state || 'unknown'} (state: ${r.indexing_state || 'unknown'})`,
  });
}
for (const r of results.filter(r => r.user_canonical && r.google_canonical && r.user_canonical !== r.google_canonical && !r.error)) {
  findings.push({
    severity: 'warning',
    kind: 'canonical_mismatch',
    route: r.route,
    detail: `User-declared canonical (${r.user_canonical}) does not match Google's chosen canonical (${r.google_canonical})`,
  });
}
for (const r of results.filter(r => r.mobile_usability_issues > 0 && !r.error)) {
  findings.push({
    severity: 'warning',
    kind: 'mobile_usability_issues',
    route: r.route,
    detail: `${r.mobile_usability_issues} mobile usability issue(s) reported by GSC`,
  });
}

console.log(JSON.stringify({
  site: SITE,
  origin: ORIGIN,
  routes_checked: ROUTES.length,
  results,
  errors,
  findings,
}, null, 2));
