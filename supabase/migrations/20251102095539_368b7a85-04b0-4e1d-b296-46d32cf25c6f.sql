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