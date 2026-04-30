#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import '../lib/env.mjs';

const config = JSON.parse(readFileSync(new URL('../config/checks.json', import.meta.url), 'utf8'));
const DOMAIN = config.site.domain;
const ROUTES = config.site.marketing_routes;

const PSI_KEY = process.env.PSI_API_KEY || '';
const PSI_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

async function fetchPSI(url, strategy) {
  const params = new URLSearchParams({ url, strategy });
  for (const c of ['performance', 'seo', 'accessibility', 'best-practices']) {
    params.append('category', c);
  }
  if (PSI_KEY) params.set('key', PSI_KEY);

  const res = await fetch(`${PSI_BASE}?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PSI ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

function summarise(data, strategy) {
  const lr = data.lighthouseResult || {};
  const cats = lr.categories || {};
  const audits = lr.audits || {};
  const lcp = audits['largest-contentful-paint']?.numericValue;
  const cls = audits['cumulative-layout-shift']?.numericValue;
  const inp = audits['interaction-to-next-paint']?.numericValue;
  const tbt = audits['total-blocking-time']?.numericValue;
  const fcp = audits['first-contentful-paint']?.numericValue;
  const speedIndex = audits['speed-index']?.numericValue;
  const issues = [];
  if (lcp && lcp > config.thresholds.cwv_lcp_warning_ms) issues.push({ metric: 'lcp', value: Math.round(lcp), threshold: config.thresholds.cwv_lcp_warning_ms });
  if (cls && cls > config.thresholds.cwv_cls_warning) issues.push({ metric: 'cls', value: Number(cls.toFixed(3)), threshold: config.thresholds.cwv_cls_warning });
  if (inp && inp > config.thresholds.cwv_inp_warning_ms) issues.push({ metric: 'inp', value: Math.round(inp), threshold: config.thresholds.cwv_inp_warning_ms });
  return {
    strategy,
    perf_score: cats.performance?.score != null ? Math.round(cats.performance.score * 100) : null,
    seo_score: cats.seo?.score != null ? Math.round(cats.seo.score * 100) : null,
    a11y_score: cats.accessibility?.score != null ? Math.round(cats.accessibility.score * 100) : null,
    best_practices_score: cats['best-practices']?.score != null ? Math.round(cats['best-practices'].score * 100) : null,
    lcp_ms: lcp ? Math.round(lcp) : null,
    cls,
    inp_ms: inp ? Math.round(inp) : null,
    tbt_ms: tbt ? Math.round(tbt) : null,
    fcp_ms: fcp ? Math.round(fcp) : null,
    speed_index_ms: speedIndex ? Math.round(speedIndex) : null,
    issues,
  };
}

const results = [];
for (const route of ROUTES) {
  const url = `https://${DOMAIN}${route}`;
  const entry = { route, url };
  for (const strategy of ['mobile', 'desktop']) {
    try {
      const data = await fetchPSI(url, strategy);
      entry[strategy] = summarise(data, strategy);
    } catch (e) {
      entry[strategy] = { error: e.message };
    }
  }
  results.push(entry);
}

console.log(JSON.stringify({ domain: DOMAIN, results, has_api_key: !!PSI_KEY }, null, 2));
