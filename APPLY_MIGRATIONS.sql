-- Combined Migrations for Bridge Auctioneers CRM
-- Apply this script in Supabase SQL Editor
-- This will create all necessary tables in public and crm schemas

BEGIN;

-- Migration: 20251005154818_5f679153-b05d-47a8-8dc9-8ac1e45e8cb4.sql
-- Create rate_limits table for tracking submission limits per client
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_slug TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  submission_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_client_ip ON public.rate_limits(client_slug, ip_address);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits(window_start);

-- Enable Row Level Security
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Create policy to allow edge functions to manage rate limits (service role only)
CREATE POLICY "Service role can manage rate limits"
  ON public.rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create function to clean up old rate limit records (older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < NOW() - INTERVAL '24 hours';
END;
$$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_rate_limits_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_rate_limits_updated_at
  BEFORE UPDATE ON public.rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_rate_limits_updated_at();

-- Migration: 20251005154829_3f1877ba-4e6e-44e7-8868-a842b1f55412.sql
-- Fix search_path for security on the cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < NOW() - INTERVAL '24 hours';
END;
$$;

-- Fix search_path for security on the trigger function
CREATE OR REPLACE FUNCTION public.update_rate_limits_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Migration: 20251005154841_f45fe115-d7bd-49f4-ae38-0e3278f63bc8.sql
-- Create storage bucket for listing photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-photos',
  'listing-photos',
  true,
  5242880, -- 5MB limit per file
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);

-- Create storage policies for listing photos
CREATE POLICY "Anyone can view listing photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'listing-photos');

CREATE POLICY "Service role can upload listing photos"
  ON storage.objects
  FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'listing-photos');

CREATE POLICY "Service role can update listing photos"
  ON storage.objects
  FOR UPDATE
  TO service_role
  USING (bucket_id = 'listing-photos');

CREATE POLICY "Service role can delete listing photos"
  ON storage.objects
  FOR DELETE
  TO service_role
  USING (bucket_id = 'listing-photos');

-- Migration: 20251007150140_ff7f9e4b-728d-47f1-85c9-e444b80a68f8.sql
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- RLS Policy: Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- RLS Policy: Only admins can insert/update/delete roles
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create valuation_requests table
CREATE TABLE public.valuation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  property_address TEXT NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'completed')),
  contacted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on valuation_requests
ALTER TABLE public.valuation_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can insert valuation requests (public form)
CREATE POLICY "Anyone can submit valuation requests"
ON public.valuation_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- RLS Policy: Only admins can view/update valuation requests
CREATE POLICY "Admins can view all valuation requests"
ON public.valuation_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update valuation requests"
ON public.valuation_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Migration: 20251007153417_50458dd1-b525-4128-bc8f-00f473c545ee.sql
-- Create property_enquiries table
CREATE TABLE public.property_enquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id TEXT NOT NULL,
  property_title TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT DEFAULT 'new'::text,
  contacted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.property_enquiries ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit enquiries
CREATE POLICY "Anyone can submit property enquiries"
ON public.property_enquiries
FOR INSERT
WITH CHECK (true);

-- Allow admins to view all enquiries
CREATE POLICY "Admins can view all property enquiries"
ON public.property_enquiries
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update enquiries
CREATE POLICY "Admins can update property enquiries"
ON public.property_enquiries
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Migration: 20251007162812_544050d2-5edd-497e-be94-be0cfd8fd034.sql
-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule auto-archive job to run daily at midnight UTC
SELECT cron.schedule(
  'auto-archive-sold-listings',
  '0 0 * * *', -- Run at midnight every day
  $$
  SELECT
    net.http_post(
        url:='https://pepzeqiupmucxiulfzld.supabase.co/functions/v1/auto-archive-sold-listings',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlcHplcWl1cG11Y3hpdWxmemxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NjcwMTksImV4cCI6MjA3NTE0MzAxOX0.Ek2OkXrskC0Us3EhujjVwcyp6a2AFutGdHQA9Esm9L8"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Migration: 20251007212637_c1a4cc87-2ffb-46c6-972e-10fde41c35ad.sql
-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create social_links table
CREATE TABLE public.social_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform text NOT NULL UNIQUE,
  url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;

-- Public can view enabled social links
CREATE POLICY "Anyone can view enabled social links"
ON public.social_links
FOR SELECT
USING (enabled = true);

-- Admins can manage all social links
CREATE POLICY "Admins can manage social links"
ON public.social_links
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default social links
INSERT INTO public.social_links (platform, url, enabled, display_order) VALUES
  ('facebook', 'https://facebook.com', false, 1),
  ('instagram', 'https://instagram.com', false, 2),
  ('tiktok', 'https://tiktok.com', false, 3),
  ('youtube', 'https://youtube.com', false, 4);

-- Create trigger for timestamps
CREATE TRIGGER update_social_links_updated_at
BEFORE UPDATE ON public.social_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251007212645_3b9b9151-da79-4df3-be51-c7967a217ad3.sql
-- Fix security warning by setting search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Migration: 20251008091312_0f3ef4da-6f24-4dda-846a-6b006dfc6f24.sql
-- Create table for property notification preferences
CREATE TABLE public.property_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  bedrooms integer[] NOT NULL,
  comments text,
  status text NOT NULL DEFAULT 'active',
  contacted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.property_alerts ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit alert preferences
CREATE POLICY "Anyone can submit property alerts"
ON public.property_alerts
FOR INSERT
WITH CHECK (true);

-- Admins can view all alerts
CREATE POLICY "Admins can view all property alerts"
ON public.property_alerts
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update alerts
CREATE POLICY "Admins can update property alerts"
ON public.property_alerts
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_property_alerts_updated_at
BEFORE UPDATE ON public.property_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251010131957_299fd3b3-86e1-4b93-a1d8-8489b3683f01.sql
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

-- Migration: 20251010135836_809b0b63-7d66-4ad4-ab64-311d5536d7ea.sql
-- Create security definer function to check if admin exists
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE role = 'admin'
  );
$$;

-- Add RLS policy to allow first authenticated user to become admin
CREATE POLICY "Bootstrap first admin"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  role = 'admin'
  AND user_id = auth.uid()
  AND NOT public.admin_exists()
);

