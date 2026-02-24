-- C2: Remove unconstrained anonymous INSERT on lead_submissions
-- The existing policy allows anon users to insert records with arbitrary organization_id,
-- which could pollute other orgs' CRM data. All legitimate inserts go through the
-- lead-magnet-api edge function which uses service_role, so the anon INSERT is unnecessary.

-- Drop the overly permissive anon INSERT policy
DROP POLICY IF EXISTS "Public can insert lead submissions" ON public.lead_submissions;

-- If direct anon inserts are ever needed in the future, use a constrained policy like:
-- CREATE POLICY "Public can insert lead submissions"
--     ON public.lead_submissions
--     FOR INSERT
--     TO anon
--     WITH CHECK (
--         organization_id IN (
--             SELECT id FROM public.organizations WHERE is_active = true
--         )
--     );
