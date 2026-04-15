-- Support multiple displays per organization
-- Drop the unique constraint on organization_id
DROP INDEX IF EXISTS idx_display_signage_org;

-- Add display_name column (default for existing rows)
ALTER TABLE public.display_signage_settings
  ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT 'Main Display';

-- Create a non-unique index for org lookups
CREATE INDEX IF NOT EXISTS idx_display_signage_org_lookup
  ON public.display_signage_settings(organization_id);

-- Add delete policy so displays can be removed
CREATE POLICY "Users can delete display settings for their org"
  ON display_signage_settings FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid()
  ));
