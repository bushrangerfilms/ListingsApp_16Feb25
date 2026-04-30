#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const PUBLIC_DIR = path.join(REPO_ROOT, 'public');

const config = JSON.parse(readFileSync(new URL('../config/checks.json', import.meta.url), 'utf8'));
const DOMAIN = config.site.domain;
const ROUTES = config.site.marketing_routes;
const T = config.thresholds;
const SIZE_WARN_KB = T.image_size_warning_kb ?? 100;
const SIZE_CRITICAL_KB = T.image_size_critical_kb ?? 500;

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);

async function walk(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, acc);
    else if (IMAGE_EXTS.has(path.extname(e.name).toLowerCase())) acc.push(p);
  }
  return acc;
}

const images = await walk(PUBLIC_DIR).catch(() => []);

const inventory = images.map(p => {
  const size = statSync(p).size;
  const rel = path.relative(REPO_ROOT, p);
  const ext = path.extname(p).toLowerCase();
  const isModernFormat = ext === '.webp' || ext === '.avif';
  const sizeKb = Math.round(size / 1024);
  let severity = 'info';
  if (sizeKb >= SIZE_CRITICAL_KB) severity = 'critical';
  else if (sizeKb >= SIZE_WARN_KB) severity = 'warning';
  return { path: rel, size_bytes: size, size_kb: sizeKb, ext, modern_format: isModernFormat, severity };
}).sort((a, b) => b.size_bytes - a.size_bytes);

const oversized = inventory.filter(i => i.severity !== 'info');

const liveImageRefs = new Map();
for (const route of ROUTES) {
  try {
    const res = await fetch(`https://${DOMAIN}${route}`, { redirect: 'follow' });
    const html = await res.text();
    const re = /<img[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const tag = m[0];
      const src = m[1];
      const hasLazy = /loading=["']lazy["']/i.test(tag);
      const hasFetchPriority = /fetchpriority=["']high["']/i.test(tag);
      const hasWidth = /\bwidth=/i.test(tag);
      const hasHeight = /\bheight=/i.test(tag);
      const hasAlt = /\balt=/i.test(tag);
      const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
      const alt = altMatch ? altMatch[1] : null;
      let key = src;
      if (!liveImageRefs.has(key)) liveImageRefs.set(key, { src, refs: [] });
      liveImageRefs.get(key).refs.push({
        route,
        has_lazy: hasLazy,
        has_fetchpriority_high: hasFetchPriority,
        has_dimensions: hasWidth && hasHeight,
        has_alt: hasAlt,
        alt,
        tag_excerpt: tag.length > 200 ? tag.slice(0, 200) + '…' : tag,
      });
    }
  } catch (e) {
    /* skip route on fetch error */
  }
}

const findings = [];

for (const img of oversized) {
  findings.push({
    severity: img.severity,
    kind: 'oversized_image',
    detail: `${img.path} is ${img.size_kb} KB (${img.ext.toUpperCase().slice(1)}). Recommend converting to WebP/AVIF and serving multiple sizes via <picture>.`,
    file: img.path,
    size_kb: img.size_kb,
  });
}

for (const [key, entry] of liveImageRefs) {
  const refs = entry.refs;
  const allMissingAlt = refs.every(r => !r.has_alt);
  if (allMissingAlt) {
    findings.push({
      severity: 'warning',
      kind: 'missing_alt',
      detail: `<img src="${entry.src}"> has no alt attribute (found on ${refs.length} route(s): ${refs.map(r => r.route).join(', ')}). Add a meaningful alt text or empty alt="" if decorative.`,
      src: entry.src,
    });
  }
  const allMissingDims = refs.every(r => !r.has_dimensions);
  if (allMissingDims) {
    findings.push({
      severity: 'info',
      kind: 'missing_dimensions',
      detail: `<img src="${entry.src}"> is missing width/height attributes (found on ${refs.length} route(s)). Setting these prevents CLS during image load.`,
      src: entry.src,
    });
  }
}

console.log(JSON.stringify({
  public_dir: path.relative(REPO_ROOT, PUBLIC_DIR),
  total_images: inventory.length,
  total_size_kb: inventory.reduce((s, i) => s + i.size_kb, 0),
  oversized_count: oversized.length,
  modern_format_count: inventory.filter(i => i.modern_format).length,
  inventory: inventory.slice(0, 30),
  live_image_refs: Array.from(liveImageRefs.values()).slice(0, 50),
  findings,
}, null, 2));
