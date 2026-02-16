import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KIE_API_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB limit for upscaling

interface UpscaleRequest {
  listingId?: string;
  organizationId?: string;
  photoType?: 'hero' | 'social_media' | 'all_social_media';
  photoIndex?: number;  // For single photo upscaling
  photoUrl?: string;    // For single photo upscaling
}

// Supported image formats for Topaz upscaling
const SUPPORTED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff'];

interface ImageInfo {
  size: number;
  contentType: string;
  actualFormat: string;
  isSupported: boolean;
}

// Detect actual image format from magic bytes
function detectImageFormat(bytes: Uint8Array): string {
  if (bytes.length < 12) return 'unknown';
  
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }
  
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }
  
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }
  
  // HEIC/HEIF: Check for 'ftyp' box with heic/mif1/msf1/hevc brands
  // Offset 4-7 should be 'ftyp'
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'avif'].includes(brand)) {
      return 'image/heic';
    }
  }
  
  // TIFF: 49 49 2A 00 (little endian) or 4D 4D 00 2A (big endian)
  if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2A && bytes[3] === 0x00) ||
      (bytes[0] === 0x4D && bytes[1] === 0x4D && bytes[2] === 0x00 && bytes[3] === 0x2A)) {
    return 'image/tiff';
  }
  
  return 'unknown';
}

async function getImageInfo(url: string): Promise<ImageInfo> {
  try {
    // Fetch first 16 bytes to detect actual format
    const response = await fetch(url, {
      headers: { 'Range': 'bytes=0-15' }
    });
    
    let size = 0;
    let actualFormat = 'unknown';
    const contentType = response.headers.get('content-type') || 'unknown';
    
    // Check if range request was supported
    if (response.status === 206) {
      const contentRange = response.headers.get('content-range');
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)/);
        if (match) size = parseInt(match[1], 10);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      actualFormat = detectImageFormat(bytes);
    } else {
      // Range not supported, fetch whole file
      const bytes = new Uint8Array(await response.arrayBuffer());
      size = bytes.length;
      actualFormat = detectImageFormat(bytes);
    }
    
    // If we couldn't get size from range, try HEAD
    if (size === 0) {
      const headResponse = await fetch(url, { method: 'HEAD' });
      const contentLength = headResponse.headers.get('content-length');
      if (contentLength) size = parseInt(contentLength, 10);
    }
    
    const isSupported = ['image/jpeg', 'image/png', 'image/tiff'].includes(actualFormat);
    
    console.log('[UPSCALE] Image info:', { 
      url: url.substring(0, 80), 
      size, 
      contentType,
      actualFormat,
      isSupported 
    });
    
    return { size, contentType, actualFormat, isSupported };
  } catch (error) {
    console.error('Error getting image info:', error);
    return { size: 0, contentType: 'unknown', actualFormat: 'unknown', isSupported: false };
  }
}

async function getFileSize(url: string): Promise<number> {
  const info = await getImageInfo(url);
  return info.size;
}