-- Add policy to allow users to read their own roles
CREATE POLICY "Users can read own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Enforce single admin with unique partial index
CREATE UNIQUE INDEX IF NOT EXISTS unique_single_admin
ON public.user_roles ((role))
WHERE role = 'admin';

-- Migration: 20251010141027_f3b219a5-9225-4399-9207-049ff5cf5ea9.sql
-- Create listing views tracking table
CREATE TABLE IF NOT EXISTS public.listing_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id text NOT NULL,
  listing_title text,
  viewed_at timestamp with time zone DEFAULT now(),
  ip_address text,
  created_at timestamp with time zone DEFAULT now()
);

-- Index for faster queries
CREATE INDEX idx_listing_views_listing_id ON public.listing_views(listing_id);
CREATE INDEX idx_listing_views_viewed_at ON public.listing_views(viewed_at);

-- Enable RLS
ALTER TABLE public.listing_views ENABLE ROW LEVEL SECURITY;

-- Allow anyone to track listing views
CREATE POLICY "Anyone can track listing views"
  ON public.listing_views
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Admins can view listing analytics
CREATE POLICY "Admins can view listing analytics"
  ON public.listing_views
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Migration: 20251015102211_eae9484d-ead1-4660-a0fd-8e1ae28850f5.sql
-- Update admin user to peter@streamlinedai.tech
UPDATE user_roles 
SET user_id = 'f973eda1-5a46-47b1-a115-36661688dc91'
WHERE role = 'admin' AND user_id = 'a793e1fc-c078-4c4d-8be2-a18534dbf744';

-- Migration: 20251015102301_60543387-b5c7-4f75-9449-864e2a670d33.sql
-- Remove the single admin constraint to allow multiple admins
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS unique_single_admin;

-- Migration: 20251020151241_f42933de-80d2-4db5-8d1c-074fd7a23882.sql
-- Remove the unique constraint that limits to a single admin
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS unique_single_admin;

-- Migration: 20251020151345_09d0f9d8-e5ad-428a-8597-3b4b31913dfd.sql
-- Check for and drop any unique index that might be causing this
DROP INDEX IF EXISTS unique_single_admin;

-- Also check for a constraint by this name on the table
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'unique_single_admin'
    ) THEN
        ALTER TABLE public.user_roles DROP CONSTRAINT unique_single_admin;
    END IF;
END $$;

-- Migration: 20251102095539_368b7a85-04b0-4e1d-b296-46d32cf25c6f.sql
-- Create table for storing project documentation and implementation plans
CREATE TABLE IF NOT EXISTS public.implementation_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  version integer NOT NULL DEFAULT 1,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.implementation_plans ENABLE ROW LEVEL SECURITY;

-- Admins can view all plans
CREATE POLICY "Admins can view implementation plans"
  ON public.implementation_plans
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage plans
CREATE POLICY "Admins can manage implementation plans"
  ON public.implementation_plans
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_implementation_plans_updated_at
  BEFORE UPDATE ON public.implementation_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251102095802_3e23bb19-93e6-49d6-a163-cb786dd58285.sql
-- Create table for storing code snapshots
CREATE TABLE IF NOT EXISTS public.code_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  
  snapshot_date date NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'stable',
  notes text,
  
  -- Store key file contents
  files jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Metadata
  version text,
  tags text[] DEFAULT ARRAY[]::text[]
);

