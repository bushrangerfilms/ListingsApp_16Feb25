-- Create enum types for CRM pipeline stages and activities
CREATE TYPE public.seller_stage_enum AS ENUM (
  'lead',
  'valuation_scheduled',
  'valuation_complete',
  'listed',
  'under_offer',
  'sold',
  'lost'
);

CREATE TYPE public.buyer_stage_enum AS ENUM (
  'lead',
  'qualified',
  'viewing_scheduled',
  'viewed',
  'offer_made',
  'sale_agreed',
  'purchased',
  'lost'
);

CREATE TYPE public.crm_activity_type_enum AS ENUM (
  'note',
  'email',
  'call',
  'meeting',
  'stage_change',
  'listing_sent',
  'viewing_scheduled',
  'offer_received'
);

-- Create seller_profiles table
CREATE TABLE public.seller_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  property_address TEXT,
  stage public.seller_stage_enum NOT NULL DEFAULT 'lead',
  source TEXT NOT NULL DEFAULT 'manual',
  source_id UUID,
  valuation_request_id UUID REFERENCES public.valuation_requests(id) ON DELETE SET NULL,
  listed_property_id TEXT,
  notes TEXT,
  last_contact_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(email)
);

-- Create buyer_profiles table
CREATE TABLE public.buyer_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  bedrooms_required INTEGER[],
  stage public.buyer_stage_enum NOT NULL DEFAULT 'lead',
  source TEXT NOT NULL DEFAULT 'manual',
  source_id UUID,
  property_alert_id UUID REFERENCES public.property_alerts(id) ON DELETE SET NULL,
  interested_properties TEXT[],
  budget_min NUMERIC,
  budget_max NUMERIC,
  notes TEXT,
  last_contact_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(email)
);

-- Create crm_activities table
CREATE TABLE public.crm_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  seller_profile_id UUID REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  buyer_profile_id UUID REFERENCES public.buyer_profiles(id) ON DELETE CASCADE,
  activity_type public.crm_activity_type_enum NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  CHECK (
    (seller_profile_id IS NOT NULL AND buyer_profile_id IS NULL) OR
    (seller_profile_id IS NULL AND buyer_profile_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for seller_profiles
CREATE POLICY "Admins can view all seller profiles"
  ON public.seller_profiles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert seller profiles"
  ON public.seller_profiles
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update seller profiles"
  ON public.seller_profiles
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete seller profiles"
  ON public.seller_profiles
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role can also manage seller profiles for auto-import
CREATE POLICY "Service role can manage seller profiles"
  ON public.seller_profiles
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for buyer_profiles
CREATE POLICY "Admins can view all buyer profiles"
  ON public.buyer_profiles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert buyer profiles"
  ON public.buyer_profiles
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update buyer profiles"
  ON public.buyer_profiles
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete buyer profiles"
  ON public.buyer_profiles
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role can also manage buyer profiles for auto-import
CREATE POLICY "Service role can manage buyer profiles"
  ON public.buyer_profiles
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for crm_activities
CREATE POLICY "Admins can view all activities"
  ON public.crm_activities
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert activities"
  ON public.crm_activities
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update activities"
  ON public.crm_activities
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete activities"
  ON public.crm_activities
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role can also manage activities for auto-import
CREATE POLICY "Service role can manage activities"
  ON public.crm_activities
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_seller_profiles_updated_at
  BEFORE UPDATE ON public.seller_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_buyer_profiles_updated_at
  BEFORE UPDATE ON public.buyer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_seller_profiles_email ON public.seller_profiles(email);
CREATE INDEX idx_seller_profiles_stage ON public.seller_profiles(stage);
CREATE INDEX idx_buyer_profiles_email ON public.buyer_profiles(email);
CREATE INDEX idx_buyer_profiles_stage ON public.buyer_profiles(stage);
CREATE INDEX idx_crm_activities_seller ON public.crm_activities(seller_profile_id);
CREATE INDEX idx_crm_activities_buyer ON public.crm_activities(buyer_profile_id);