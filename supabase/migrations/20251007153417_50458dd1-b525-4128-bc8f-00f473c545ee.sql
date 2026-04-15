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