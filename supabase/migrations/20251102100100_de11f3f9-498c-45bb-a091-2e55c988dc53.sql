-- Phase 1: Create email automation infrastructure

-- 1. Create email_templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Template identification
  template_key text UNIQUE NOT NULL,
  template_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('customer', 'admin')),
  
  -- Email content
  subject text NOT NULL,
  body_html text NOT NULL,
  
  -- Template variables documentation
  available_variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Metadata
  description text,
  is_active boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz
);

-- 2. Update property_alerts table with new tracking columns
ALTER TABLE public.property_alerts
  ADD COLUMN IF NOT EXISTS airtable_record_id text,
  ADD COLUMN IF NOT EXISTS last_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preferences_token text UNIQUE DEFAULT gen_random_uuid()::text;

-- 3. Create buyer_listing_matches table
CREATE TABLE IF NOT EXISTS public.buyer_listing_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Relationships
  property_alert_id uuid REFERENCES public.property_alerts(id) ON DELETE CASCADE,
  listing_airtable_id text NOT NULL,
  listing_title text NOT NULL,
  
  -- Tracking
  email_sent_at timestamptz,
  email_opened_at timestamptz,
  buyer_clicked_at timestamptz,
  
  -- Prevent duplicate notifications
  UNIQUE(property_alert_id, listing_airtable_id)
);

-- 4. Enable RLS on new tables
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_listing_matches ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for email_templates
CREATE POLICY "Admins can view email templates"
  ON public.email_templates
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage email templates"
  ON public.email_templates
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 6. RLS Policies for buyer_listing_matches
CREATE POLICY "Admins can view buyer listing matches"
  ON public.buyer_listing_matches
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage buyer listing matches"
  ON public.buyer_listing_matches
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 7. Create trigger for email_templates updated_at
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_property_alerts_preferences_token 
  ON public.property_alerts(preferences_token);

CREATE INDEX IF NOT EXISTS idx_property_alerts_status 
  ON public.property_alerts(status);

CREATE INDEX IF NOT EXISTS idx_property_alerts_bedrooms 
  ON public.property_alerts USING GIN(bedrooms);

CREATE INDEX IF NOT EXISTS idx_buyer_listing_matches_property_alert 
  ON public.buyer_listing_matches(property_alert_id);

CREATE INDEX IF NOT EXISTS idx_buyer_listing_matches_listing 
  ON public.buyer_listing_matches(listing_airtable_id);

CREATE INDEX IF NOT EXISTS idx_email_templates_key 
  ON public.email_templates(template_key);

CREATE INDEX IF NOT EXISTS idx_email_templates_active 
  ON public.email_templates(is_active) WHERE is_active = true;