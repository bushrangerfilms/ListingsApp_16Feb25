-- Add RLS policy to allow authenticated users from any app to view active listings
CREATE POLICY "Authenticated users can view active listings"
ON public.listings
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND archived = false
);