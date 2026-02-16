-- Add sponsored membership columns to billing_profiles
-- Allows super admins to grant free/complimentary access to organizations

ALTER TABLE public.billing_profiles 
ADD COLUMN IF NOT EXISTS is_sponsored BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sponsored_reason TEXT;

COMMENT ON COLUMN public.billing_profiles.is_sponsored IS 'If true, organization has complimentary access and billing is skipped';
COMMENT ON COLUMN public.billing_profiles.sponsored_reason IS 'Reason for sponsorship (e.g., Founding partner, Beta tester)';

-- Create index for quick lookup of sponsored orgs
CREATE INDEX IF NOT EXISTS idx_billing_profiles_sponsored ON public.billing_profiles(is_sponsored) WHERE is_sponsored = true;
