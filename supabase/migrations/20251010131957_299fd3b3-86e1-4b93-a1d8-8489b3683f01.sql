-- Add explicit policy to ensure property_alerts data is protected
-- Drop existing SELECT policy and recreate with more explicit checks
DROP POLICY IF EXISTS "Admins can view all property alerts" ON public.property_alerts;

-- Recreate with explicit authentication check
CREATE POLICY "Only authenticated admins can view property alerts"
ON public.property_alerts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Also ensure the same protection for property_enquiries and valuation_requests
DROP POLICY IF EXISTS "Admins can view all property enquiries" ON public.property_enquiries;

CREATE POLICY "Only authenticated admins can view property enquiries"
ON public.property_enquiries
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all valuation requests" ON public.valuation_requests;

CREATE POLICY "Only authenticated admins can view valuation requests"
ON public.valuation_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));