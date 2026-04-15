-- Create discount_codes table for Super Admin Portal
CREATE TABLE IF NOT EXISTS public.discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    max_uses_per_org INTEGER DEFAULT 1,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    applicable_plans TEXT[],
    min_months INTEGER DEFAULT 1,
    credit_grant_amount NUMERIC(12,2),
    created_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create discount_code_usage table to track redemptions
CREATE TABLE IF NOT EXISTS public.discount_code_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discount_code_id UUID NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL,
    redeemed_by UUID REFERENCES auth.users(id),
    redeemed_at TIMESTAMPTZ DEFAULT NOW(),
    credits_granted NUMERIC(12,2)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_is_active ON public.discount_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_discount_code_usage_code_id ON public.discount_code_usage(discount_code_id);
CREATE INDEX IF NOT EXISTS idx_discount_code_usage_org_id ON public.discount_code_usage(organization_id);

-- Add comment
COMMENT ON TABLE public.discount_codes IS 'Discount codes for billing/credits management in Super Admin Portal';
