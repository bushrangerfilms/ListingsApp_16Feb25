import { lazy, ComponentType } from 'react';

/**
 * Wraps React.lazy() with retry logic for stale chunk failures after deployment.
 * When a dynamic import fails (e.g. cached HTML references old chunk hash),
 * it reloads the page once to get fresh assets.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const hasRefreshed = sessionStorage.getItem('lazyWithRetry-refresh');
    try {
      const module = await importFn();
      // Successful load — clear any previous refresh flag
      sessionStorage.removeItem('lazyWithRetry-refresh');
      return module;
    } catch (error) {
      if (!hasRefreshed) {
        sessionStorage.setItem('lazyWithRetry-refresh', 'true');
        window.location.reload();
        // Return a no-op component while the page reloads
        return { default: (() => null) as unknown as T };
      }
      // Already tried refreshing — let ErrorBoundary handle it
      sessionStorage.removeItem('lazyWithRetry-refresh');
      throw error;
    }
  });
}
