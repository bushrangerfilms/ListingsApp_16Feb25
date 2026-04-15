-- Add default brochure certifications column to organizations
-- Stores the org's preferred certification logos for new brochures
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_brochure_certifications jsonb DEFAULT NULL;