-- Enable RLS
ALTER TABLE public.code_snapshots ENABLE ROW LEVEL SECURITY;

-- Admins can view all snapshots
CREATE POLICY "Admins can view code snapshots"
  ON public.code_snapshots
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage snapshots
CREATE POLICY "Admins can manage code snapshots"
  ON public.code_snapshots
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Migration: 20251102100100_de11f3f9-498c-45bb-a091-2e55c988dc53.sql
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

-- Migration: 20251102120431_d729c13e-f24d-43a7-a8ad-14ad14a7abc8.sql
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

-- Migration: 20251102123036_65e9bcd6-9d7f-4427-9c03-38fb5f55b1a9.sql
-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant necessary permissions to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Try to unschedule if exists (will silently fail if doesn't exist)
DO $$
BEGIN
  PERFORM cron.unschedule('process-email-sequences');
EXCEPTION
  WHEN OTHERS THEN
    -- Job doesn't exist, that's fine
    NULL;
END $$;

-- Create the cron job to run every hour at the top of the hour
SELECT cron.schedule(
  'process-email-sequences',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://pepzeqiupmucxiulfzld.supabase.co/functions/v1/process-email-sequences',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlcHplcWl1cG11Y3hpdWxmemxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NjcwMTksImV4cCI6MjA3NTE0MzAxOX0.Ek2OkXrskC0Us3EhujjVwcyp6a2AFutGdHQA9Esm9L8'
      )
    ) AS request_id;
  $$
);

-- Migration: 20251102125115_a362f5bf-b9bb-4983-921d-291849feb67b.sql
-- Create function to automatically enroll profiles in email sequences when stage changes
CREATE OR REPLACE FUNCTION public.auto_enroll_in_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sequence_id uuid;
  v_sequence_name text;
  v_step record;
  v_profile_type text;
  v_trigger_stage text;
BEGIN
  -- Determine profile type and stage based on which table triggered this
  IF TG_TABLE_NAME = 'buyer_profiles' THEN
    v_profile_type := 'buyer';
    v_trigger_stage := NEW.stage::text;
  ELSE
    v_profile_type := 'seller';
    v_trigger_stage := NEW.stage::text;
  END IF;

  -- Check if stage actually changed
  IF OLD.stage = NEW.stage THEN
    RETURN NEW;
  END IF;

  -- Check if already enrolled in an active sequence
  IF v_profile_type = 'buyer' THEN
    IF EXISTS (
      SELECT 1 FROM profile_email_queue 
      WHERE buyer_profile_id = NEW.id 
      AND status IN ('pending', 'sent')
    ) THEN
      RETURN NEW;
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM profile_email_queue 
      WHERE seller_profile_id = NEW.id 
      AND status IN ('pending', 'sent')
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Find active sequence matching profile type and trigger stage
  SELECT id, name INTO v_sequence_id, v_sequence_name
  FROM email_sequences
  WHERE profile_type = v_profile_type
    AND trigger_stage = v_trigger_stage
    AND is_active = true
  LIMIT 1;

  -- If matching sequence found, enroll the profile
  IF v_sequence_id IS NOT NULL THEN
    -- Create queue entries for all steps in the sequence
    FOR v_step IN
      SELECT step_number, template_key, delay_hours
      FROM email_sequence_steps
      WHERE sequence_id = v_sequence_id
      ORDER BY step_number
    LOOP
      IF v_profile_type = 'buyer' THEN
        INSERT INTO profile_email_queue (
          buyer_profile_id,
          sequence_id,
          step_number,
          template_key,
          scheduled_for,
          status
        ) VALUES (
          NEW.id,
          v_sequence_id,
          v_step.step_number,
          v_step.template_key,
          NOW() + (v_step.delay_hours || ' hours')::INTERVAL,
          'pending'
        );
      ELSE
        INSERT INTO profile_email_queue (
          seller_profile_id,
          sequence_id,
          step_number,
          template_key,
          scheduled_for,
          status
        ) VALUES (
          NEW.id,
          v_sequence_id,
          v_step.step_number,
          v_step.template_key,
          NOW() + (v_step.delay_hours || ' hours')::INTERVAL,
          'pending'
        );
      END IF;
    END LOOP;

    -- Log the enrollment as a CRM activity
    INSERT INTO crm_activities (
      buyer_profile_id,
      seller_profile_id,
      activity_type,
      title,
      description,
      metadata
    ) VALUES (
      CASE WHEN v_profile_type = 'buyer' THEN NEW.id ELSE NULL END,
      CASE WHEN v_profile_type = 'seller' THEN NEW.id ELSE NULL END,
      'email_sent',
      'Auto-enrolled in Email Sequence',
      'Automatically enrolled in "' || v_sequence_name || '" sequence due to stage change to ' || v_trigger_stage,
      jsonb_build_object(
        'sequence_id', v_sequence_id,
        'sequence_name', v_sequence_name,
        'trigger_stage', v_trigger_stage,
        'auto_enrolled', true
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for buyer profiles
DROP TRIGGER IF EXISTS trigger_auto_enroll_buyer_sequence ON buyer_profiles;
CREATE TRIGGER trigger_auto_enroll_buyer_sequence
  AFTER UPDATE OF stage ON buyer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_enroll_in_sequence();

-- Create trigger for seller profiles
DROP TRIGGER IF EXISTS trigger_auto_enroll_seller_sequence ON seller_profiles;
CREATE TRIGGER trigger_auto_enroll_seller_sequence
  AFTER UPDATE OF stage ON seller_profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_enroll_in_sequence();

-- Migration: 20251102125421_1ed9013d-5d9f-4d6c-9c1a-996531ab9fce.sql
-- Create email sequences table
CREATE TABLE IF NOT EXISTS email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT NOT NULL,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('buyer', 'seller')),
  trigger_stage TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email sequences"
ON email_sequences FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create email sequence steps table
CREATE TABLE IF NOT EXISTS email_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  template_key TEXT NOT NULL,
  delay_hours INTEGER NOT NULL DEFAULT 0,
  UNIQUE(sequence_id, step_number)
);

