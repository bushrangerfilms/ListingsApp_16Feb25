import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KIE_API_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB - matches bucket limit
const RATE_LIMIT_BATCH_SIZE = 1; // Submit 1 at a time
const RATE_LIMIT_DELAY_MS = 0; // No batch delay needed with single requests
const REQUEST_STAGGER_MS = 20000; // 20 seconds between each request

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface BatchUpscaleRequest {
  organizationId: string;
  dryRun?: boolean; // If true, only report what would be upscaled without submitting
}

async function getFileSize(url: string): Promise<number> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      return parseInt(contentLength, 10);
    }
    const fullResponse = await fetch(url);
    const blob = await fullResponse.blob();
    return blob.size;
  } catch (error) {
    console.error('Error getting file size:', error);
    return 0;
  }
}

async function submitUpscaleJob(
  imageUrl: string,
  callbackUrl: string,
  kieApiKey: string
): Promise<{ taskId: string } | null> {
  try {
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
          upscale_factor: '4',  // 4x upscale (8K) - using streaming upload to avoid memory limits
        },
      }),
    });

    const data = await response.json();
    
    // API returns taskId (camelCase) in data object
    if (data.code === 200 && (data.data?.taskId || data.data?.task_id)) {
      return { taskId: data.data.taskId || data.data.task_id };
    }
    
    console.error('Kie.ai API error:', data);
    return null;
  } catch (error) {
    console.error('Error submitting upscale job:', error);
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

    if (!kieApiKey) {
      return new Response(
        JSON.stringify({ error: 'KIE_AI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify authentication (super_admin or developer only)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is super_admin or developer
    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single();

    if (!userOrg || !['super_admin', 'developer'].includes(userOrg.role)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - requires super_admin or developer role' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestData: BatchUpscaleRequest = await req.json();
    const { organizationId, dryRun = false } = requestData;

    // Verify user has access to the target organization (must match their org or be super_admin)
    if (organizationId !== userOrg.organization_id && userOrg.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden - you can only process your own organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BATCH-UPSCALE] Starting batch upscale for org: ${organizationId}, dryRun: ${dryRun}`);

    // Get the webhook callback URL with secret
    const webhookSecret = Deno.env.get('TOPAZ_WEBHOOK_SECRET') || kieApiKey.slice(0, 16);
    const callbackUrl = `${supabaseUrl}/functions/v1/topaz-webhook?secret=${encodeURIComponent(webhookSecret)}`;

    // Get all listings for this organization with social media photos
    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select('id, title, social_media_photos, photos, organization_id')
      .eq('organization_id', organizationId)
      .eq('archived', false);

    if (listingsError) {
      console.error('[BATCH-UPSCALE] Failed to fetch listings:', listingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch listings', details: listingsError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BATCH-UPSCALE] Found ${listings?.length || 0} listings for org ${organizationId}`);
    
    // Debug: Log what's in social_media_photos for first listing
    if (listings && listings.length > 0) {
      console.log('[BATCH-UPSCALE] First listing social_media_photos:', JSON.stringify(listings[0].social_media_photos));
      console.log('[BATCH-UPSCALE] First listing photos:', JSON.stringify(listings[0].photos));
    }

    const results = {
      totalListings: listings?.length || 0,
      totalPhotos: 0,
      submitted: 0,
      skipped: 0,
      alreadyProcessed: 0,
      tooLarge: 0,
      errors: 0,
      estimatedCost: 0,
      listings: [] as {
        id: string;
        title: string;
        photosProcessed: number;
        photosSkipped: number;
      }[],
    };

    for (const listing of listings || []) {
      // Parse social_media_photos - it's stored as JSON
      let socialPhotos: string[] = [];
      if (listing.social_media_photos) {
        if (Array.isArray(listing.social_media_photos)) {
          socialPhotos = listing.social_media_photos as string[];
        } else if (typeof listing.social_media_photos === 'string') {
          try {
            socialPhotos = JSON.parse(listing.social_media_photos);
          } catch {
            console.error('[BATCH-UPSCALE] Failed to parse social_media_photos for listing', listing.id);
          }
        }
      }
      
      // Skip listings with no social media photos
      if (socialPhotos.length === 0) {
        continue;
      }
      
      let listingSubmitted = 0;
      let listingSkipped = 0;

      for (let i = 0; i < socialPhotos.length; i++) {
        results.totalPhotos++;
        const photoUrl = socialPhotos[i];

        // Check if already processed - match by listing_id and photo_index
        // (not original_url since signed URLs change)
        const { data: existingJobs } = await supabase
          .from('photo_upscale_jobs')
          .select('id, status')
          .eq('listing_id', listing.id)
          .eq('photo_index', i)
          .order('created_at', { ascending: false })
          .limit(1);

        const existingJob = existingJobs?.[0];
        if (existingJob && ['completed', 'processing'].includes(existingJob.status)) {
          results.alreadyProcessed++;
          listingSkipped++;
          continue;
        }

        // Check file size
        const fileSize = await getFileSize(photoUrl);

        if (fileSize === 0) {
          results.errors++;
          continue;
        }

        if (fileSize > MAX_FILE_SIZE) {
          results.tooLarge++;
          listingSkipped++;
          
          if (!dryRun) {
            await supabase.from('photo_upscale_jobs').upsert({
              listing_id: listing.id,
              organization_id: listing.organization_id,
              photo_type: 'social_media',
              photo_index: i,
              original_url: photoUrl,
              status: 'skipped',
              original_file_size: fileSize,
              error_message: 'File size exceeds 10MB limit',
            }, { onConflict: 'job_id' });
          }
          continue;
        }

        if (dryRun) {
          results.submitted++;
          results.estimatedCost += 0.02;
          listingSubmitted++;
        } else {
          // Rate limiting: wait before each request (except the first)
          if (results.submitted > 0) {
            console.log(`[BATCH-UPSCALE] Rate limit: waiting ${REQUEST_STAGGER_MS}ms before request ${results.submitted + 1}`);
            await delay(REQUEST_STAGGER_MS);
          }

          // Submit to Kie.ai
          const jobResult = await submitUpscaleJob(photoUrl, callbackUrl, kieApiKey);

          if (jobResult) {
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
            results.estimatedCost += 0.02;
            listingSubmitted++;
          } else {
            results.errors++;
          }
        }
      }

      results.listings.push({
        id: listing.id,
        title: listing.title,
        photosProcessed: listingSubmitted,
        photosSkipped: listingSkipped,
      });
    }

    results.skipped = results.alreadyProcessed + results.tooLarge;

    console.log('[BATCH-UPSCALE] Results:', JSON.stringify(results, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        message: dryRun 
          ? `Dry run complete. Would upscale ${results.submitted} photos (~$${results.estimatedCost.toFixed(2)})`
          : `Submitted ${results.submitted} photos for upscaling`,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[BATCH-UPSCALE] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
