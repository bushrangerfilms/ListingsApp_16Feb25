-- Backfill current_plan_name for orgs that predate the plan_definitions system
-- and clear orphan is_comped flags that don't correspond to a real billing_override.
--
-- After this migration, `billing_override` is the single source of truth for comp/pilot state.
-- Bridge Auctioneers and Sheehy Meares remain the only orgs with a billing_override (pilot deals
-- with payments handled outside the 7-tier system). Everyone else falls to the free plan.

UPDATE public.organizations
SET current_plan_name = 'free'
WHERE current_plan_name IS NULL;

UPDATE public.organizations
SET is_comped = false
WHERE is_comped = true
  AND billing_override IS NULL;

-- Helper: single source of truth for "does this org have a billing override?"
-- Callers should migrate off `is_comped` toward this function; the column stays
-- in place for now to avoid breaking unaudited consumers.
CREATE OR REPLACE FUNCTION public.fn_has_billing_override(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id = p_org_id
      AND billing_override IS NOT NULL
      AND billing_override ? 'type'
  );
$$;

COMMENT ON FUNCTION public.fn_has_billing_override(uuid) IS
  'True when the org has a billing_override (pilot/comp). Replaces the legacy is_comped boolean.';
