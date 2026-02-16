-- Drop trigger if exists (cleanup from failed migration)
DROP TRIGGER IF EXISTS listing_webhook_trigger ON public.listings;

-- Create trigger to automatically send webhooks when listings are created, updated, or deleted
CREATE TRIGGER listing_webhook_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_listing_webhook();