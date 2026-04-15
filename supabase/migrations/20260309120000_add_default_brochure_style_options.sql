-- Add default brochure style options (template, frame, page format, etc.) to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS default_brochure_style_options JSONB DEFAULT NULL;

COMMENT ON COLUMN organizations.default_brochure_style_options IS
  'Default brochure style options: templateId, frameStyle, imageCornerRadius, imageBorder, showInnerPrice, showBackCoverPrice, pageFormat';
