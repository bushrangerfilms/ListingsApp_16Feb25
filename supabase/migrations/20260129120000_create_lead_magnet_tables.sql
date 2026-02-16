-- Lead Magnet Tables for Public Property Quizzes
-- Two quiz types: READY_TO_SELL and WORTH_ESTIMATE

-- ============================================
-- Table: lead_magnets (per-org configuration)
-- ============================================
CREATE TABLE IF NOT EXISTS public.lead_magnets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('READY_TO_SELL', 'WORTH_ESTIMATE')),
    slug TEXT,
    is_enabled BOOLEAN DEFAULT true,
    brand_config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, type)
);

-- Indexes for lead_magnets
CREATE INDEX IF NOT EXISTS idx_lead_magnets_org_id ON public.lead_magnets(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_magnets_type ON public.lead_magnets(type);

-- ============================================
-- Table: lead_submissions (all form submissions)
-- ============================================
CREATE TABLE IF NOT EXISTS public.lead_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_magnet_id UUID REFERENCES public.lead_magnets(id) ON DELETE SET NULL,
    
    -- Attribution (from UTM params)
    utm_source TEXT,
    utm_campaign TEXT,
    campaign_id TEXT,
    post_id TEXT,
    version TEXT,
    
    -- Contact info (gated - collected after quiz completion)
    name TEXT,
    email TEXT,
    phone TEXT,
    consent BOOLEAN DEFAULT false,
    
    -- Raw quiz answers
    answers_json JSONB NOT NULL DEFAULT '{}',
    
    -- Ready-to-Sell outputs
    score INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
    band TEXT CHECK (band IS NULL OR band IN ('Ready to List', 'Nearly Ready', 'Getting Started', 'Early Stage')),
    headline_gaps JSONB,
    todo_json JSONB,
    
    -- Worth Estimate outputs
    estimate_low INTEGER,
    estimate_high INTEGER,
    confidence TEXT CHECK (confidence IS NULL OR confidence IN ('High', 'Medium', 'Low')),
    drivers_json JSONB,
    market_trend TEXT CHECK (market_trend IS NULL OR market_trend IN ('Rising', 'Stable', 'Declining', 'rising', 'stable', 'falling')),
    market_insights TEXT,
    comparable_sales JSONB,
    research_source TEXT CHECK (research_source IS NULL OR research_source IN ('cached', 'ai', 'default')),
    
    -- Versioning for audit
    rules_version TEXT DEFAULT 'v1',
    valuation_model_version TEXT DEFAULT 'v1',
    research_snapshot_id UUID,
    
    -- CRM link
    seller_profile_id UUID,
    
    -- Email status
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lead_submissions
CREATE INDEX IF NOT EXISTS idx_lead_submissions_org_id ON public.lead_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_submissions_lead_magnet_id ON public.lead_submissions(lead_magnet_id);
CREATE INDEX IF NOT EXISTS idx_lead_submissions_email ON public.lead_submissions(email);
CREATE INDEX IF NOT EXISTS idx_lead_submissions_created_at ON public.lead_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_submissions_utm_source ON public.lead_submissions(utm_source);
CREATE INDEX IF NOT EXISTS idx_lead_submissions_campaign_id ON public.lead_submissions(campaign_id);

-- ============================================
-- Table: market_research_cache (AI research artifacts)
-- ============================================
CREATE TABLE IF NOT EXISTS public.market_research_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_key TEXT NOT NULL,
    property_type TEXT NOT NULL,
    research_json JSONB NOT NULL DEFAULT '{}',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(area_key, property_type)
);

-- Indexes for market_research_cache
CREATE INDEX IF NOT EXISTS idx_market_research_cache_area_key ON public.market_research_cache(area_key);
CREATE INDEX IF NOT EXISTS idx_market_research_cache_expires_at ON public.market_research_cache(expires_at);

-- ============================================
-- Enable RLS on all tables
-- ============================================
ALTER TABLE public.lead_magnets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_research_cache ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for lead_magnets
-- ============================================

-- Drop existing policies first (idempotent)
DROP POLICY IF EXISTS "Public can read enabled lead magnets" ON public.lead_magnets;
DROP POLICY IF EXISTS "Users can read their org lead magnets" ON public.lead_magnets;
DROP POLICY IF EXISTS "Admins can update their org lead magnets" ON public.lead_magnets;
DROP POLICY IF EXISTS "Service role full access on lead_magnets" ON public.lead_magnets;

-- Public can read enabled lead magnets (for form display)
CREATE POLICY "Public can read enabled lead magnets"
    ON public.lead_magnets
    FOR SELECT
    TO anon
    USING (is_enabled = true);

-- Authenticated users can read their org's lead magnets
CREATE POLICY "Users can read their org lead magnets"
    ON public.lead_magnets
    FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM public.user_organizations
            WHERE user_id = auth.uid()
        )
    );

