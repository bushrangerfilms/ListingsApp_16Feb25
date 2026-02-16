import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Kie.ai actual payload structure (from actual webhook logs)
interface KieAiPayload {
  code?: number;           // 200 = success, 400+ = error
  msg?: string;            // Human-readable message
  taskId?: string;         // Task ID at top level (sometimes)
  data?: {
    taskId?: string;       // Task ID inside data
    task_id?: string;      // Alternative field name
    state?: string;        // "success", "failed", etc.
    resultJson?: string;   // JSON string containing resultUrls array!
    image_url?: string;    // Direct image URL (sometimes)
    result_image_url?: string;
    result_urls?: string[];
  } | null;
}

async function downloadAndUploadImageStreaming(
  sourceUrl: string,
  supabaseUrl: string,
  serviceRoleKey: string,
  listingId: string,
  photoIndex: number,
  upscaleFactor: string = '4x'
): Promise<{ url: string; size: number } | null> {
  try {
    console.log(`[TOPAZ-WEBHOOK] Starting streaming upload for ${sourceUrl.substring(0, 100)}...`);
    
    // Fetch the image - don't buffer, keep as stream
    const downloadResponse = await fetch(sourceUrl);
    if (!downloadResponse.ok) {
      throw new Error(`Failed to download image: ${downloadResponse.status}`);
    }

    // Get content length from upstream if available
    const contentLength = downloadResponse.headers.get('content-length');
    const contentType = downloadResponse.headers.get('content-type') || 'image/jpeg';
    
    // Determine file extension based on actual content type
    let fileExt = 'jpg';
    if (contentType.includes('png')) {
      fileExt = 'png';
    } else if (contentType.includes('webp')) {
      fileExt = 'webp';
    } else if (contentType.includes('tiff')) {
      fileExt = 'tiff';
    }
    
    console.log(`[TOPAZ-WEBHOOK] Image content-length: ${contentLength}, type: ${contentType}, ext: ${fileExt}`);

    // Generate a unique filename with correct extension
    const timestamp = Date.now();
    const resolution = upscaleFactor === '4' ? '8k' : (upscaleFactor === '2' ? '4k' : '2k');
    const filename = `upscaled/${listingId}/social_${photoIndex}_${resolution}_${timestamp}.${fileExt}`;
    const bucket = 'listing-photos';

    // Use Supabase Storage REST API directly for streaming upload
    // This bypasses the JS SDK which buffers everything
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${filename}`;
    
    const uploadHeaders: Record<string, string> = {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
      'Content-Type': contentType,
      'x-upsert': 'true',
    };
    
    // Add content-length if known (helps with upload reliability)
    if (contentLength) {
      uploadHeaders['Content-Length'] = contentLength;
    }

    console.log(`[TOPAZ-WEBHOOK] Streaming to: ${uploadUrl}`);

    // Stream the response body directly to Supabase Storage
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: uploadHeaders,
      body: downloadResponse.body, // Stream directly, no buffering!
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log(`[TOPAZ-WEBHOOK] Upload successful:`, uploadResult);

    // Construct the public URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${filename}`;
    const fileSize = contentLength ? parseInt(contentLength, 10) : 0;

    return { url: publicUrl, size: fileSize };
  } catch (error) {
    console.error('[TOPAZ-WEBHOOK] Error in streaming upload:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const kieApiKey = Deno.env.get('KIE_AI_API_KEY') || Deno.env.get('KIE_API_KEY');
    const webhookSecret = Deno.env.get('TOPAZ_WEBHOOK_SECRET') || (kieApiKey ? kieApiKey.slice(0, 16) : '');

    // Log incoming request details for debugging
    console.log('[TOPAZ-WEBHOOK] Request URL:', req.url);
    
    // TODO: Re-enable secret verification after Kie.ai callback issue is resolved
    // Kie.ai does NOT preserve query parameters in callback URLs, so we skip verification
    console.log('[TOPAZ-WEBHOOK] Secret verification DISABLED for Kie.ai compatibility');

    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: KieAiPayload = await req.json();
    
    console.log('[TOPAZ-WEBHOOK] Received callback:', JSON.stringify(payload));

    // Extract task ID - inside data.taskId or data.task_id or top-level
    const taskId = payload.data?.taskId || payload.data?.task_id || payload.taskId;
    
    // Success is determined by code === 200 or data.state === "success"
    const isSuccess = payload.code === 200 || payload.data?.state === 'success';
    const isFailed = (payload.code !== undefined && payload.code !== 200) || payload.data?.state === 'failed';
    
    // Extract image URL - may be in resultJson (JSON string) or direct fields
    let imageUrl: string | undefined;
    
    // First try to parse resultJson if present
    if (payload.data?.resultJson) {
      try {
        const resultData = JSON.parse(payload.data.resultJson);
        imageUrl = resultData.resultUrls?.[0];
        console.log('[TOPAZ-WEBHOOK] Parsed resultJson, found URL:', !!imageUrl);
      } catch (e) {
        console.error('[TOPAZ-WEBHOOK] Failed to parse resultJson:', e);
      }
    }
    
    // Fallback to direct fields
    if (!imageUrl) {
      imageUrl = payload.data?.image_url || 
                 payload.data?.result_image_url || 
                 payload.data?.result_urls?.[0];
    }
    
    // Error message from msg field
    const errorMessage = payload.msg;

    console.log('[TOPAZ-WEBHOOK] Parsed values:', { 
      taskId, 
      code: payload.code, 
      state: payload.data?.state,
      isSuccess, 
      isFailed,
      imageUrl: imageUrl || false, 
      errorMessage 
    });

    if (!taskId) {
      console.error('[TOPAZ-WEBHOOK] Missing task_id in payload. Full payload:', JSON.stringify(payload));
      return new Response(
        JSON.stringify({ error: 'Missing task_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[TOPAZ-WEBHOOK] Looking for job with task_id:', taskId);

    // Find the upscale job by job_id (primary) or kie_task_id (legacy) for compatibility
    let job = null;

    // First try job_id (current schema)
    const { data: jobByJobId } = await supabase
      .from('photo_upscale_jobs')
      .select('*')
      .eq('job_id', taskId)
      .limit(1);

    if (jobByJobId && jobByJobId.length > 0) {
      job = jobByJobId[0];
      console.log('[TOPAZ-WEBHOOK] Found job by job_id');
    } else {
      // Fallback to kie_task_id (legacy schema)
      const { data: jobByKieTaskId } = await supabase
        .from('photo_upscale_jobs')
        .select('*')
        .eq('kie_task_id', taskId)
        .limit(1);
      
      if (jobByKieTaskId && jobByKieTaskId.length > 0) {
        job = jobByKieTaskId[0];
        console.log('[TOPAZ-WEBHOOK] Found job by kie_task_id');
      }
    }

    if (!job) {
      console.error('[TOPAZ-WEBHOOK] Job not found:', taskId);
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[TOPAZ-WEBHOOK] Found job:', job.id, 'code:', payload.code, 'imageUrl:', !!imageUrl);

    // Success is determined by code === 200
    if (isSuccess && imageUrl) {
      console.log('[TOPAZ-WEBHOOK] Upscale completed, downloading and uploading...');

      // Download from Kie.ai CDN and stream directly to our storage
      // Using REST API for streaming (SDK buffers everything and causes memory issues)
      const uploadResult = await downloadAndUploadImageStreaming(
        imageUrl,
        supabaseUrl,
        supabaseKey,
        job.listing_id,
        job.photo_index,
        '4'  // 4x upscale = 8K resolution
      );

      if (uploadResult) {
        // Update the job record
        await supabase
          .from('photo_upscale_jobs')
          .update({
            status: 'completed',
            upscaled_url: uploadResult.url,
            upscaled_file_size: uploadResult.size,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        // Update the listing's social_media_photos array with upscaled URL for Socials app
        const { data: listing } = await supabase
          .from('listings')
          .select('social_media_photos')
          .eq('id', job.listing_id)
          .single();

        if (listing && listing.social_media_photos) {
          const updatedPhotos = [...listing.social_media_photos];
          if (job.photo_index < updatedPhotos.length) {
            updatedPhotos[job.photo_index] = uploadResult.url;
            
            await supabase
              .from('listings')
              .update({ social_media_photos: updatedPhotos })
              .eq('id', job.listing_id);

            console.log('[TOPAZ-WEBHOOK] Updated listing with upscaled photo at index:', job.photo_index);
          }
        }

        return new Response(
          JSON.stringify({ received: true, status: 'completed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Failed to download/upload
        await supabase
          .from('photo_upscale_jobs')
          .update({
            status: 'failed',
            error_message: 'Failed to download or upload upscaled image',
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);
      }
    } else if (isFailed) {
      console.error('[TOPAZ-WEBHOOK] Upscale failed:', errorMessage);

      await supabase
        .from('photo_upscale_jobs')
        .update({
          status: 'failed',
          error_message: errorMessage || 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[TOPAZ-WEBHOOK] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
