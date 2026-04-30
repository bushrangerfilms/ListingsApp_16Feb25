# SEO Maintenance Agent

A fortnightly remote Claude Code agent that monitors and maintains SEO health for `autolisting.io`. Runs in Anthropic's cloud via a `/schedule` routine, opens GitHub issues for findings, opens auto-fix PRs for sitemap/robots drift, and (optionally) emails a digest.

**Scope:** `autolisting.io` marketing pages only. Customer custom domains (e.g. `bridgeauctioneers.ie`) are explicitly out of scope.

## Layout

```
tools/seo-agent/
├── AGENT.md             # The master prompt the remote agent follows on every run
├── README.md            # This file
├── config/
│   ├── keywords.json    # Target keyword clusters (edit freely; agent reads at runtime)
│   └── checks.json      # Allowlists, thresholds, recipients
├── lib/
│   ├── env.mjs          # Loads ~/.env.seo-agent locally; passthrough remotely
│   ├── gsc-client.mjs   # Search Console API client (env vars or local creds)
│   └── email.mjs        # Resend helper (unused; remote agent uses Gmail MCP)
├── checks/              # Self-contained check helpers — each emits JSON to stdout
│   ├── gsc-snapshot.mjs # GSC queries, top pages, target keyword coverage, striking distance
│   ├── sitemap-audit.mjs # sitemap.xml drift vs config; robots.txt sanity
│   ├── page-meta.mjs    # title, description, canonical, og:*, JSON-LD per route
│   ├── cwv.mjs          # Core Web Vitals via PageSpeed Insights API
│   └── link-check.mjs   # Crawls marketing pages, HEADs every link
├── run-all-checks.mjs   # Runs all checks in parallel, writes reports/<ts>/_aggregate.json
├── scripts/             # Local-only one-time setup utilities (do not run remotely)
│   ├── auth-oauth.mjs   # First-time OAuth flow to obtain refresh token
│   └── test-gsc.mjs     # Smoke test that the GSC API is reachable
└── reports/             # Per-run output (gitignored — local artifacts)
```

## How credentials are resolved

Each helper that needs credentials checks env vars first, then falls back to local files:

| Service | Env vars (preferred) | Local fallback |
|---|---|---|
| Google Search Console | `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_REFRESH_TOKEN` | `~/Documents/Claude/.env.gsc-oauth.json` |
| PageSpeed Insights | `PSI_API_KEY` | `~/Documents/Claude/.env.seo-agent` |
| Resend (optional) | `RESEND_API_KEY` | `~/Documents/Claude/.env.seo-agent` |

For local development: keep credentials in the local files. For the scheduled remote run: env vars are exported by the routine prompt.

## Running locally

```bash
cd tools/seo-agent
node run-all-checks.mjs
# JSON summary to stdout; full per-check reports under reports/<timestamp>/
```

To inspect just one check:
```bash
node checks/gsc-snapshot.mjs | jq
node checks/cwv.mjs | jq
```

## First-time OAuth (already done — only re-run if credentials are revoked)

```bash
node scripts/auth-oauth.mjs
```

Opens browser, captures refresh token, saves to `~/Documents/Claude/.env.gsc-oauth.json`.

## Scheduled runs

A `/schedule` routine (see https://claude.ai/code/routines) clones this repo and runs the agent fortnightly. The agent reads `AGENT.md` for instructions on what to do each run. Check `RUN_LOG.md` for a record of past runs.

## Editing the keyword list

Edit `config/keywords.json` — the agent reads it on every run. Add to existing clusters or create new ones. Cluster keys starting with `_` are ignored (used for comments).

## Editing the autofix allowlist

Edit `config/checks.json` → `auto_fix_allowlist`. Files outside this list are NEVER touched by the agent in a fortnightly autofix PR — if it spots an issue in a non-allowlisted file, it raises it in the issue for human review.
