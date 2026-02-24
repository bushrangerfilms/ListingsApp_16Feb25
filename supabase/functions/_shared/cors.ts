// Shared CORS configuration for edge functions
// Restricts Access-Control-Allow-Origin to known domains instead of wildcard '*'

const ALLOWED_ORIGINS = new Set([
  'https://app.autolisting.io',
  'https://autolisting.io',
  'https://www.autolisting.io',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
]);

/**
 * Returns CORS headers with origin restricted to allowed domains.
 * If the request origin isn't in the allowed list, defaults to the primary app origin.
 * The browser will block cross-origin requests from non-matching origins.
 */
export function getCorsHeaders(
  requestOrigin?: string | null,
  extraHeaders?: string
): Record<string, string> {
  const origin =
    requestOrigin && ALLOWED_ORIGINS.has(requestOrigin)
      ? requestOrigin
      : 'https://app.autolisting.io';

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': `authorization, x-client-info, apikey, content-type${extraHeaders ? ', ' + extraHeaders : ''}`,
    'Vary': 'Origin',
  };
}

/**
 * CORS headers for public/webhook endpoints that need unrestricted access.
 * Use sparingly — only for: lead-magnet-api, stripe-webhook, topaz-webhook,
 * get-public-listings, and other truly public endpoints.
 */
export const publicCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
