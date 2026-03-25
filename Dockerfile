FROM node:20-slim

WORKDIR /app

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

ENV PORT=5000
EXPOSE 5000

CMD ["npx", "serve", "dist", "-s", "-l", "5000"]
