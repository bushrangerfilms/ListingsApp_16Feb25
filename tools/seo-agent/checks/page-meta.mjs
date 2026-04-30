#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../config/checks.json', import.meta.url), 'utf8'));
const DOMAIN = config.site.domain;
const ROUTES = config.site.marketing_routes;

function extractTag(html, regex) {
  const m = html.match(regex);
  return m ? m[1].trim() : null;
}

function extractAllJsonLd(html) {
  const blocks = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try { blocks.push(JSON.parse(m[1].trim())); }
    catch (e) { blocks.push({ _parse_error: e.message, raw: m[1].trim().slice(0, 200) }); }
  }
  return blocks;
}

const results = [];
for (const route of ROUTES) {
  const url = `https://${DOMAIN}${route}`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const html = await res.text();

    const title = extractTag(html, /<title[^>]*>([^<]*)<\/title>/i);
    const description = extractTag(html, /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    const ogTitle = extractTag(html, /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
    const ogDescription = extractTag(html, /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
    const ogImage = extractTag(html, /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i);
    const ogUrl = extractTag(html, /<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']*)["']/i);
    const twitterCard = extractTag(html, /<meta[^>]*name=["']twitter:card["'][^>]*content=["']([^"']*)["']/i);
    const canonical = extractTag(html, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
    const robots = extractTag(html, /<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);
    const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
    const h1First = extractTag(html, /<h1[^>]*>([^<]*)<\/h1>/i);
    const jsonLd = extractAllJsonLd(html);

    const issues = [];
    if (!title) issues.push('missing_title');
    else if (title.length < 20) issues.push('title_too_short');
    else if (title.length > 65) issues.push('title_too_long');
    if (!description) issues.push('missing_description');
    else if (description.length < 50) issues.push('description_too_short');
    else if (description.length > 165) issues.push('description_too_long');
    if (!canonical) issues.push('missing_canonical');
    if (!ogTitle) issues.push('missing_og_title');
    if (!ogImage) issues.push('missing_og_image');
    if (h1Count === 0) issues.push('missing_h1');
    if (h1Count > 1) issues.push('multiple_h1');
    if (jsonLd.length === 0) issues.push('missing_json_ld');
    if (jsonLd.some(b => b._parse_error)) issues.push('json_ld_parse_error');
    if (robots && /noindex/i.test(robots)) issues.push('noindex_set');

    results.push({
      route,
      url,
      status: res.status,
      title,
      title_length: title?.length,
      description,
      description_length: description?.length,
      og_title: ogTitle,
      og_description: ogDescription,
      og_image: ogImage,
      og_url: ogUrl,
      twitter_card: twitterCard,
      canonical,
      robots_meta: robots,
      h1_count: h1Count,
      h1_first: h1First,
      json_ld_blocks: jsonLd.length,
      json_ld: jsonLd,
      issues,
    });
  } catch (e) {
    results.push({ route, url, error: e.message });
  }
}

console.log(JSON.stringify({ domain: DOMAIN, results }, null, 2));
