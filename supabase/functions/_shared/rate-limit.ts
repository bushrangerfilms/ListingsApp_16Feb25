// Shared rate limiting helper for edge functions
// Uses the existing `rate_limits` table directly instead of calling check-rate-limit via HTTP

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RateLimitConfig {
  /** Unique feature identifier (e.g., 'enhance-listing-copy') */
  feature: string;
  /** Max requests allowed within the window */
  maxRequests: number;
  /** Time window in minutes */
  windowMinutes: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: string;
}

/**
 * Check rate limit for a given identifier (user ID, org ID, or IP).
 * Uses the existing `rate_limits` table — stores identifier in `ip_address` column.
 * Fails open on errors (allows request but logs warning).
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const windowStart = new Date(
    Date.now() - config.windowMinutes * 60 * 1000
  ).toISOString();
  const defaultReset = new Date(
    Date.now() + config.windowMinutes * 60 * 1000
  ).toISOString();

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('rate_limits')
      .select('id, submission_count, window_start')
      .eq('client_slug', config.feature)
      .eq('ip_address', identifier)
      .gte('window_start', windowStart)
      .maybeSingle();

    if (fetchError) {
      console.warn(`Rate limit check failed for ${config.feature}:`, fetchError.message);
      return { allowed: true, remaining: config.maxRequests, resetTime: defaultReset };
    }

    if (existing) {
      const resetTime = new Date(
        new Date(existing.window_start).getTime() + config.windowMinutes * 60 * 1000
      ).toISOString();

      if (existing.submission_count >= config.maxRequests) {
        return { allowed: false, remaining: 0, resetTime };
      }

      await supabase
        .from('rate_limits')
        .update({ submission_count: existing.submission_count + 1 })
        .eq('id', existing.id);

      return {
        allowed: true,
        remaining: config.maxRequests - (existing.submission_count + 1),
        resetTime,
      };
    }

    // No existing record — create one
    await supabase.from('rate_limits').insert({
      client_slug: config.feature,
      ip_address: identifier,
      submission_count: 1,
      window_start: new Date().toISOString(),
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: defaultReset,
    };
  } catch (err) {
    console.warn(`Rate limit error for ${config.feature}:`, err);
    return { allowed: true, remaining: config.maxRequests, resetTime: defaultReset };
  }
}
