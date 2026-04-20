#!/usr/bin/env node
/**
 * Post-build: rename `dist/<route>/index.html` to `dist/<route>.html` for each
 * prerendered marketing route (excluding `/`).
 *
 * Why: vercel/serve's rewrite rule `{source: "**", destination: "/index.html"}`
 * catches directory paths (e.g. `/pricing/`) before serve-handler finds the
 * directory's index.html, so `/pricing` ends up serving the SPA shell instead
 * of the prerendered page. Flattening to `dist/pricing.html` + `cleanUrls: true`
 * in serve.json sidesteps this — serve finds the `.html` file at step 1 of its
 * resolution, before any rewrite runs.
 *
 * Keep `dist/index.html` in place (it's the prerender output for `/`, with
 * identity tags stripped by the prerender postProcess hook — safe to serve
 * as the SPA fallback on every domain, including custom org domains).
 */

import { rename, rmdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROUTES = [
  "pricing",
  "features",
  "support",
  "privacy-policy",
  "terms-conditions",
  "cookie-policy",
];

const DIST = "dist";

for (const route of ROUTES) {
  const dir = join(DIST, route);
  const src = join(dir, "index.html");
  const dest = join(DIST, `${route}.html`);

  if (!existsSync(src)) {
    console.warn(`[flatten] skip: ${src} does not exist`);
    continue;
  }

  await rename(src, dest);
  await rmdir(dir);
  console.log(`[flatten] ${src} -> ${dest}`);
}