-- Enable RLS
ALTER TABLE email_sequence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email sequence steps"
ON email_sequence_steps FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create profile email queue table
CREATE TABLE IF NOT EXISTS profile_email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  buyer_profile_id UUID REFERENCES buyer_profiles(id) ON DELETE CASCADE,
  seller_profile_id UUID REFERENCES seller_profiles(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  template_key TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'paused')),
  error_message TEXT,
  CONSTRAINT check_one_profile CHECK (
    (buyer_profile_id IS NOT NULL AND seller_profile_id IS NULL) OR
    (buyer_profile_id IS NULL AND seller_profile_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE profile_email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage profile email queue"
ON profile_email_queue FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage profile email queue"
ON profile_email_queue FOR ALL
USING (true);

-- Create indexes
CREATE INDEX idx_email_queue_buyer ON profile_email_queue(buyer_profile_id);
CREATE INDEX idx_email_queue_seller ON profile_email_queue(seller_profile_id);
CREATE INDEX idx_email_queue_scheduled ON profile_email_queue(scheduled_for);
CREATE INDEX idx_email_queue_status ON profile_email_queue(status);

-- Migration: 20251102145552_959ee878-6823-4c15-ac99-9564f3814c69.sql
-- Create email tracking table
CREATE TABLE IF NOT EXISTS public.email_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  profile_email_queue_id uuid REFERENCES public.profile_email_queue(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),
  event_data jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text
);

-- Enable RLS
ALTER TABLE public.email_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view email tracking"
  ON public.email_tracking
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage email tracking"
  ON public.email_tracking
  FOR ALL
  USING (true);

-- Indexes for performance
CREATE INDEX idx_email_tracking_queue_id ON public.email_tracking(profile_email_queue_id);
CREATE INDEX idx_email_tracking_event_type ON public.email_tracking(event_type);
CREATE INDEX idx_email_tracking_created_at ON public.email_tracking(created_at DESC);

-- Migration: 20251102145903_46f995f7-0259-4b35-8bf3-c80b2144940d.sql
-- Add email preferences fields to profiles
ALTER TABLE public.buyer_profiles ADD COLUMN IF NOT EXISTS email_unsubscribed boolean DEFAULT false;
ALTER TABLE public.buyer_profiles ADD COLUMN IF NOT EXISTS email_preferences_token text DEFAULT (encode(gen_random_bytes(32), 'hex'));
ALTER TABLE public.buyer_profiles ADD COLUMN IF NOT EXISTS unsubscribed_at timestamp with time zone;

ALTER TABLE public.seller_profiles ADD COLUMN IF NOT EXISTS email_unsubscribed boolean DEFAULT false;
ALTER TABLE public.seller_profiles ADD COLUMN IF NOT EXISTS email_preferences_token text DEFAULT (encode(gen_random_bytes(32), 'hex'));
ALTER TABLE public.seller_profiles ADD COLUMN IF NOT EXISTS unsubscribed_at timestamp with time zone;

-- Create indexes for token lookups
CREATE INDEX IF NOT EXISTS idx_buyer_profiles_preferences_token ON public.buyer_profiles(email_preferences_token);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_preferences_token ON public.seller_profiles(email_preferences_token);

-- Update existing profiles to have tokens if they don't
UPDATE public.buyer_profiles 
SET email_preferences_token = encode(gen_random_bytes(32), 'hex') 
WHERE email_preferences_token IS NULL;

UPDATE public.seller_profiles 
SET email_preferences_token = encode(gen_random_bytes(32), 'hex') 
WHERE email_preferences_token IS NULL;

-- Migration: 20251102152651_d27ac105-1420-41ed-bc92-1b0c02fa5f96.sql
-- Create table for storing custom dashboard configurations
CREATE TABLE public.dashboard_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  layout JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  role_template TEXT
);

