-- Create demo_video_analytics table for tracking demo video engagement
CREATE TABLE IF NOT EXISTS demo_video_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('play', 'progress_25', 'progress_50', 'progress_75', 'complete', 'pause')),
    max_percentage INTEGER DEFAULT 0 CHECK (max_percentage >= 0 AND max_percentage <= 100),
    video_duration_seconds INTEGER,
    watch_time_seconds INTEGER DEFAULT 0,
    device_type TEXT CHECK (device_type IN ('desktop', 'tablet', 'mobile')),
    user_agent TEXT,
    referrer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying by session
CREATE INDEX IF NOT EXISTS idx_demo_video_analytics_session_id ON demo_video_analytics(session_id);

-- Index for querying by event type
CREATE INDEX IF NOT EXISTS idx_demo_video_analytics_event_type ON demo_video_analytics(event_type);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_demo_video_analytics_created_at ON demo_video_analytics(created_at DESC);

-- Enable RLS
ALTER TABLE demo_video_analytics ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for tracking from public page)
CREATE POLICY "Allow anonymous inserts on demo_video_analytics"
    ON demo_video_analytics
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Allow authenticated reads for super admins (via edge function with service role)
CREATE POLICY "Allow service role full access on demo_video_analytics"
    ON demo_video_analytics
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Comment on table
COMMENT ON TABLE demo_video_analytics IS 'Tracks demo video engagement from the public landing page';
