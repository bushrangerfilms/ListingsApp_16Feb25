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