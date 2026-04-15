# SEO Roadmap — autolisting.io

Origin: April 2026 audit from Equinox Consult scored the site 16/100. The audit is directionally correct but overstates the damage — Googlebot *does* execute our JavaScript and index the hydrated pages. The real problem is every non-Google crawler (Bing, Perplexity, ChatGPT, Claude, LinkedIn link previews, Slack unfurls) sees an empty `<div id="root">`.

This document is the plan to fix that, ordered by effort. No framework migration.

---

## ⚠️ Critical constraint: one shell, three domains

Per [CLAUDE.md](CLAUDE.md) and [src/lib/domainDetection.ts](src/lib/domainDetection.ts), the same `index.html` is served across three domain types:

| Domain | Type | Audience |
|---|---|---|
| `autolisting.io`, `www.autolisting.io` | **marketing** | Prospects; we want SEO |
| `app.autolisting.io` | **admin** | Logged-in customers; should not be indexed |
| Any custom org domain (e.g. `johnsmith-realty.com`) | **org-public** | The paying customer's own public listings site — white-labelled |

**Anything we bake into the static `index.html` ends up on all three.** That means identity-declaring tags — canonical, `og:url`, JSON-LD entity data, `<noscript>` branding — must NOT be hard-coded in the shell. They'd tell search engines that a customer's own custom-domain site is really `autolisting.io`, which would consolidate their SEO into our marketing page and hurt them.

Rule of thumb: if a change hard-codes `autolisting.io` and is not already shared across all three domains today, it belongs in [src/components/SEO.tsx](src/components/SEO.tsx) gated by `isMarketingSite()` from [src/lib/domainDetection.ts](src/lib/domainDetection.ts).

---

## Phase 1 — Static shell fixes that are safe on all three domains (~1 hour)

Safe, reversible, no build-pipeline changes. One PR.

### 1.1 Clean up `index.html`

File: [index.html](index.html)

- [x] **Delete the `<meta name="keywords">` tag.** Google has ignored it since 2009; its only effect today is signalling to auditors that the site was built without modern SEO in mind. Universally safe.
- [x] **Absolute `og:image` and `twitter:image` URLs** — `/autolisting-logo.png` → `https://autolisting.io/autolisting-logo.png`. Fixes LinkedIn/Facebook/Slack previews on the marketing domain and doesn't regress anywhere else (the same platform-logo file is served everywhere today).

**Deliberately NOT doing in the shell:**

- ❌ Default `<link rel="canonical">` — would consolidate custom org-public domains into `autolisting.io/`. Moved to Phase 2.
- ❌ `og:url` — same reason. Moved to Phase 2.
- ❌ Inline JSON-LD `Organization` / `SoftwareApplication` — declares entity identity; wrong on org-public domains. Moved to Phase 2.
- ❌ `<noscript>` block with AutoListing branding + marketing-page links — white-label violation on custom domains. Deferred to Phase 3 (prerender) where per-route HTML can differ per build output.

### 1.2 Public assets

