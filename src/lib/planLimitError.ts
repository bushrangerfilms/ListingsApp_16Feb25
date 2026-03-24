export interface PlanLimitError {
  currentCount: number;
  maxAllowed: number;
  planName: string;
}

/**
 * Check if a response from a Supabase edge function contains a plan limit error.
 * When an edge function returns HTTP 403, supabase.functions.invoke may put the
 * response body in either `data` or `error.context`. This checks both.
 */
export function extractPlanLimitError(
  data: any,
  error: any
): PlanLimitError | null {
  // Check data first (sometimes edge function errors come through in data)
  if (data?.error === 'plan_limit_exceeded') {
    return {
      currentCount: data.currentCount ?? 0,
      maxAllowed: data.maxAllowed ?? 0,
      planName: data.planName ?? 'your',
    };
  }

  // Check error object (FunctionsHttpError wraps the response)
  if (error?.error === 'plan_limit_exceeded') {
    return {
      currentCount: error.currentCount ?? 0,
      maxAllowed: error.maxAllowed ?? 0,
      planName: error.planName ?? 'your',
    };
  }

  return null;
}
