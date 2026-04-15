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