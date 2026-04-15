import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrackEmailEventRequest {
  queueId: string;
  eventType: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained';
  eventData?: Record<string, any>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Handle both GET (tracking pixel) and POST (webhook) requests
    let queueId: string;
    let broadcastRecipientId: string = '';
    let eventType: string;
    let eventData: Record<string, any> = {};

    if (req.method === 'GET') {
      // Tracking pixel or click tracking request
      const url = new URL(req.url);
      queueId = url.searchParams.get('queueId') || '';
      broadcastRecipientId = url.searchParams.get('broadcastRecipientId') || '';
      eventType = url.searchParams.get('event') || 'opened';

      // Handle click redirect
      const redirect = url.searchParams.get('redirect');

      if (!queueId && !broadcastRecipientId) {
        const pixel = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));
        return new Response(pixel, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });
      }

      // Handle broadcast recipient tracking
      if (broadcastRecipientId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'public' } });

        // Get the recipient to find campaign_id
        const { data: recipient } = await supabase
          .from('broadcast_recipients')
          .select('id, campaign_id, status')
          .eq('id', broadcastRecipientId)
          .maybeSingle();

        if (recipient) {
          const now = new Date().toISOString();

          if (eventType === 'opened' && recipient.status === 'sent') {
            await supabase
              .from('broadcast_recipients')
              .update({ status: 'opened', opened_at: now })
              .eq('id', broadcastRecipientId);

            // Increment campaign counter
            await supabase.rpc('increment_broadcast_stat', {
              p_campaign_id: recipient.campaign_id,
              p_stat: 'total_opened',
            }).then(null, () => {
              // Fallback if RPC doesn't exist yet
              supabase
                .from('broadcast_campaigns')
                .select('total_opened')
                .eq('id', recipient.campaign_id)
                .single()
                .then(({ data }) => {
                  if (data) {
                    supabase
                      .from('broadcast_campaigns')
                      .update({ total_opened: (data.total_opened || 0) + 1 })
                      .eq('id', recipient.campaign_id);
                  }
                });
            });
          } else if (eventType === 'clicked') {
            const updateData: any = { clicked_at: now };
            if (recipient.status === 'sent' || recipient.status === 'opened') {
              updateData.status = 'clicked';
            }
            await supabase
              .from('broadcast_recipients')
              .update(updateData)
              .eq('id', broadcastRecipientId);

            // Increment campaign click counter
            await supabase
              .from('broadcast_campaigns')
              .select('total_clicked')
              .eq('id', recipient.campaign_id)
              .single()
              .then(({ data }) => {
                if (data) {
                  supabase
                    .from('broadcast_campaigns')
                    .update({ total_clicked: (data.total_clicked || 0) + 1 })
                    .eq('id', recipient.campaign_id);
                }
              });
          }
        }

        // For click events, redirect
        if (eventType === 'clicked' && redirect) {
          return new Response(null, {
            status: 302,
            headers: { ...corsHeaders, 'Location': redirect },
          });
        }

        // Return tracking pixel for open events
        const pixel = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));
        return new Response(pixel, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });
      }
    } else {
      // POST webhook request
      const body: TrackEmailEventRequest = await req.json();
      queueId = body.queueId;
      eventType = body.eventType;
      eventData = body.eventData || {};
    }

    console.log('Tracking email event:', { queueId, eventType });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // Get client info
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Check if this event already exists (prevent duplicate tracking)
    if (eventType === 'opened' || eventType === 'clicked') {
      const { data: existingEvent } = await supabase
        .from('email_tracking')
        .select('id')
        .eq('profile_email_queue_id', queueId)
        .eq('event_type', eventType)
        .maybeSingle();

      if (existingEvent) {
        console.log('Event already tracked, skipping duplicate');
        
        if (req.method === 'GET') {
          // Return tracking pixel
          const pixel = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));
          return new Response(pixel, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'image/gif',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          });
        }
        
        return new Response(
          JSON.stringify({ success: true, message: 'Event already tracked' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Insert tracking event
    const { error: trackingError } = await supabase
      .from('email_tracking')
      .insert({
        profile_email_queue_id: queueId,
        event_type: eventType,
        event_data: eventData,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

    if (trackingError) {
      console.error('Error inserting tracking event:', trackingError);
    } else {
      console.log('Email event tracked successfully');
    }

    // Return appropriate response
    if (req.method === 'GET') {
      // Return transparent 1x1 pixel
      const pixel = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));
      return new Response(pixel, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Event tracked successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in track-email-event:', error);
    
    // Always return pixel for GET requests, even on error
    if (req.method === 'GET') {
      const pixel = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));
      return new Response(pixel, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});