-- Enable RLS
ALTER TABLE public.dashboard_configurations ENABLE ROW LEVEL SECURITY;

-- Admins can view all dashboards
CREATE POLICY "Admins can view all dashboards"
ON public.dashboard_configurations
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can create dashboards
CREATE POLICY "Admins can create dashboards"
ON public.dashboard_configurations
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid());

-- Admins can update their own dashboards
CREATE POLICY "Admins can update their own dashboards"
ON public.dashboard_configurations
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid());

-- Admins can delete their own dashboards
CREATE POLICY "Admins can delete their own dashboards"
ON public.dashboard_configurations
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_dashboard_configurations_updated_at
BEFORE UPDATE ON public.dashboard_configurations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251102165723_2e1c06ca-7be3-44dd-af21-b22f216def81.sql
-- Create knowledge documents table for uploaded content
CREATE TABLE knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('market_report', 'faq', 'company_info', 'custom')),
  file_url text,
  tokens_count integer DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'processing', 'archived', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create AI assistant configuration table
CREATE TABLE ai_assistant_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  personality text DEFAULT 'professional' CHECK (personality IN ('professional', 'friendly', 'casual', 'expert')),
  system_prompt text,
  enabled_capabilities jsonb DEFAULT '["property_recommendations", "faq_answering"]'::jsonb,
  response_length text DEFAULT 'balanced' CHECK (response_length IN ('concise', 'balanced', 'detailed')),
  max_recommendations integer DEFAULT 3 CHECK (max_recommendations BETWEEN 1 AND 5),
  model_name text DEFAULT 'google/gemini-2.5-flash',
  include_active_listings boolean DEFAULT true,
  include_sold_listings boolean DEFAULT false,
  include_buyer_preferences boolean DEFAULT true,
  widget_enabled boolean DEFAULT false,
  widget_color text DEFAULT '#2563eb',
  welcome_message text DEFAULT 'Hi! I can help you find the perfect property.',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create AI training metrics table
CREATE TABLE ai_training_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  properties_count integer DEFAULT 0,
  documents_count integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  training_status text DEFAULT 'ready' CHECK (training_status IN ('ready', 'training', 'error', 'needs_update')),
  error_message text,
  last_trained_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create AI test conversations table
CREATE TABLE ai_test_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  messages jsonb NOT NULL,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_assistant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_training_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_test_conversations ENABLE ROW LEVEL SECURITY;

-- RLS policies for knowledge_documents
CREATE POLICY "Admins can manage their knowledge documents"
ON knowledge_documents
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for ai_assistant_config
CREATE POLICY "Admins can manage their AI config"
ON ai_assistant_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for ai_training_metrics
CREATE POLICY "Admins can view their training metrics"
ON ai_training_metrics
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for ai_test_conversations
CREATE POLICY "Admins can manage their test conversations"
ON ai_test_conversations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger for knowledge_documents
CREATE TRIGGER update_knowledge_documents_updated_at
BEFORE UPDATE ON knowledge_documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for ai_assistant_config
CREATE TRIGGER update_ai_assistant_config_updated_at
BEFORE UPDATE ON ai_assistant_config
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Migration: 20251102182420_52b6ad42-1257-40cd-b59e-4900d64cd13d.sql
-- Add CRM configuration columns to ai_assistant_config table
ALTER TABLE ai_assistant_config 
ADD COLUMN IF NOT EXISTS crm_auto_capture boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS agent_notification_email text,
ADD COLUMN IF NOT EXISTS required_lead_fields jsonb DEFAULT '["name", "email"]'::jsonb,
ADD COLUMN IF NOT EXISTS lead_capture_style text DEFAULT 'balanced';

-- Add comment for documentation
COMMENT ON COLUMN ai_assistant_config.crm_auto_capture IS 'Enable automatic CRM lead capture from AI conversations';
COMMENT ON COLUMN ai_assistant_config.agent_notification_email IS 'Email address to notify when leads request agent contact';
COMMENT ON COLUMN ai_assistant_config.required_lead_fields IS 'Fields required before saving to CRM (e.g., ["name", "email"])';
COMMENT ON COLUMN ai_assistant_config.lead_capture_style IS 'How aggressive to be in gathering info: subtle, balanced, or aggressive';