async function submitUpscaleJob(
  imageUrl: string,
  callbackUrl: string,
  kieApiKey: string
): Promise<{ taskId: string; error?: string } | null> {
  try {
    console.log('[UPSCALE] Submitting job for image:', imageUrl.substring(0, 100) + '...');
    
    const response = await fetch(KIE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kieApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'topaz/image-upscale',
        callBackUrl: callbackUrl,
        input: {
          image_url: imageUrl,
          upscale_factor: '2',  // 2x upscale (4K)
        },
      }),
    });

    const data = await response.json();
    console.log('[UPSCALE] Kie.ai response:', JSON.stringify(data));
    
    // API returns taskId (camelCase) in data object
    if (data.code === 200 && (data.data?.taskId || data.data?.task_id)) {
      return { taskId: data.data.taskId || data.data.task_id };
    }
    
    // Return the error message from Kie.ai
    const errorMsg = data.msg || data.message || data.error || `Kie.ai error code: ${data.code}`;
    console.error('[UPSCALE] Kie.ai API error:', errorMsg, data);
    return { taskId: '', error: errorMsg };
  } catch (error) {
    console.error('[UPSCALE] Error submitting upscale job:', error);
    return { taskId: '', error: String(error) };
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

    if (!kieApiKey) {
      return new Response(
        JSON.stringify({ error: 'KIE_AI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[UPSCALE] Authenticated user:', user.email);

    // Get user's organization and verify access
    const { data: userOrg, error: userOrgError } = await supabase
      .from('user_organizations')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single();

    if (userOrgError || !userOrg) {
      return new Response(
        JSON.stringify({ error: 'User organization not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestData: UpscaleRequest = await req.json();

    // Get the webhook callback URL with secret
    const webhookSecret = Deno.env.get('TOPAZ_WEBHOOK_SECRET') || kieApiKey.slice(0, 16);
    const callbackUrl = `${supabaseUrl}/functions/v1/topaz-webhook?secret=${encodeURIComponent(webhookSecret)}`;

    console.log('[UPSCALE] Starting upscale job for listing:', requestData.listingId);

    // Single photo mode - process just one photo by index
    if (typeof requestData.photoIndex === 'number' && requestData.photoUrl) {
      console.log('[UPSCALE] Single photo mode - index:', requestData.photoIndex);
      
      // Get listing for organization check
      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .select('id, organization_id')
        .eq('id', requestData.listingId)
        .single();

      if (listingError || !listing) {
        return new Response(
          JSON.stringify({ error: 'Listing not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check file size and format
      const imageInfo = await getImageInfo(requestData.photoUrl);
      
      if (!imageInfo.isSupported) {
        const formatMsg = imageInfo.actualFormat !== 'unknown' 
          ? imageInfo.actualFormat 
          : imageInfo.contentType;
        return new Response(
          JSON.stringify({ 
            error: `Unsupported image format: ${formatMsg}. Topaz only supports JPEG, PNG, and TIFF. Please re-upload this photo in a supported format.` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const fileSize = imageInfo.size;
      if (fileSize > MAX_FILE_SIZE) {
        return new Response(
          JSON.stringify({ error: 'File too large', maxSize: MAX_FILE_SIZE, actualSize: fileSize }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Submit to Kie.ai
      const jobResult = await submitUpscaleJob(requestData.photoUrl, callbackUrl, kieApiKey);
      
      if (!jobResult || !jobResult.taskId) {
        const errorMsg = jobResult?.error || 'Failed to submit upscale job to Kie.ai';
        console.error('[UPSCALE] Job submission failed:', errorMsg);
        return new Response(
          JSON.stringify({ error: errorMsg }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create job record - use insert with error handling for duplicates
      const { error: insertError } = await supabase.from('photo_upscale_jobs').insert({
        listing_id: listing.id,
        organization_id: listing.organization_id,
        photo_type: 'social_media',
        photo_index: requestData.photoIndex,
        original_url: requestData.photoUrl,
        job_id: jobResult.taskId,
        status: 'processing',
        original_file_size: fileSize,
        started_at: new Date().toISOString(),
        error_message: null,
      });

      // If duplicate exists, update it instead
      if (insertError && insertError.code === '23505') {
        await supabase.from('photo_upscale_jobs')
          .update({
            job_id: jobResult.taskId,
            status: 'processing',
            original_file_size: fileSize,
            started_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('listing_id', listing.id)
          .eq('photo_index', requestData.photoIndex);
      }
      
      console.log('[UPSCALE] Job record created/updated with job_id:', jobResult.taskId);

      return new Response(
        JSON.stringify({
          success: true,
          taskId: jobResult.taskId,
          message: `Photo ${requestData.photoIndex + 1} submitted for upscaling`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Batch mode - process all photos for a listing
    // Get the listing
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, organization_id, social_media_photos, hero_photo')
      .eq('id', requestData.listingId)
      .single();

    if (listingError || !listing) {
      return new Response(
        JSON.stringify({ error: 'Listing not found', details: listingError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to this listing's organization
    if (listing.organization_id !== userOrg.organization_id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - you do not have access to this listing' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      submitted: 0,
      skipped: 0,
      errors: 0,
      details: [] as { url: string; status: string; reason?: string }[],
    };

    // Process social media photos
    const socialMediaPhotos = listing.social_media_photos || [];
    
    for (let i = 0; i < socialMediaPhotos.length; i++) {
      const photoUrl = socialMediaPhotos[i];
      
      // Check if already upscaled (job exists)
      const { data: existingJob } = await supabase
        .from('photo_upscale_jobs')
        .select('id, status')
        .eq('listing_id', listing.id)
        .eq('original_url', photoUrl)
        .single();

      if (existingJob && ['completed', 'processing'].includes(existingJob.status)) {
        results.skipped++;
        results.details.push({ 
          url: photoUrl, 
          status: 'skipped', 
          reason: `Already ${existingJob.status}` 
        });
        continue;
      }

      // Check file size
      const fileSize = await getFileSize(photoUrl);
      
      if (fileSize === 0) {
        results.errors++;
        results.details.push({ 
          url: photoUrl, 
          status: 'error', 
          reason: 'Could not determine file size' 
        });
        continue;
      }

      if (fileSize > MAX_FILE_SIZE) {
        // Skip files larger than 1MB
        results.skipped++;
        results.details.push({ 
          url: photoUrl, 
          status: 'skipped', 
          reason: `File size ${(fileSize / 1024 / 1024).toFixed(2)}MB exceeds 1MB limit` 
        });

        // Record as skipped in the database
        await supabase.from('photo_upscale_jobs').upsert({
          listing_id: listing.id,
          organization_id: listing.organization_id,
          photo_type: 'social_media',
          photo_index: i,
          original_url: photoUrl,
          status: 'skipped',
          original_file_size: fileSize,
          error_message: 'File size exceeds 1MB limit',
        }, { onConflict: 'job_id' });

        continue;
      }

      // Submit upscale job to Kie.ai
      const jobResult = await submitUpscaleJob(photoUrl, callbackUrl, kieApiKey);

      if (jobResult) {
        // Record the job in the database
        await supabase.from('photo_upscale_jobs').insert({
          listing_id: listing.id,
          organization_id: listing.organization_id,
          photo_type: 'social_media',
          photo_index: i,
          original_url: photoUrl,
          job_id: jobResult.taskId,
          status: 'processing',
          original_file_size: fileSize,
          started_at: new Date().toISOString(),
        });

        results.submitted++;
        results.details.push({ 
          url: photoUrl, 
          status: 'submitted',
        });
      } else {
        results.errors++;
        results.details.push({ 
          url: photoUrl, 
          status: 'error', 
          reason: 'Failed to submit to Kie.ai' 
        });
      }
    }

    console.log('[UPSCALE] Results:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Submitted ${results.submitted} photos for upscaling, skipped ${results.skipped}, errors: ${results.errors}`,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[UPSCALE] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
