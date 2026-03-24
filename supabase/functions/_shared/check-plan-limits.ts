import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

export interface PlanLimitResult {
  allowed: boolean;
  currentCount: number;
  maxAllowed: number | null;
  planName: string;
  isOverride: boolean;
  reason: string | null;
}

/**
 * Check if an organization is within its plan limits for a given resource type.
 * Calls the sp_check_plan_limits stored procedure which handles billing overrides.
 */
export async function checkPlanLimit(
  supabase: SupabaseClient,
  organizationId: string,
  checkType: 'listing' | 'crm_contact'
): Promise<PlanLimitResult> {
  const { data, error } = await supabase.rpc('sp_check_plan_limits', {
    p_organization_id: organizationId,
    p_check_type: checkType,
  });

  if (error) {
    console.error(`[check-plan-limits] Error checking ${checkType} limit for org ${organizationId}:`, error);
    // Fail open — don't block operations if the check itself fails
    return {
      allowed: true,
      currentCount: 0,
      maxAllowed: null,
      planName: 'unknown',
      isOverride: false,
      reason: `Plan limit check failed: ${error.message}`,
    };
  }

  const row = data?.[0];
  if (!row) {
    return {
      allowed: true,
      currentCount: 0,
      maxAllowed: null,
      planName: 'free',
      isOverride: false,
      reason: null,
    };
  }

  return {
    allowed: row.allowed,
    currentCount: row.current_count,
    maxAllowed: row.max_allowed,
    planName: row.plan_name,
    isOverride: row.is_override,
    reason: row.reason,
  };
}
