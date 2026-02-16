import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VideoEventPayload {
  session_id: string;
  event_type: 'play' | 'progress_25' | 'progress_50' | 'progress_75' | 'complete' | 'pause';
  max_percentage?: number;
  video_duration_seconds?: number;
  watch_time_seconds?: number;
  device_type?: 'desktop' | 'tablet' | 'mobile';
  referrer?: string;
}

function getDeviceType(userAgent: string): 'desktop' | 'tablet' | 'mobile' {
  const ua = userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/.test(ua)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: VideoEventPayload = await req.json();

    if (!payload.session_id || !payload.event_type) {
      return new Response(
        JSON.stringify({ error: 'session_id and event_type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validEventTypes = ['play', 'progress_25', 'progress_50', 'progress_75', 'complete', 'pause'];
    if (!validEventTypes.includes(payload.event_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid event_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userAgent = req.headers.get('user-agent') || '';
    const deviceType = payload.device_type || getDeviceType(userAgent);

    const { error } = await supabase
      .from('demo_video_analytics')
      .insert({
        session_id: payload.session_id,
        event_type: payload.event_type,
        max_percentage: payload.max_percentage || 0,
        video_duration_seconds: payload.video_duration_seconds,
        watch_time_seconds: payload.watch_time_seconds || 0,
        device_type: deviceType,
        user_agent: userAgent.substring(0, 500),
        referrer: payload.referrer?.substring(0, 500),
      });

    if (error) {
      console.error('[TRACK-VIDEO] Insert error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to track event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[TRACK-VIDEO] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
