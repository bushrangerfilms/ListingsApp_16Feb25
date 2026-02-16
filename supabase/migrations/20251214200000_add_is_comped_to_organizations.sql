-- Add is_comped column to organizations table for pilot program billing exemptions
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_comped boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN organizations.is_comped IS 'Organizations marked as comped are exempt from billing requirements during the pilot phase';

-- Create index for efficient querying of comped organizations
CREATE INDEX IF NOT EXISTS idx_organizations_is_comped ON organizations(is_comped) WHERE is_comped = true;
