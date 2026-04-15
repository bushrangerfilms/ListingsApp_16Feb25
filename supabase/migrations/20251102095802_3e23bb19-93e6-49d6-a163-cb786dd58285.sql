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