-- Org admins can update their lead magnets
CREATE POLICY "Admins can update their org lead magnets"
    ON public.lead_magnets
    FOR UPDATE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM public.user_organizations
            WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

-- Service role full access
CREATE POLICY "Service role full access on lead_magnets"
    ON public.lead_magnets
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- RLS Policies for lead_submissions
-- ============================================

-- Drop existing policies first (idempotent)
DROP POLICY IF EXISTS "Public can insert lead submissions" ON public.lead_submissions;
DROP POLICY IF EXISTS "Users can read their org lead submissions" ON public.lead_submissions;
DROP POLICY IF EXISTS "Service role full access on lead_submissions" ON public.lead_submissions;

-- Public can insert submissions (quiz completions)
CREATE POLICY "Public can insert lead submissions"
    ON public.lead_submissions
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Authenticated users can read their org's submissions
CREATE POLICY "Users can read their org lead submissions"
    ON public.lead_submissions
    FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM public.user_organizations
            WHERE user_id = auth.uid()
        )
    );

-- Service role full access
CREATE POLICY "Service role full access on lead_submissions"
    ON public.lead_submissions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- RLS Policies for market_research_cache
-- ============================================

-- Drop existing policies first (idempotent)
DROP POLICY IF EXISTS "Public can read market research cache" ON public.market_research_cache;
DROP POLICY IF EXISTS "Service role full access on market_research_cache" ON public.market_research_cache;

-- Public can read cache (for valuation)
CREATE POLICY "Public can read market research cache"
    ON public.market_research_cache
    FOR SELECT
    TO anon
    USING (expires_at > NOW());

-- Service role full access
CREATE POLICY "Service role full access on market_research_cache"
    ON public.market_research_cache
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- Auto-provision function for new organizations
-- ============================================
CREATE OR REPLACE FUNCTION public.provision_lead_magnets_for_org()
RETURNS TRIGGER AS $$
BEGIN
    -- Create Ready-to-Sell lead magnet
    INSERT INTO public.lead_magnets (organization_id, type, is_enabled)
    VALUES (NEW.id, 'READY_TO_SELL', true)
    ON CONFLICT (organization_id, type) DO NOTHING;
    
    -- Create Worth Estimate lead magnet
    INSERT INTO public.lead_magnets (organization_id, type, is_enabled)
    VALUES (NEW.id, 'WORTH_ESTIMATE', true)
    ON CONFLICT (organization_id, type) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-provision on org creation
DROP TRIGGER IF EXISTS trigger_provision_lead_magnets ON public.organizations;
CREATE TRIGGER trigger_provision_lead_magnets
    AFTER INSERT ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.provision_lead_magnets_for_org();

-- ============================================
-- Provision lead magnets for existing organizations
-- ============================================
INSERT INTO public.lead_magnets (organization_id, type, is_enabled)
SELECT id, 'READY_TO_SELL', true
FROM public.organizations
ON CONFLICT (organization_id, type) DO NOTHING;

INSERT INTO public.lead_magnets (organization_id, type, is_enabled)
SELECT id, 'WORTH_ESTIMATE', true
FROM public.organizations
ON CONFLICT (organization_id, type) DO NOTHING;

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE public.lead_magnets IS 'Per-organization lead magnet configuration for public quizzes';
COMMENT ON TABLE public.lead_submissions IS 'All lead magnet quiz submissions with answers, scores, and CRM linkage';
COMMENT ON TABLE public.market_research_cache IS 'Cached AI market research for worth estimation (per area/property type)';

COMMENT ON COLUMN public.lead_submissions.band IS 'Ready-to-Sell result band: Ready to List, Nearly Ready, Getting Started, Early Stage';
COMMENT ON COLUMN public.lead_submissions.confidence IS 'Worth Estimate confidence level: High, Medium, Low';
COMMENT ON COLUMN public.lead_submissions.rules_version IS 'Version of scoring rules used for audit trail';
COMMENT ON COLUMN public.lead_submissions.valuation_model_version IS 'Version of valuation model used for audit trail';

-- ============================================
-- Add new columns to existing tables (idempotent)
-- ============================================
DO $$ 
BEGIN
    -- Add market_insights column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'lead_submissions' 
                   AND column_name = 'market_insights') THEN
        ALTER TABLE public.lead_submissions ADD COLUMN market_insights TEXT;
    END IF;
    
    -- Add comparable_sales column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'lead_submissions' 
                   AND column_name = 'comparable_sales') THEN
        ALTER TABLE public.lead_submissions ADD COLUMN comparable_sales JSONB;
    END IF;
    
    -- Add research_source column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'lead_submissions' 
                   AND column_name = 'research_source') THEN
        ALTER TABLE public.lead_submissions ADD COLUMN research_source TEXT;
    END IF;
END $$;
