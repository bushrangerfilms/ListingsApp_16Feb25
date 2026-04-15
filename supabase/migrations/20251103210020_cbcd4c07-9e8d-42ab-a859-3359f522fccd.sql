-- Phase 2: Add organization_id to all data tables and update RLS policies

-- First, get the Bridge Auctioneers organization ID for backfilling
-- We'll use this in the DEFAULT clause temporarily

-- Add organization_id to listings
ALTER TABLE public.listings 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.listings 
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'bridge-auctioneers' LIMIT 1);

ALTER TABLE public.listings 
ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX idx_listings_organization_id ON public.listings(organization_id);

-- Add organization_id to buyer_profiles
ALTER TABLE public.buyer_profiles 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.buyer_profiles 
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'bridge-auctioneers' LIMIT 1);

ALTER TABLE public.buyer_profiles 
ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX idx_buyer_profiles_organization_id ON public.buyer_profiles(organization_id);

-- Add organization_id to seller_profiles
ALTER TABLE public.seller_profiles 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.seller_profiles 
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'bridge-auctioneers' LIMIT 1);

ALTER TABLE public.seller_profiles 
ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX idx_seller_profiles_organization_id ON public.seller_profiles(organization_id);

-- Add organization_id to property_alerts
ALTER TABLE public.property_alerts 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.property_alerts 
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'bridge-auctioneers' LIMIT 1);

ALTER TABLE public.property_alerts 
ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX idx_property_alerts_organization_id ON public.property_alerts(organization_id);

-- Add organization_id to property_enquiries
ALTER TABLE public.property_enquiries 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.property_enquiries 
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'bridge-auctioneers' LIMIT 1);

ALTER TABLE public.property_enquiries 
ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX idx_property_enquiries_organization_id ON public.property_enquiries(organization_id);

-- Add organization_id to valuation_requests
ALTER TABLE public.valuation_requests 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.valuation_requests 
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'bridge-auctioneers' LIMIT 1);

ALTER TABLE public.valuation_requests 
ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX idx_valuation_requests_organization_id ON public.valuation_requests(organization_id);

-- Add organization_id to email_templates
ALTER TABLE public.email_templates 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.email_templates 
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'bridge-auctioneers' LIMIT 1);

ALTER TABLE public.email_templates 
ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX idx_email_templates_organization_id ON public.email_templates(organization_id);

-- Add organization_id to email_sequences
ALTER TABLE public.email_sequences 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.email_sequences 
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'bridge-auctioneers' LIMIT 1);

ALTER TABLE public.email_sequences 
ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX idx_email_sequences_organization_id ON public.email_sequences(organization_id);

-- Add organization_id to ai_assistant_config
ALTER TABLE public.ai_assistant_config 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.ai_assistant_config 
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'bridge-auctioneers' LIMIT 1);

ALTER TABLE public.ai_assistant_config 
ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX idx_ai_assistant_config_organization_id ON public.ai_assistant_config(organization_id);

-- Add organization_id to knowledge_documents
ALTER TABLE public.knowledge_documents 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.knowledge_documents 
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'bridge-auctioneers' LIMIT 1);

ALTER TABLE public.knowledge_documents 
ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX idx_knowledge_documents_organization_id ON public.knowledge_documents(organization_id);

-- Add organization_id to social_links
ALTER TABLE public.social_links 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.social_links 
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'bridge-auctioneers' LIMIT 1);

ALTER TABLE public.social_links 
ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX idx_social_links_organization_id ON public.social_links(organization_id);

