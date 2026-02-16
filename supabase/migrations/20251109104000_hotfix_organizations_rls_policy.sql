-- CRITICAL SECURITY HOTFIX
-- Fix RLS policy that was allowing ALL authenticated users to manage organizations
-- Original policy was missing "TO service_role" clause

-- Drop the vulnerable policy
DROP POLICY IF EXISTS "Service role can manage organizations" ON public.organizations;

-- Recreate policy with correct scope (service_role ONLY)
CREATE POLICY "Service role can manage organizations"
  ON public.organizations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Verify the policy exists and is correctly scoped
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'organizations' 
    AND policyname = 'Service role can manage organizations'
  ) THEN
    RAISE EXCEPTION 'Policy "Service role can manage organizations" was not created correctly';
  END IF;
END $$;
