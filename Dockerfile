# ---- Build stage ----
# Full Debian-based node image — needed because the build runs headless
# Chromium (via puppeteer) at the `vite build` step to prerender the
# marketing routes. See vite.config.ts + SEO_ROADMAP.md Phase 3.
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Chromium runtime dependencies required by puppeteer's bundled browser.
# Keeping this list tight: just what Chromium needs to start, nothing more.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    wget \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# Bust Docker cache for source files on every deploy
ARG RAILWAY_GIT_COMMIT_SHA
COPY . .

# Vite inlines VITE_* env vars at build time
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SOCIALS_HUB_URL
ARG VITE_APP_DOMAIN
ARG VITE_SENTRY_DSN
ARG VITE_BILLING_EXEMPT_ORG_IDS
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT

RUN npm run build

# ---- Runtime stage ----
# Slim image; only needs `serve` and the built dist/.
FROM node:20-bookworm-slim AS runtime

WORKDIR /app

RUN npm install -g serve@14

COPY --from=builder /app/dist ./dist

ENV PORT=5000
EXPOSE 5000

CMD ["serve", "dist", "-s", "-l", "5000"]
