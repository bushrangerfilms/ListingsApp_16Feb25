#!/usr/bin/env node
/**
 * Static file server with per-route prerender support and SPA fallback.
 *
 * We need a behaviour `serve` / `serve-handler` can't do in one config:
 *   - `/pricing` → serve `dist/pricing.html` if it exists
 *   - `/admin/login`, `/:orgSlug`, anything else → fall back to `dist/index.html`
 *     so React Router can take over on the client
 *
 * serve's `rewrites` run before its file lookup, so a catch-all `**` rewrite
 * swallows `/pricing` before `cleanUrls` can find `pricing.html`. Negation
 * globs don't compose with serve's minimatch the way we'd need. Easier to
 * write the 40 lines of Node than work around that.
 */
import { createServer } from "node:http";
import { stat, readFile } from "node:fs/promises";
import { join, extname, resolve } from "node:path";

const PORT = Number(process.env.PORT) || 5000;
const DIST = resolve(process.cwd(), "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

async function tryFile(path) {
  try {
    const s = await stat(path);
    if (s.isFile()) return path;
  } catch {
    /* not found */
  }
  return null;
}

async function resolveRequest(pathname) {
  // Strip query string already done by URL parse; decode percent-encoding.
  let p = decodeURIComponent(pathname);
  if (p.includes("\0") || p.includes("..")) return null; // path traversal guard

  // Normalise trailing slash: /pricing/ → /pricing
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);

  // 1. Exact file (e.g. /favicon.png, /assets/foo.js)
  const direct = join(DIST, p);
  if (await tryFile(direct)) return direct;

  // 2. Clean-url variant: /pricing → dist/pricing.html
  if (!extname(p)) {
    const html = join(DIST, p + ".html");
    if (await tryFile(html)) return html;
  }

  // 3. Directory index: /foo → dist/foo/index.html (kept for compatibility)
  const dirIndex = join(DIST, p, "index.html");
  if (await tryFile(dirIndex)) return dirIndex;

  // 4. SPA fallback: anything else → dist/index.html
  return join(DIST, "index.html");
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const file = await resolveRequest(url.pathname);
    if (!file) {
      res.writeHead(400).end("Bad Request");
      return;
    }
    const body = await readFile(file);
    const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": body.length,
      "Cache-Control": file.endsWith("index.html")
        ? "no-cache"
        : "public, max-age=3600",
    });
    res.end(body);
  } catch (err) {
    console.error("[serve] error:", err);
    res.writeHead(500).end("Internal Server Error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[serve] listening on :${PORT}, root = ${DIST}`);
});
