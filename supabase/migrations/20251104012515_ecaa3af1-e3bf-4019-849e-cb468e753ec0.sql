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