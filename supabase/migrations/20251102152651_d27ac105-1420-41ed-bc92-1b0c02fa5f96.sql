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