-- Create helper function to get user's organization IDs
CREATE OR REPLACE FUNCTION public.get_user_organization_ids(_user_id uuid)
RETURNS TABLE(organization_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.user_organizations
  WHERE user_id = _user_id;
$$;

-- Update RLS policies for listings
DROP POLICY IF EXISTS "Admins can view all listings" ON public.listings;
DROP POLICY IF EXISTS "Admins can create listings" ON public.listings;
DROP POLICY IF EXISTS "Admins can update listings" ON public.listings;
DROP POLICY IF EXISTS "Admins can delete listings" ON public.listings;
DROP POLICY IF EXISTS "Anyone can view published listings" ON public.listings;

CREATE POLICY "Admins can view their org listings" ON public.listings
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

CREATE POLICY "Admins can create listings in their org" ON public.listings
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

CREATE POLICY "Admins can update their org listings" ON public.listings
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

CREATE POLICY "Admins can delete their org listings" ON public.listings
FOR DELETE USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

CREATE POLICY "Anyone can view published listings" ON public.listings
FOR SELECT USING (archived = false AND status = 'Published');

-- Update RLS policies for buyer_profiles
DROP POLICY IF EXISTS "Admins can view all buyer profiles" ON public.buyer_profiles;
DROP POLICY IF EXISTS "Admins can insert buyer profiles" ON public.buyer_profiles;
DROP POLICY IF EXISTS "Admins can update buyer profiles" ON public.buyer_profiles;
DROP POLICY IF EXISTS "Admins can delete buyer profiles" ON public.buyer_profiles;

CREATE POLICY "Admins can view their org buyer profiles" ON public.buyer_profiles
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

CREATE POLICY "Admins can create buyer profiles in their org" ON public.buyer_profiles
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

CREATE POLICY "Admins can update their org buyer profiles" ON public.buyer_profiles
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

CREATE POLICY "Admins can delete their org buyer profiles" ON public.buyer_profiles
FOR DELETE USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

-- Update RLS policies for seller_profiles
DROP POLICY IF EXISTS "Admins can view all seller profiles" ON public.seller_profiles;
DROP POLICY IF EXISTS "Admins can insert seller profiles" ON public.seller_profiles;
DROP POLICY IF EXISTS "Admins can update seller profiles" ON public.seller_profiles;
DROP POLICY IF EXISTS "Admins can delete seller profiles" ON public.seller_profiles;

CREATE POLICY "Admins can view their org seller profiles" ON public.seller_profiles
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

CREATE POLICY "Admins can create seller profiles in their org" ON public.seller_profiles
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

CREATE POLICY "Admins can update their org seller profiles" ON public.seller_profiles
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

CREATE POLICY "Admins can delete their org seller profiles" ON public.seller_profiles
FOR DELETE USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

-- Update RLS policies for property_alerts
DROP POLICY IF EXISTS "Only authenticated admins can view property alerts" ON public.property_alerts;
DROP POLICY IF EXISTS "Admins can update property alerts" ON public.property_alerts;

CREATE POLICY "Admins can view their org property alerts" ON public.property_alerts
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

CREATE POLICY "Admins can update their org property alerts" ON public.property_alerts
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

-- Update RLS policies for property_enquiries
DROP POLICY IF EXISTS "Only authenticated admins can view property enquiries" ON public.property_enquiries;
DROP POLICY IF EXISTS "Admins can update property enquiries" ON public.property_enquiries;

CREATE POLICY "Admins can view their org property enquiries" ON public.property_enquiries
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

CREATE POLICY "Admins can update their org property enquiries" ON public.property_enquiries
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

-- Update RLS policies for valuation_requests
DROP POLICY IF EXISTS "Only authenticated admins can view valuation requests" ON public.valuation_requests;
DROP POLICY IF EXISTS "Admins can update valuation requests" ON public.valuation_requests;

CREATE POLICY "Admins can view their org valuation requests" ON public.valuation_requests
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

CREATE POLICY "Admins can update their org valuation requests" ON public.valuation_requests
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

-- Update RLS policies for email_templates
DROP POLICY IF EXISTS "Admins can view email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Admins can manage email templates" ON public.email_templates;

CREATE POLICY "Admins can view their org email templates" ON public.email_templates
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

CREATE POLICY "Admins can manage their org email templates" ON public.email_templates
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

-- Update RLS policies for email_sequences
DROP POLICY IF EXISTS "Admins can manage email sequences" ON public.email_sequences;

CREATE POLICY "Admins can manage their org email sequences" ON public.email_sequences
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

-- Update RLS policies for ai_assistant_config
DROP POLICY IF EXISTS "Admins can manage their AI config" ON public.ai_assistant_config;

CREATE POLICY "Admins can manage their org AI config" ON public.ai_assistant_config
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

-- Update RLS policies for knowledge_documents
DROP POLICY IF EXISTS "Admins can manage their knowledge documents" ON public.knowledge_documents;

CREATE POLICY "Admins can manage their org knowledge documents" ON public.knowledge_documents
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

-- Update RLS policies for social_links
DROP POLICY IF EXISTS "Admins can manage social links" ON public.social_links;
DROP POLICY IF EXISTS "Anyone can view enabled social links" ON public.social_links;

CREATE POLICY "Admins can manage their org social links" ON public.social_links
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

CREATE POLICY "Anyone can view enabled social links from any org" ON public.social_links
FOR SELECT USING (enabled = true);