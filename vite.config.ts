import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import prerender from "@prerenderer/rollup-plugin";
import path from "path";

// Marketing routes prerendered at build time. Admin and org-public routes
// are deliberately NOT prerendered — doing so would leak autolisting.io
// identity into customer white-label bundles. See SEO_ROADMAP.md Phase 3.
const PRERENDER_ROUTES = [
  "/",
  "/pricing",
  "/features",
  "/support",
  "/privacy-policy",
  "/terms-conditions",
  "/cookie-policy",
];

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "0.0.0.0",
    port: 5000,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    allowedHosts: true,
  },
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        filesToDeleteAfterUpload: ["./dist/**/*.map"],
      },
      disable: !process.env.SENTRY_AUTH_TOKEN,
    }),
    // Prerender: headless Chromium visits each marketing route after build,
    // waits for React to hydrate, and writes the rendered HTML into
    // `dist/<route>/index.html` so non-JS crawlers (Bing, Perplexity, ChatGPT,
    // LinkedIn previews, Slack unfurls) see real content instead of an empty
    // SPA shell.
    //
    // `inject.marketing = true` sets `window.__PRERENDER_INJECTED.marketing`
    // before page scripts run, which `src/lib/domainDetection.ts` checks to
    // force the marketing branch during capture (the headless browser is
    // serving from localhost, which otherwise resolves to `admin`).
    prerender({
      routes: PRERENDER_ROUTES,
      renderer: "@prerenderer/renderer-puppeteer",
      rendererOptions: {
        inject: { marketing: true },
        renderAfterTime: 3000,
        maxConcurrentRoutes: 1,
        timeout: 60000,
        // Puppeteer launch options — Railway's build container runs as root
        // with no user namespaces, so --no-sandbox is required.
        launchOptions: {
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
          ],
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React + router (shared by all routes)
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Data fetching layer
          'vendor-query': ['@tanstack/react-query'],
          // Supabase client
          'vendor-supabase': ['@supabase/supabase-js'],
          // Charts (only used in analytics/admin pages)
          'vendor-charts': ['recharts'],
          // Drag-and-drop (only used in CRM kanban)
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
}));
