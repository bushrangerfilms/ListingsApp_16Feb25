-- Fix webhook trigger: update URL from old project to current production project
-- and clean up any duplicate triggers

DROP TRIGGER IF EXISTS on_listing_change ON public.listings;
DROP TRIGGER IF EXISTS listing_webhook_trigger ON public.listings;

CREATE OR REPLACE FUNCTION trigger_listing_webhook()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type text;
  v_listing_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'listing.created';
    v_listing_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_event_type := 'listing.updated';
    v_listing_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'listing.deleted';
    v_listing_id := OLD.id;
  END IF;

  PERFORM net.http_post(
    url := 'https://sjcfcxjpukgeaxxkffpq.supabase.co/functions/v1/send-listing-webhook',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'listing_id', v_listing_id,
      'event_type', v_event_type
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER listing_webhook_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_listing_webhook();
