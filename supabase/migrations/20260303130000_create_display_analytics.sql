-- Display analytics: tracks which listings are shown and for how long
CREATE TABLE IF NOT EXISTS public.display_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  display_id UUID REFERENCES public.display_signage_settings(id) ON DELETE SET NULL,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  shown_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  theme TEXT,
  orientation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by org + time range
CREATE INDEX IF NOT EXISTS idx_display_analytics_org_shown
  ON public.display_analytics (organization_id, shown_at DESC);

-- Index for querying by listing
CREATE INDEX IF NOT EXISTS idx_display_analytics_listing
  ON public.display_analytics (listing_id, shown_at DESC);

-- RLS
ALTER TABLE public.display_analytics ENABLE ROW LEVEL SECURITY;

-- Org members can view their own analytics
CREATE POLICY "Org members can view display analytics"
  ON public.display_analytics FOR SELECT
  USING (
    organization_id IN (
      SELECT uo.organization_id FROM public.user_organizations uo
      WHERE uo.user_id = auth.uid()
    )
  );

-- Org members can insert analytics (from the display page)
CREATE POLICY "Org members can insert display analytics"
  ON public.display_analytics FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT uo.organization_id FROM public.user_organizations uo
      WHERE uo.user_id = auth.uid()
    )
  );

-- Service role has full access (implicit)
