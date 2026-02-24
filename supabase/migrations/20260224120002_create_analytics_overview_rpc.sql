-- H2: Server-side analytics aggregation RPC
-- Replaces 7 parallel unbounded select('*') queries in OverviewSection.tsx
-- with a single RPC that returns pre-aggregated counts and 7-day time series.

CREATE OR REPLACE FUNCTION public.sp_get_analytics_overview(
  p_org_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_cutoff TIMESTAMPTZ := NOW() - (p_days || ' days')::INTERVAL;
BEGIN
  SELECT jsonb_build_object(
    'listings', jsonb_build_object(
      'total_views', (SELECT COUNT(*) FROM listing_views WHERE organization_id = p_org_id),
      'active_listings', (SELECT COUNT(*) FROM listings WHERE organization_id = p_org_id AND archived = false AND status IN ('Published', 'New'))
    ),
    'crm', jsonb_build_object(
      'total_buyers', (SELECT COUNT(*) FROM crm.buyer_profiles WHERE organization_id = p_org_id),
      'total_sellers', (SELECT COUNT(*) FROM crm.seller_profiles WHERE organization_id = p_org_id),
      'recent_activities', (SELECT COUNT(*) FROM crm_activities WHERE organization_id = p_org_id AND created_at >= v_cutoff)
    ),
    'email', jsonb_build_object(
      'total_sent', (SELECT COUNT(*) FROM profile_email_queue WHERE organization_id = p_org_id AND status = 'sent'),
      'total_opened', (SELECT COUNT(*) FROM email_tracking WHERE organization_id = p_org_id AND event_type = 'opened')
    ),
    'engagement', jsonb_build_object(
      'total_enquiries', (SELECT COUNT(*) FROM property_enquiries WHERE organization_id = p_org_id)
    ),
    'time_series', (
      SELECT COALESCE(jsonb_agg(day_data ORDER BY day_data->>'date'), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'date', d::DATE,
          'views', (SELECT COUNT(*) FROM listing_views WHERE organization_id = p_org_id AND created_at::DATE = d::DATE),
          'enquiries', (SELECT COUNT(*) FROM property_enquiries WHERE organization_id = p_org_id AND created_at::DATE = d::DATE),
          'emails', (SELECT COUNT(*) FROM profile_email_queue WHERE organization_id = p_org_id AND status = 'sent' AND sent_at::DATE = d::DATE)
        ) AS day_data
        FROM generate_series(
          (NOW() - ((p_days - 1) || ' days')::INTERVAL)::DATE,
          NOW()::DATE,
          '1 day'::INTERVAL
        ) AS d
      ) sub
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users (org-scoped by parameter)
GRANT EXECUTE ON FUNCTION public.sp_get_analytics_overview(UUID, INTEGER) TO authenticated;
-- Grant to service_role for edge functions
GRANT EXECUTE ON FUNCTION public.sp_get_analytics_overview(UUID, INTEGER) TO service_role;