-- Migration: 20251103193721_0962d79b-4874-4049-a3d9-445788bbd6f3.sql
-- Phase 2.1a: Add developer to app_role enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t 
                 JOIN pg_enum e ON t.oid = e.enumtypid  
                 WHERE t.typname = 'app_role' AND e.enumlabel = 'developer') THEN
    ALTER TYPE public.app_role ADD VALUE 'developer';
  END IF;
END $$;

-- Migration: 20251103193747_24f11b3f-7713-4e30-94db-047203f12ad8.sql
-- Phase 2.1b: Assign developer role to the first admin user

-- Create helper function
CREATE OR REPLACE FUNCTION get_first_admin_user_id()
RETURNS uuid AS $$
DECLARE
  admin_user_id uuid;
BEGIN
  SELECT user_id INTO admin_user_id
  FROM public.user_roles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;
  
  RETURN admin_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Assign developer role
INSERT INTO public.user_roles (user_id, role)
SELECT get_first_admin_user_id(), 'developer'
WHERE get_first_admin_user_id() IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Migration: 20251103193814_03ab6530-7c5f-4d55-9a47-a762c324fe06.sql
-- Fix security warning: Set search_path for function
CREATE OR REPLACE FUNCTION get_first_admin_user_id()
RETURNS uuid AS $$
DECLARE
  admin_user_id uuid;
BEGIN
  SELECT user_id INTO admin_user_id
  FROM public.user_roles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;
  
  RETURN admin_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Migration: 20251103194426_fe719cd5-1690-43ee-9f63-1fddbd306e8a.sql
-- Create listings table in Supabase (migrating from Airtable)
CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Airtable reference (for dual-write preservation)
  airtable_record_id text UNIQUE,
  
  -- Basic property details
  title text NOT NULL,
  description text,
  building_type text,
  price numeric,
  
  -- Property specifications
  bedrooms integer,
  bathrooms integer,
  ensuite integer,
  floor_area_size numeric,
  
  -- Location
  address text NOT NULL,
  address_detail text,
  
  -- Energy & Category
  ber_rating text,
  category text NOT NULL,
  furnished text,
  
  -- Media & Links
  photos text[], -- Array of photo URLs
  booking_link text,
  
  -- Status tracking
  status text NOT NULL DEFAULT 'New',
  status_changed_date date,
  new_status_set_date date,
  date_posted date NOT NULL DEFAULT CURRENT_DATE,
  
  -- Archive flag
  archived boolean NOT NULL DEFAULT false
);

-- Add indexes for performance
CREATE INDEX idx_listings_status ON public.listings(status);
CREATE INDEX idx_listings_category ON public.listings(category);
CREATE INDEX idx_listings_archived ON public.listings(archived);
CREATE INDEX idx_listings_date_posted ON public.listings(date_posted DESC);
CREATE INDEX idx_listings_airtable_id ON public.listings(airtable_record_id);

-- Add trigger for updated_at
CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Public can view non-archived published listings
CREATE POLICY "Anyone can view published listings"
  ON public.listings
  FOR SELECT
  USING (archived = false AND status = 'Published');

-- Admins can view all listings (including archived)
CREATE POLICY "Admins can view all listings"
  ON public.listings
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert listings
CREATE POLICY "Admins can create listings"
  ON public.listings
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update listings
CREATE POLICY "Admins can update listings"
  ON public.listings
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete listings (soft delete via archived flag preferred)
CREATE POLICY "Admins can delete listings"
  ON public.listings
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can manage listings (for edge functions)
CREATE POLICY "Service role can manage listings"
  ON public.listings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Migration: 20251103200720_965e2893-7382-41ee-ac8d-720be43e6ffb.sql
-- Add RLS policy to allow authenticated users from any app to view active listings
CREATE POLICY "Authenticated users can view active listings"
ON public.listings
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND archived = false
);

-- Migration: 20251103204640_d1acde46-ef37-46b2-9396-6941543504ed.sql
-- Phase 1: Create organizations and user_organizations tables (fixed order)

-- Create organizations table (master client data)
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Business Identity
  slug text UNIQUE NOT NULL,
  business_name text NOT NULL,
  logo_url text,
  domain text,
  
  -- Contact Info
  contact_name text,
  contact_email text,
  contact_phone text,
  business_address text,
  
  -- Business Metadata
  psr_licence_number text,
  listings_base_id text,
  
  -- Settings
  is_active boolean DEFAULT true,
  settings jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_organizations table (many-to-many mapping)
CREATE TABLE IF NOT EXISTS public.user_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Role within THIS organization
  role text NOT NULL DEFAULT 'member',
  
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, organization_id)
);

-- Enable RLS on both tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Users can view their organization"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id 
      FROM public.user_organizations 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update their organization"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT uo.organization_id 
      FROM public.user_organizations uo
      JOIN public.user_roles ur ON ur.user_id = uo.user_id
      WHERE uo.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

