import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import { seedLocaleFromGeo } from "./lib/geo/seedLocale";
import App from "./App.tsx";
import "./index.css";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  tracesSampleRate: 0.1,
  ignoreErrors: [
    "Failed to fetch",
    "Load failed",
    "NetworkError",
    "AbortError",
    "TypeError: cancelled",
    "ResizeObserver loop",
    "401",
    "403",
    "Not authenticated",
    "Navigation cancelled",
  ],
  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^moz-extension:\/\//i,
  ],
});

// DEBUG: Intercept ALL sonner toast calls to find {} toast source
import { toast as _debugToast } from 'sonner';
(['error', 'success', 'warning', 'info', 'message', 'loading'] as const).forEach((method) => {
  const orig = (_debugToast as Record<string, Function>)[method];
  if (orig) {
    (_debugToast as Record<string, Function>)[method] = (...args: unknown[]) => {
      const argStr = args.map(a => {
        try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch { return String(a); }
      }).join(', ');
      console.warn(`\n🔴 TOAST.${method.toUpperCase()} CALLED 🔴\nArgs: ${argStr}\nType of arg[0]: ${typeof args[0]}\nArg[0] constructor: ${args[0]?.constructor?.name}\nStack:\n${new Error().stack}`);
      // Suppress empty/broken toasts
      if (!args[0] || argStr === '{}' || argStr === '""') {
        console.warn('🔴 SUPPRESSED empty toast');
        return;
      }
      return orig.apply(_debugToast, args);
    };
  }
});

seedLocaleFromGeo();
createRoot(document.getElementById("root")!).render(<App />);
