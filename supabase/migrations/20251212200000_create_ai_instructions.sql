-- AI Instructions Management System
-- Unified system for managing AI prompts across all features (listing enhancement, extraction, chatbot, captions, social posts)

-- Create enum for feature types
DO $$ BEGIN
  CREATE TYPE ai_feature_type AS ENUM (
    'listing_enhance_description',
    'listing_enhance_specs', 
    'property_extraction',
    'chatbot_assistant',
    'photo_captions',
    'social_media_posts'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for instruction scope
DO $$ BEGIN
  CREATE TYPE ai_instruction_scope AS ENUM (
    'global',
    'organization'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Main instruction sets table
CREATE TABLE IF NOT EXISTS public.ai_instruction_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_type ai_feature_type NOT NULL,
  scope ai_instruction_scope NOT NULL DEFAULT 'global',
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  locale VARCHAR(10), -- 'en-IE', 'en-GB', 'en-US', or NULL for all locales
  
  -- Instruction content
  name VARCHAR(255) NOT NULL,
  description TEXT,
  banned_phrases TEXT[] DEFAULT '{}',
  tone_guidelines TEXT[] DEFAULT '{}',
  freeform_instructions TEXT,
  
  -- Status and ordering
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0, -- Higher = applied first
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_org_scope CHECK (
    (scope = 'global' AND organization_id IS NULL) OR
    (scope = 'organization' AND organization_id IS NOT NULL)
  )
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_ai_instructions_lookup 
  ON public.ai_instruction_sets(feature_type, scope, organization_id, locale, is_active);

CREATE INDEX IF NOT EXISTS idx_ai_instructions_org 
  ON public.ai_instruction_sets(organization_id) WHERE organization_id IS NOT NULL;

-- Audit history table
CREATE TABLE IF NOT EXISTS public.ai_instruction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instruction_set_id UUID NOT NULL REFERENCES public.ai_instruction_sets(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL, -- 'created', 'updated', 'deleted', 'activated', 'deactivated'
  before_state JSONB,
  after_state JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_instruction_history_set 
  ON public.ai_instruction_history(instruction_set_id, changed_at DESC);

-- Enable RLS
ALTER TABLE public.ai_instruction_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_instruction_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_instruction_sets
-- Super admins and developers can read all
CREATE POLICY "Super admins can manage ai_instruction_sets"
  ON public.ai_instruction_sets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid()::text 
      AND role IN ('super_admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid()::text 
      AND role = 'super_admin'
    )
  );

-- Service role can read for Edge Functions
CREATE POLICY "Service role can read ai_instruction_sets"
  ON public.ai_instruction_sets
  FOR SELECT
  TO service_role
  USING (true);

-- RLS Policies for ai_instruction_history  
CREATE POLICY "Super admins can view ai_instruction_history"
  ON public.ai_instruction_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid()::text 
      AND role IN ('super_admin', 'developer')
    )
  );

CREATE POLICY "Service role can manage ai_instruction_history"
  ON public.ai_instruction_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to get resolved instructions for a feature
-- Returns merged instructions respecting precedence: org+locale > org > global+locale > global
CREATE OR REPLACE FUNCTION public.get_ai_instructions(
  p_feature_type ai_feature_type,
  p_organization_id UUID DEFAULT NULL,
  p_locale VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  banned_phrases TEXT[],
  tone_guidelines TEXT[],
  freeform_instructions TEXT,
  scope ai_instruction_scope,
  locale VARCHAR,
  priority INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.name,
    i.banned_phrases,
    i.tone_guidelines,
    i.freeform_instructions,
    i.scope,
    i.locale,
    i.priority
  FROM public.ai_instruction_sets i
  WHERE i.feature_type = p_feature_type
    AND i.is_active = true
    AND (
      -- Match organization-specific rules
      (i.scope = 'organization' AND i.organization_id = p_organization_id)
      OR
      -- Match global rules
      (i.scope = 'global')
    )
    AND (
      -- Match locale-specific or locale-agnostic
      i.locale IS NULL 
      OR i.locale = p_locale
    )
  ORDER BY 
    -- Precedence: org > global, then locale-specific > generic, then by priority
    CASE WHEN i.scope = 'organization' THEN 0 ELSE 1 END,
    CASE WHEN i.locale IS NOT NULL THEN 0 ELSE 1 END,
    i.priority DESC;
END;
$$;

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.get_ai_instructions TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_instructions TO service_role;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_ai_instruction_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_instruction_timestamp
  BEFORE UPDATE ON public.ai_instruction_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_instruction_timestamp();

-- Seed some default global instructions as examples
INSERT INTO public.ai_instruction_sets (
  feature_type, scope, name, description, banned_phrases, tone_guidelines, freeform_instructions, priority
) VALUES 
(
  'listing_enhance_description',
  'global',
  'Default Description Enhancement Rules',
  'Standard rules for enhancing property descriptions',
  ARRAY['BER Rating Available on Request', 'Price on Application', 'POA', 'TBC', 'To Be Confirmed'],
  ARRAY['Be concise and compelling', 'Focus on benefits over features', 'Use active voice', 'Avoid superlatives like "stunning" or "amazing"'],
  'Ensure descriptions flow naturally and highlight the property''s unique selling points. Always include location benefits where relevant.',
  100
),
(
  'listing_enhance_specs',
  'global', 
  'Default Specs Formatting Rules',
  'Standard rules for formatting property specifications',
  ARRAY['N/A', 'TBA', 'Unknown'],
  ARRAY['Be factual and precise', 'Use consistent formatting', 'Group related items together'],
  'Format room dimensions consistently. Use bullet points for features without dimensions.',
  100
),
(
  'property_extraction',
  'global',
  'Default Extraction Rules', 
  'Standard rules for extracting property details from screenshots',
  ARRAY[]::TEXT[],
  ARRAY['Extract all visible information', 'Be thorough but accurate', 'Do not invent details'],
  'When extracting from multiple screenshots, deduplicate content and ensure logical flow.',
  100
),
(
  'chatbot_assistant',
  'global',
  'Default Chatbot Personality',
  'Standard personality and behavior for AI chatbot',
  ARRAY[]::TEXT[],
  ARRAY['Be helpful and professional', 'Answer questions accurately', 'Offer to connect with agents when appropriate'],
  'Focus on qualifying leads naturally without being pushy. Gather contact information conversationally.',
  100
),
(
  'photo_captions',
  'global',
  'Default Photo Caption Rules',
  'Standard rules for generating photo captions',
  ARRAY['Beautiful', 'Stunning', 'Amazing', 'Lovely'],
  ARRAY['Keep captions short and descriptive', 'Focus on what is visible in the photo', 'Use property-specific terminology'],
  'Captions should be 5-15 words. Describe the room or feature shown without exaggeration.',
  100
),
(
  'social_media_posts',
  'global',
  'Default Social Media Rules',
  'Standard rules for generating social media posts',
  ARRAY['DM for details', 'Link in bio'],
  ARRAY['Be engaging but professional', 'Include a call to action', 'Use relevant hashtags sparingly'],
  'Posts should highlight key features and include the property location. Keep under 280 characters for Twitter compatibility.',
  100
)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.ai_instruction_sets IS 'Stores AI prompt instructions for various features. Supports global and organization-specific rules with locale variants.';
COMMENT ON TABLE public.ai_instruction_history IS 'Audit trail for changes to AI instruction sets.';
COMMENT ON FUNCTION public.get_ai_instructions IS 'Returns resolved AI instructions for a feature, respecting precedence hierarchy.';