CREATE POLICY "Service role can manage organizations"
  ON public.organizations FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for user_organizations
CREATE POLICY "Users can view their memberships"
  ON public.user_organizations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Organization admins can manage memberships"
  ON public.user_organizations FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT uo.organization_id 
      FROM public.user_organizations uo
      WHERE uo.user_id = auth.uid() 
      AND uo.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Service role can manage user_organizations"
  ON public.user_organizations FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create trigger for organizations updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('organization-logos', 'organization-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for organization logos
CREATE POLICY "Anyone can view organization logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'organization-logos');

CREATE POLICY "Authenticated users can upload organization logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'organization-logos');

CREATE POLICY "Organization admins can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'organization-logos');

CREATE POLICY "Organization admins can delete logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'organization-logos');

-- Migration: 20251103210020_cbcd4c07-9e8d-42ab-a859-3359f522fccd.sql
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

-- Migration: 20251103211222_809c08da-7f40-48b6-af31-991addef1696.sql
-- Phase 6: Add second organization for multi-tenant testing

-- Insert Streamlined Tech organization
INSERT INTO public.organizations (
  slug,
  business_name,
  logo_url,
  domain,
  contact_name,
  contact_email,
  contact_phone,
  business_address,
  psr_licence_number,
  is_active
) VALUES (
  'streamlined-tech',
  'Streamlined Tech',
  '/src/assets/streamlined-tech-logo.png',
  'streamlinedtech.ie',
  'Tech Support',
  'support@streamlinedtech.ie',
  '+353 1 234 5678',
  'Dublin, Ireland',
  NULL,
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Get the organization IDs
DO $$
DECLARE
  v_streamlined_org_id uuid;
  v_bridge_org_id uuid;
BEGIN
  -- Get organization IDs
  SELECT id INTO v_streamlined_org_id FROM public.organizations WHERE slug = 'streamlined-tech';
  SELECT id INTO v_bridge_org_id FROM public.organizations WHERE slug = 'bridge-auctioneers';

  -- Add some test email templates for Streamlined Tech
  INSERT INTO public.email_templates (
    organization_id,
    template_key,
    template_name,
    category,
    subject,
    body_html,
    description
  ) VALUES (
    v_streamlined_org_id,
    'streamlined_welcome',
    'Streamlined Welcome Email',
    'customer',
    'Welcome to Streamlined Tech',
    '<p>Welcome to Streamlined Tech! We''re excited to have you.</p>',
    'Welcome email for new Streamlined Tech clients'
  )
  ON CONFLICT DO NOTHING;

  -- Add test social link for Streamlined Tech
  INSERT INTO public.social_links (
    organization_id,
    platform,
    url,
    enabled,
    display_order
  ) VALUES (
    v_streamlined_org_id,
    'linkedin',
    'https://linkedin.com/company/streamlined-tech',
    true,
    1
  )
  ON CONFLICT DO NOTHING;

END $$;

-- Migration: 20251103221105_4e6f0aa8-60bc-4d3d-9f04-77045f2a5a74.sql
-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Organization admins can manage memberships" ON public.user_organizations;

-- Create a new policy that uses security definer functions to avoid recursion
CREATE POLICY "Admins can manage their org memberships"
ON public.user_organizations
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

-- Migration: 20251103223114_5500f883-b518-4cc3-9fef-ab068aff2663.sql
-- Add hero_photo column to store the main featured image separately from gallery photos
ALTER TABLE listings ADD COLUMN hero_photo text;

-- Migration: 20251103224030_60ffcb24-e043-438d-826c-b19cf31d0480.sql
-- Add social_media_photos column to store up to 15 social media photos
ALTER TABLE listings ADD COLUMN social_media_photos text[];

-- Migration: 20251103224525_f9879c1e-2180-426b-ade1-0c5cb2ba67f8.sql
-- Add missing columns from Airtable to listings table

-- Address fields (currently address is a concatenated field)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS address_town text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS eircode text;

-- Property details
ALTER TABLE listings ADD COLUMN IF NOT EXISTS land_size numeric; -- Land Size in Acres
ALTER TABLE listings ADD COLUMN IF NOT EXISTS specs text; -- Specs (Dimensions / Services)

-- Social media and marketing
ALTER TABLE listings ADD COLUMN IF NOT EXISTS sm_posting_status text DEFAULT 'Todo';

-- URL and slug fields
ALTER TABLE listings ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS live_url text;

-- Create unique index on slug per organization
CREATE UNIQUE INDEX IF NOT EXISTS listings_organization_slug_idx ON listings(organization_id, slug) WHERE slug IS NOT NULL;

-- Migration: 20251104012515_ecaa3af1-e3bf-4019-849e-cb468e753ec0.sql
-- Add webhook configuration columns to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS webhook_url text,
ADD COLUMN IF NOT EXISTS webhook_secret text,
ADD COLUMN IF NOT EXISTS webhook_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS webhook_events text[] DEFAULT ARRAY['listing.created', 'listing.updated']::text[];

-- Create webhook_logs table for debugging
CREATE TABLE IF NOT EXISTS webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  listing_id uuid REFERENCES listings(id),
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on webhook_logs
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view webhook logs for their organization
CREATE POLICY "Admins can view webhook logs"
ON webhook_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_webhook_logs_org_created 
ON webhook_logs(organization_id, created_at DESC);

-- Create function to trigger webhook edge function
CREATE OR REPLACE FUNCTION trigger_listing_webhook()
RETURNS TRIGGER AS $$
DECLARE
  event_type text;
BEGIN
  -- Determine event type
  IF TG_OP = 'INSERT' THEN
    event_type := 'listing.created';
  ELSIF TG_OP = 'UPDATE' THEN
    event_type := 'listing.updated';
  ELSIF TG_OP = 'DELETE' THEN
    event_type := 'listing.deleted';
  END IF;

  -- Call edge function asynchronously using pg_net
  PERFORM net.http_post(
    url := 'https://pepzeqiupmucxiulfzld.supabase.co/functions/v1/send-listing-webhook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'listing_id', COALESCE(NEW.id, OLD.id),
      'event_type', event_type
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on listings table
DROP TRIGGER IF EXISTS on_listing_change ON listings;
CREATE TRIGGER on_listing_change
  AFTER INSERT OR UPDATE OR DELETE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_listing_webhook();

-- Migration: 20251104012545_df5de5d1-670d-4c00-8428-af78aa9c1db8.sql
-- Fix search_path for trigger_listing_webhook function
CREATE OR REPLACE FUNCTION trigger_listing_webhook()
RETURNS TRIGGER AS $$
DECLARE
  event_type text;
BEGIN
  -- Determine event type
  IF TG_OP = 'INSERT' THEN
    event_type := 'listing.created';
  ELSIF TG_OP = 'UPDATE' THEN
    event_type := 'listing.updated';
  ELSIF TG_OP = 'DELETE' THEN
    event_type := 'listing.deleted';
  END IF;

  -- Call edge function asynchronously using pg_net
  PERFORM net.http_post(
    url := 'https://pepzeqiupmucxiulfzld.supabase.co/functions/v1/send-listing-webhook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'listing_id', COALESCE(NEW.id, OLD.id),
      'event_type', event_type
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Migration: 20251104013537_9ba68b62-0f86-4833-bb4a-fc56a3df99b8.sql
-- Create storage bucket for listing photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-photos', 'listing-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for public read access
CREATE POLICY "Public can view listing photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'listing-photos');

-- Create policy for authenticated uploads
CREATE POLICY "Authenticated users can upload listing photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'listing-photos' AND auth.role() = 'authenticated');

-- Migration: 20251104104836_852e625d-07fa-4231-b51b-57df1e6aba14.sql
-- Add missing columns to webhook_logs for retry tracking
ALTER TABLE webhook_logs 
ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Add index for monitoring queries
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status 
ON webhook_logs(response_status, created_at DESC);

-- Migration: 20251104121006_8bbb62e8-d37b-4b9f-a171-20fbccc78420.sql
-- Create trigger to automatically send webhooks when listings change
-- The trigger function already exists, we just need to activate it

DROP TRIGGER IF EXISTS listing_webhook_trigger ON public.listings;

CREATE TRIGGER listing_webhook_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_listing_webhook();

-- Migration: 20251104123611_728cd737-46b6-4f0e-8ca3-e173395f01c0.sql
-- Drop trigger if exists (cleanup from failed migration)
DROP TRIGGER IF EXISTS listing_webhook_trigger ON public.listings;

-- Create trigger to automatically send webhooks when listings are created, updated, or deleted
CREATE TRIGGER listing_webhook_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_listing_webhook();

-- Migration: 20251104145057_9c3f9f03-7681-40d7-8ec4-5689350291d6.sql
-- Phase 1.1: Add super_admin to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Migration: 20251104145121_a2522ab9-4c94-4470-ad5d-35bd82f9450a.sql
-- Phase 1.2: Create helper function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  )
$$;

-- Migration: 20251104161214_870212d7-78c0-4a89-8786-314db425f9a2.sql
-- Add super_admin role to the current user (keeping admin role as well)
INSERT INTO public.user_roles (user_id, role)
VALUES ('951ae6b9-2e95-4d9c-8e2a-53a26eae17d0'::uuid, 'super_admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;

COMMIT;
