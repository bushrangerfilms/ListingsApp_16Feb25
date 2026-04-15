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