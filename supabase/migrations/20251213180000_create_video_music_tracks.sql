-- Video Music Tracks Management
-- Global library of music tracks for video generation

CREATE TABLE IF NOT EXISTS public.video_music_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Track metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Audio file stored in Supabase Storage
  storage_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size_bytes INTEGER,
  duration_seconds INTEGER,
  
  -- Categorization
  genre VARCHAR(100),
  mood VARCHAR(100),
  tags TEXT[] DEFAULT '{}',
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_video_music_tracks_active 
  ON public.video_music_tracks(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_video_music_tracks_genre 
  ON public.video_music_tracks(genre) WHERE genre IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_video_music_tracks_mood 
  ON public.video_music_tracks(mood) WHERE mood IS NOT NULL;

-- Enable RLS
ALTER TABLE public.video_music_tracks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Super admins can manage all tracks
CREATE POLICY "Super admins can manage video_music_tracks"
  ON public.video_music_tracks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid()::text 
      AND role IN ('super_admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid()::text 
      AND role = 'super_admin'
    )
  );

-- Service role can read for Edge Functions (video generation)
CREATE POLICY "Service role can read video_music_tracks"
  ON public.video_music_tracks
  FOR SELECT
  TO service_role
  USING (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_video_music_track_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_video_music_track_timestamp
  BEFORE UPDATE ON public.video_music_tracks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_video_music_track_timestamp();

-- Create storage bucket for video music (if not exists)
-- Note: Storage bucket creation is typically done via Supabase Dashboard or separate migration
-- INSERT INTO storage.buckets (id, name, public) VALUES ('video-music', 'video-music', false) ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.video_music_tracks IS 'Global library of music tracks available for video generation.';
