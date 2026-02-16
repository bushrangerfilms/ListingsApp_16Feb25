-- Create trigger to automatically send webhooks when listings change
-- The trigger function already exists, we just need to activate it

DROP TRIGGER IF EXISTS listing_webhook_trigger ON public.listings;

CREATE TRIGGER listing_webhook_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_listing_webhook();