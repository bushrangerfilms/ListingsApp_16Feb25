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

// DEBUG: Intercept sonner toast calls to find {} toast source
import { toast as _debugToast } from 'sonner';
const _origError = _debugToast.error;
const _origDefault = _debugToast;
_debugToast.error = (...args: unknown[]) => {
  console.trace('[TOAST DEBUG] toast.error called with:', args);
  return (_origError as Function).apply(_debugToast, args);
};
// Also intercept default toast()
const _origCall = Function.prototype.apply.bind(_debugToast);
// Monkey-patch via prototype — log all toast variants
(['success', 'warning', 'info', 'message'] as const).forEach((method) => {
  const orig = (_debugToast as Record<string, Function>)[method];
  if (orig) {
    (_debugToast as Record<string, Function>)[method] = (...args: unknown[]) => {
      console.trace(`[TOAST DEBUG] toast.${method} called with:`, args);
      return orig.apply(_debugToast, args);
    };
  }
});

seedLocaleFromGeo();
createRoot(document.getElementById("root")!).render(<App />);
