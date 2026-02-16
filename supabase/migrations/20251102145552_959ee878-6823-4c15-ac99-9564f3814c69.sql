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