-- Super Admin Impersonation Feature
-- Allows super_admin users to switch between organizations for support/debugging

-- Step 1: Extend app_role enum to include super_admin and developer
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'developer';

-- Step 2: Create impersonation_sessions table for audit logging
CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz DEFAULT now() NOT NULL,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- Constraints
  CONSTRAINT active_session_check CHECK (
    ended_at IS NULL OR ended_at > started_at
  )
);

-- Create index for active session queries
CREATE INDEX IF NOT EXISTS idx_impersonation_active_sessions 
  ON public.impersonation_sessions(super_admin_id, organization_id, ended_at) 
  WHERE ended_at IS NULL;

-- Enable RLS on impersonation_sessions
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Super admins can view their own impersonation sessions
CREATE POLICY "Super admins can view their own sessions"
  ON public.impersonation_sessions FOR SELECT
  TO authenticated
  USING (
    super_admin_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- RLS Policy: Super admins can create impersonation sessions
CREATE POLICY "Super admins can create sessions"
  ON public.impersonation_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    super_admin_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- RLS Policy: Super admins can update their own sessions (to end them)
CREATE POLICY "Super admins can end their sessions"
  ON public.impersonation_sessions FOR UPDATE
  TO authenticated
  USING (
    super_admin_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- RLS Policy: Service role full access (MUST specify TO service_role!)
CREATE POLICY "Service role can manage impersonation sessions"
  ON public.impersonation_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 3: Create get_effective_org_ids() function
-- Returns organization IDs that the user can access (normal membership + active impersonation)
CREATE OR REPLACE FUNCTION public.get_effective_org_ids(_user_id uuid)
RETURNS TABLE (organization_id uuid)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Get organizations from normal membership
  SELECT uo.organization_id
  FROM public.user_organizations uo
  WHERE uo.user_id = _user_id
  
  UNION
  
  -- Get organizations from active impersonation sessions (for super_admins only)
  SELECT imp.organization_id
  FROM public.impersonation_sessions imp
  WHERE imp.super_admin_id = _user_id
    AND imp.ended_at IS NULL
    -- Optional: Add timeout check (e.g., sessions expire after 2 hours)
    AND imp.started_at > now() - interval '2 hours'
    -- Verify user is actually a super_admin
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
      AND role = 'super_admin'
    );
$$;

-- Step 4: Update RLS policies on organizations table to use get_effective_org_ids()
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Admins can update their organization" ON public.organizations;

-- Create new policies using get_effective_org_ids()
CREATE POLICY "Users can view accessible organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT organization_id FROM public.get_effective_org_ids(auth.uid()))
  );

CREATE POLICY "Admins can update accessible organizations"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (
    id IN (SELECT organization_id FROM public.get_effective_org_ids(auth.uid()))
    AND (
      -- User must be admin in the organization OR be a super_admin
      EXISTS (
        SELECT 1 FROM public.user_organizations
        WHERE user_id = auth.uid()
        AND organization_id = public.organizations.id
        AND role = 'admin'
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'super_admin'
      )
    )
  );

-- Step 5: Helper function to check if user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = 'super_admin'
  );
$$;

-- Step 6: Function to get active impersonation session
-- SECURITY: Uses auth.uid() internally, not trusting client-supplied user_id
CREATE OR REPLACE FUNCTION public.get_active_impersonation()
RETURNS TABLE (
  session_id uuid,
  organization_id uuid,
  organization_slug text,
  organization_name text,
  started_at timestamptz,
  reason text
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    imp.id as session_id,
    imp.organization_id,
    org.slug as organization_slug,
    org.business_name as organization_name,
    imp.started_at,
    imp.reason
  FROM public.impersonation_sessions imp
  JOIN public.organizations org ON org.id = imp.organization_id
  WHERE imp.super_admin_id = auth.uid()  -- CRITICAL: Use auth.uid(), not parameter
    AND imp.ended_at IS NULL
    AND imp.started_at > now() - interval '2 hours'
  ORDER BY imp.started_at DESC
  LIMIT 1;
$$;

-- Step 7: Function to end active impersonation session
-- SECURITY: Uses auth.uid() internally, not trusting client-supplied user_id
CREATE OR REPLACE FUNCTION public.end_impersonation_session()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.impersonation_sessions
  SET ended_at = now()
  WHERE super_admin_id = auth.uid()  -- CRITICAL: Use auth.uid(), not parameter
    AND ended_at IS NULL;
END;
$$;

-- Step 8: Function to get all organizations (for super_admin only)
-- SECURITY: Uses auth.uid() internally, not trusting client-supplied user_id
CREATE OR REPLACE FUNCTION public.get_impersonatable_organizations()
RETURNS TABLE (
  id uuid,
  slug text,
  business_name text,
  is_active boolean
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Only return data if CURRENT user is a super_admin (uses auth.uid())
  SELECT 
    o.id,
    o.slug,
    o.business_name,
    o.is_active
  FROM public.organizations o
  WHERE EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()  -- CRITICAL: Use auth.uid(), not parameter
    AND role = 'super_admin'
  )
  ORDER BY o.business_name;
$$;

-- Step 9: Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_effective_org_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_impersonation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_impersonation_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_impersonatable_organizations() TO authenticated;
