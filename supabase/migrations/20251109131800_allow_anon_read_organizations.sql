-- Migration: Allow anonymous users to read organizations (for public website)
-- Created: 2024-11-09
-- Purpose: The security hotfix (20251109104000) blocked anon users from reading
--          organizations, which broke public website pages. This adds a read-only
--          policy for anon users to browse organization data.

-- Add policy allowing anonymous users to SELECT active organizations
CREATE POLICY "Anonymous users can view active organizations"
  ON public.organizations
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Note: This is safe because:
-- 1. Read-only (SELECT only, no INSERT/UPDATE/DELETE)
-- 2. Filtered to only active organizations
-- 3. Organizations data is meant to be public (for branded public websites)
-- 4. Multi-tenant isolation still enforced at listing/data level via organization_id
