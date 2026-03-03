-- Create display_signage_settings table for shop window digital signage
CREATE TABLE public.display_signage_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{
    "orientation": "auto",
    "slide_duration_seconds": 10,
    "transition_type": "fade",
    "show_price": true,
    "show_address": true,
    "show_bedrooms_bathrooms": true,
    "show_ber_rating": true,
    "show_contact_info": true,
    "listing_order": "newest_first",
    "category_filter": "all",
    "max_listings": null
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One display config per org
CREATE UNIQUE INDEX idx_display_signage_org
  ON display_signage_settings(organization_id);

-- Enable RLS
ALTER TABLE display_signage_settings ENABLE ROW LEVEL SECURITY;

-- RLS: org members can manage their own display settings
CREATE POLICY "Users can view display settings for their org"
  ON display_signage_settings FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert display settings for their org"
  ON display_signage_settings FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update display settings for their org"
  ON display_signage_settings FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()
  ));

-- Service role full access
CREATE POLICY "Service role has full access to display signage settings"
  ON display_signage_settings FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at timestamp
CREATE TRIGGER set_display_signage_updated_at
  BEFORE UPDATE ON display_signage_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
