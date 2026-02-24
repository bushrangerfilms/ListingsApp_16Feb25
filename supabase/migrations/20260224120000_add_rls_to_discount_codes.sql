-- C1: Enable RLS on discount_codes and discount_code_usage tables
-- These tables were created without RLS, allowing any authenticated user to read/modify all discount codes.

-- ============================================
-- Enable RLS
-- ============================================

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_code_usage ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for discount_codes
-- ============================================

-- Only super_admin and developer can read discount codes
CREATE POLICY "Super admins can read discount codes"
    ON public.discount_codes
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
              AND role IN ('super_admin', 'developer')
        )
    );

-- Only super_admin can create discount codes
CREATE POLICY "Super admins can create discount codes"
    ON public.discount_codes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
              AND role = 'super_admin'
        )
    );

-- Only super_admin can update discount codes
CREATE POLICY "Super admins can update discount codes"
    ON public.discount_codes
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
              AND role = 'super_admin'
        )
    );

-- Only super_admin can delete discount codes
CREATE POLICY "Super admins can delete discount codes"
    ON public.discount_codes
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
              AND role = 'super_admin'
        )
    );

-- Service role full access (for edge functions)
CREATE POLICY "Service role full access on discount_codes"
    ON public.discount_codes
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- RLS Policies for discount_code_usage
-- ============================================

-- Super admins and developers can read all usage records
CREATE POLICY "Super admins can read discount code usage"
    ON public.discount_code_usage
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
              AND role IN ('super_admin', 'developer')
        )
    );

-- Authenticated users can insert usage records (redeeming a code for their org)
CREATE POLICY "Authenticated users can redeem discount codes"
    ON public.discount_code_usage
    FOR INSERT
    TO authenticated
    WITH CHECK (
        redeemed_by = auth.uid()
        AND organization_id IN (
            SELECT organization_id FROM public.user_organizations
            WHERE user_id = auth.uid()
        )
    );

-- Service role full access (for edge functions)
CREATE POLICY "Service role full access on discount_code_usage"
    ON public.discount_code_usage
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
