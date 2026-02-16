import type { SupabaseClient } from "@supabase/supabase-js";

export const FEATURE_FLAGS = {
  UK_LAUNCH: 'uk_launch',
  US_LAUNCH: 'us_launch',
  I18N_ENABLED: 'i18n_enabled',
  PILOT_MODE: 'pilot_mode',
  PUBLIC_SIGNUP_ENABLED: 'public_signup_enabled',
  MARKETING_VISIBLE: 'marketing_visible',
  BILLING_ENFORCEMENT: 'billing_enforcement',
} as const;

export const UK_LAUNCH_FLAG = FEATURE_FLAGS.UK_LAUNCH;
export const PILOT_MODE_FLAG = FEATURE_FLAGS.PILOT_MODE;
export const PUBLIC_SIGNUP_FLAG = FEATURE_FLAGS.PUBLIC_SIGNUP_ENABLED;
export const MARKETING_VISIBLE_FLAG = FEATURE_FLAGS.MARKETING_VISIBLE;
export const BILLING_ENFORCEMENT_FLAG = FEATURE_FLAGS.BILLING_ENFORCEMENT;

export type FeatureFlagKey = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS];

export async function isFeatureEnabled(
  supabase: SupabaseClient,
  flagKey: string,
  _organizationId?: string
): Promise<boolean> {
  const { data: flag, error: flagError } = await (supabase as any)
    .from("feature_flags")
    .select("id, key, default_state, is_active")
    .eq("key", flagKey)
    .single();

  if (flagError || !flag) {
    return false;
  }

  return flag.is_active && (flag.default_state ?? false);
}

export async function getFeatureFlags(
  supabase: SupabaseClient,
  _organizationId?: string
): Promise<Record<string, boolean>> {
  const { data: flags } = await (supabase as any)
    .from("feature_flags")
    .select("id, key, default_state, is_active");

  if (!flags) return {};

  const result: Record<string, boolean> = {};

  for (const flag of flags) {
    result[flag.key] = flag.is_active && (flag.default_state ?? false);
  }

  return result;
}
