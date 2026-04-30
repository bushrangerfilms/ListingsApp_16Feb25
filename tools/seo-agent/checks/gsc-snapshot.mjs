#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { searchAnalyticsQuery, listSitemaps } from '../lib/gsc-client.mjs';

const config = JSON.parse(readFileSync(new URL('../config/checks.json', import.meta.url), 'utf8'));
const keywordsConfig = JSON.parse(readFileSync(new URL('../config/keywords.json', import.meta.url), 'utf8'));

const SITE = config.site.gsc_property;
const LOOKBACK = config.lookback_days;
const TARGET_KEYWORDS = Object.entries(keywordsConfig)
  .filter(([k]) => !k.startsWith('_'))
  .flatMap(([, v]) => v)
  .map(k => k.toLowerCase());

const today = new Date();
const endDate = today.toISOString().slice(0, 10);
const startDate = new Date(today.getTime() - LOOKBACK * 86_400_000).toISOString().slice(0, 10);
const prevEndDate = new Date(today.getTime() - LOOKBACK * 86_400_000 - 86_400_000).toISOString().slice(0, 10);
const prevStartDate = new Date(today.getTime() - 2 * LOOKBACK * 86_400_000).toISOString().slice(0, 10);

async function safeQuery(label, body) {
  try { return await searchAnalyticsQuery(SITE, body); }
  catch (e) { return { _error: e.message, _label: label }; }
}

const [topQueries, topPages, queriesByCountry, prevTopQueries, sitemaps] = await Promise.all([
  safeQuery('topQueries', { startDate, endDate, dimensions: ['query'], rowLimit: 200 }),
  safeQuery('topPages', { startDate, endDate, dimensions: ['page'], rowLimit: 100 }),
  safeQuery('queriesByCountry', { startDate, endDate, dimensions: ['query', 'country'], rowLimit: 500 }),
  safeQuery('prevTopQueries', { startDate: prevStartDate, endDate: prevEndDate, dimensions: ['query'], rowLimit: 200 }),
  listSitemaps(SITE).catch(e => ({ _error: e.message })),
]);

const currentRows = topQueries.rows || [];
const prevRows = prevTopQueries.rows || [];
const prevByQuery = new Map(prevRows.map(r => [r.keys[0].toLowerCase(), r]));

function classify(row) {
  const pos = row.position;
  if (pos <= 3) return 'page1_top';
  if (pos <= 10) return 'page1';
  if (pos >= config.thresholds.striking_distance_min_position
      && pos <= config.thresholds.striking_distance_max_position
      && row.impressions >= config.thresholds.striking_distance_min_impressions) return 'striking_distance';
  return 'deep';
}

const queryAnalysis = currentRows.map(r => {
  const q = r.keys[0].toLowerCase();
  const prev = prevByQuery.get(q);
  const movement = prev ? prev.position - r.position : null;
  return {
    query: r.keys[0],
    impressions: r.impressions,
    clicks: r.clicks,
    ctr: r.ctr,
    position: r.position,
    bucket: classify(r),
    is_target_keyword: TARGET_KEYWORDS.includes(q),
    movement_vs_prev_period: movement,
    big_movement: movement !== null && Math.abs(movement) >= config.thresholds.rank_movement_alert,
  };
});

const targetKeywordCoverage = TARGET_KEYWORDS.map(kw => {
  const found = currentRows.find(r => r.keys[0].toLowerCase() === kw);
  return found
    ? { keyword: kw, found: true, position: found.position, impressions: found.impressions, clicks: found.clicks }
    : { keyword: kw, found: false };
});

const strikingDistance = queryAnalysis
  .filter(q => q.bucket === 'striking_distance')
  .sort((a, b) => b.impressions - a.impressions);

const contentGaps = targetKeywordCoverage.filter(k => !k.found);

const output = {
  site: SITE,
  date_range: { startDate, endDate },
  prev_date_range: { startDate: prevStartDate, endDate: prevEndDate },
  totals: {
    queries_returned: currentRows.length,
    target_keywords_tracked: TARGET_KEYWORDS.length,
    target_keywords_found: targetKeywordCoverage.filter(k => k.found).length,
    striking_distance_count: strikingDistance.length,
    content_gap_count: contentGaps.length,
  },
  sitemaps: sitemaps,
  top_pages: (topPages.rows || []).slice(0, 20),
  striking_distance: strikingDistance,
  content_gaps: contentGaps,
  big_movements: queryAnalysis.filter(q => q.big_movement),
  target_keyword_coverage: targetKeywordCoverage,
  raw_top_queries: currentRows.slice(0, 50),
};

console.log(JSON.stringify(output, null, 2));