- [x] **Create [public/sitemap.xml](public/sitemap.xml)** — static, hand-maintained. Lists the seven marketing routes only. Crawlers only consume it from `autolisting.io/sitemap.xml`; on other domains it's just an unread file in `dist/`.
- [x] **Update [public/robots.txt](public/robots.txt)** — append `Sitemap: https://autolisting.io/sitemap.xml`. Shared file, but the sitemap URL is absolute, so a Bingbot crawling `johnsmith-realty.com/robots.txt` is simply told "there's no sitemap for you here, the one referenced is on another domain". Harmless.
- [x] **Create [public/llms.txt](public/llms.txt)** — short markdown product brief. Same domain-leak characteristic as sitemap.xml (it's a file in `dist/` regardless of domain), but the content is a simple description of the platform. Acceptable.

### 1.3 Post-deploy verification

- [ ] `curl -s https://autolisting.io/` — confirm no `keywords` meta, absolute `og:image` URL.
- [ ] `curl -sI https://autolisting.io/sitemap.xml` — confirm `content-type: application/xml` (not the SPA shell).
- [ ] `curl -s https://autolisting.io/robots.txt` — confirm `Sitemap:` line present.
- [ ] Submit sitemap in Google Search Console + Bing Webmaster Tools.
- [ ] **Regression check:** open a custom org domain property page in Facebook Sharing Debugger. Image preview still works (no regression from relative → absolute image URL).

---

## Phase 2 — Domain-aware SEO component (~1-2 hours, second PR)

File: [src/components/SEO.tsx](src/components/SEO.tsx)

Make the SEO component the single source of truth for identity-declaring tags, and gate marketing-specific ones on `isMarketingSite()`.

- [ ] Import `isMarketingSite`, `isAdminSite`, `isPublicSite` from [src/lib/domainDetection.ts](src/lib/domainDetection.ts).
- [ ] **If marketing domain:**
  - Inject a per-route `<link rel="canonical">` using the current absolute URL (e.g. `https://autolisting.io/pricing`).
  - Inject `og:url` using the current absolute URL.
  - Inject JSON-LD `Organization` + `SoftwareApplication` blocks (the ones originally drafted for Phase 1).
  - Inject per-page JSON-LD where it adds value: `Offer`/`Product` for `PricingPage`, `SoftwareApplication.featureList` for `FeaturesPage`.
- [ ] **If admin domain:**
  - Inject `<meta name="robots" content="noindex, nofollow">`. Admin portal should not be in any index. (This is a real bug, not just a polish — `app.autolisting.io` currently serves `User-agent: * Allow: /` and has nothing stopping Bingbot from indexing `/admin/billing`.)
- [ ] **If org-public domain:**
  - Let the org-public page code continue to own its own meta tags (per-org branding, per-listing OG data). The SEO component must NOT inject `autolisting.io` canonicals here.
- [ ] **All domains:** audit the four marketing pages ([src/pages/marketing/](src/pages/marketing/)) and confirm each passes a unique `description`.

**Verification:**

- `curl -s https://autolisting.io/pricing` — after hydration, canonical points at `/pricing`, JSON-LD present.
- `curl -s https://app.autolisting.io/` — `robots: noindex, nofollow` present.
- `curl -s https://[a-real-org-custom-domain]/` — NO `autolisting.io` canonical, NO AutoListing Organization JSON-LD leaking in.

Note: all of these still only help crawlers that execute JavaScript (mainly Googlebot). Phase 3 is what fixes the non-JS crawler story.

---

## Phase 3 — Prerender at build time (~half a day, third PR) ⭐

**This is the real fix.** Everything above is cosmetic compared to this step.

- [x] Added [`@prerenderer/rollup-plugin`](https://github.com/Tofandel/prerenderer) + `puppeteer` (picked over `vite-plugin-prerender` because the former is actively maintained and slots cleanly into Vite's Rollup build).
- [x] Configured to prerender the seven marketing routes (`/`, `/pricing`, `/features`, `/support`, `/privacy-policy`, `/terms-conditions`, `/cookie-policy`).
- [x] At build time the plugin spins up a headless Chromium, visits each route, waits 3s for React to hydrate, and writes rendered HTML into `dist/pricing/index.html` etc.
- [x] **Hostname forcing** via `window.__PRERENDER_INJECTED.marketing = true` — set by the plugin's `inject` option before page scripts run, checked at the top of [src/lib/domainDetection.ts](src/lib/domainDetection.ts)'s `getDomainType()`. Forces the marketing branch even though the headless browser serves from localhost.
- [x] **Canonical/og:url origin override** — [src/components/SEO.tsx](src/components/SEO.tsx) substitutes `https://autolisting.io` for `window.location.origin` during prerender, so canonical/og:url don't get baked in as `http://127.0.0.1:8000/...`.
- [x] **Multi-stage Dockerfile** — build stage has full Debian + Chromium deps + puppeteer; runtime stage is `node:20-bookworm-slim` + `serve` + `dist/` only. Runtime image stays lean, build image gets whatever it needs. See [Dockerfile](Dockerfile).
- [x] **Pre-mount code audited:**
  - [src/lib/geo/seedLocale.ts](src/lib/geo/seedLocale.ts) skips entirely during prerender (the fire-and-forget IP lookup could trigger `window.location.reload()` mid-capture).
  - [src/App.tsx](src/App.tsx) `MarketingRoutes` skips the pilot-mode `window.location.href = '...'` redirect during prerender (found the hard way — "Promise was collected" puppeteer error).
- [ ] **`<noscript>` branding block** — deferred to a follow-up. The infrastructure is in place; adding a noscript block to the marketing route template is a small cosmetic improvement, not urgent now that the prerender itself is the non-JS crawler story.
- [x] **Local verification:** all 7 `dist/<route>/index.html` files contain unique titles, real `<h1>`s, full body copy, correct `https://autolisting.io/...` canonicals, JSON-LD, and no `robots: noindex`.
- [ ] **Post-deploy verify:** `curl -s https://autolisting.io/pricing | grep -i "per week"` after Railway deploy.

**This single change closes roughly 80% of the audit's real complaints** — non-JS crawlers now see full content, unique titles, unique descriptions, real H1s, and real body copy, and none of it leaks onto admin or org-public domains because only the marketing routes are prerendered.

---

## Phase 4 — Future hopes (not scheduled)

These are the audit's content and marketing recommendations. They are not engineering tasks and shouldn't be confused with the fixes above. Listed here so they aren't lost.

### Content marketing
- **Blog** at `autolisting.io/blog` — practical guides for Irish and UK auctioneers. Once Phase 3 is shipped, new blog posts get indexed properly.
- **Comparison pages** — "AutoListing vs Daft.ie Tools", "AutoListing vs MyHome Pro", "AutoListing vs Vendor Tool X". Highest-converting SaaS SEO pattern for bottom-of-funnel traffic.
- **Integration pages** — one page per meaningful integration (Supabase, Stripe, social platforms, etc.).
- **Case studies** — 2–3 real pilot customers with before/after numbers. Also doubles as sales collateral.

### Programmatic landing pages
- Template-driven pages at `/lead-generation-for-[agency-type]-[region]` covering every realistic permutation (auctioneers / estate agents / letting agents × Dublin / Cork / Galway / London / Manchester / etc.). Done well this compounds fastest; done badly Google penalises as spam. Needs unique data/content per page.

### Brand and authority signals
- LinkedIn company page, X account, YouTube product-demo channel.
- Listings on G2, Capterra, Product Hunt.
- Press / industry coverage (Irish Property Magazine, auctioneer associations, PropTech publications).
- Founder LinkedIn visibility linked from the About page.

### Technical polish (nice-to-have)
- **Real 404 handling** — currently `serve -s` returns HTTP 200 for every unknown path. Ideally return true 404 for unknown paths not in the sitemap. Requires switching to `caddy` or `nginx` with a custom config. Low priority.
- **Core Web Vitals audit** — run real Lighthouse + Search Console CWV report post-Phase-3.
- **Image optimisation** — the 1MB logo at `public/autolisting-logo.png` could be 50KB as a WebP.

---

## Explicitly deferred / not doing

The audit's implicit ask was a full rewrite in Next.js, Remix, or Astro. **We are not doing this.**

- Phase 3 (build-time prerender) achieves ~80% of the benefit for ~1% of the effort.
- A framework migration is months of work on a pilot-phase product with 2 active users and a shared Supabase architecture that's tightly coupled to the current Vite/React setup.
- If the business ever scales to the point where sub-second TTFB on marketing pages actually matters, reopen this decision then. Not now.

---

## Recommended PR order

1. **PR 1 — Phase 1** (static-shell safe subset). ✅ Drafted on `chore/seo-phase-1`.
2. **PR 2 — Phase 2** (domain-aware SEO.tsx). Needs visual QA on marketing, admin, and at least one real org-public domain.
3. **PR 3 — Phase 3** (prerender). Needs build testing, careful Railway deploy, post-deploy verification.
4. **Phase 4** — separate, ongoing work stream. Not engineering-led.
