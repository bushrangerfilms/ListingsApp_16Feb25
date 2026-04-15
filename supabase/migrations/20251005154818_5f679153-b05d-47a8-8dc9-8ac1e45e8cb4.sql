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