import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { reportToSentry } from '../_shared/sentry-report.ts';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const clientSlug = formData.get('clientSlug') as string;
    const images = formData.getAll('images') as File[];
    const heroIndex = parseInt(formData.get('heroIndex') as string || '0');

    if (!clientSlug || images.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Client slug and images are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (images.length > 70) {
      return new Response(
        JSON.stringify({ error: 'Maximum 70 images allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Per-file size limit: 10MB max per image
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    for (let i = 0; i < images.length; i++) {
      if (images[i].size > MAX_FILE_SIZE) {
        return new Response(
          JSON.stringify({ error: `Image ${i + 1} exceeds 10MB limit (${(images[i].size / 1024 / 1024).toFixed(1)}MB)` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Processing ${images.length} images for client: ${clientSlug}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // Rate limit: 20 per hour per client
    const rateLimitId = clientSlug || 'unknown';
    const rateCheck = await checkRateLimit(supabase, rateLimitId, {
      feature: 'process-images',
      maxRequests: 20,
      windowMinutes: 60,
    });
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetTime: rateCheck.resetTime }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const uploadedUrls: string[] = [];
    let heroPhotoUrl = '';

    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      const timestamp = Date.now();
      
      // Sanitize filename - extract extension and create clean filename
      const extension = file.type.split('/')[1] || 'jpg';
      const fileName = `${clientSlug}/${timestamp}-${i}.${extension}`;

      console.log(`Uploading image ${i + 1}/${images.length}: ${fileName}`);

      // Upload to storage
      const { data, error } = await supabase.storage
        .from('listing-photos')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false
        });

      if (error) {
        console.error(`Error uploading image ${i}:`, error);
        continue;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('listing-photos')
        .getPublicUrl(fileName);

      uploadedUrls.push(publicUrl);

      // Set hero photo URL
      if (i === heroIndex) {
        heroPhotoUrl = publicUrl;
      }

      console.log(`Successfully uploaded: ${publicUrl}`);
    }

    // If no hero photo was set (e.g., heroIndex out of range), use the first photo
    if (!heroPhotoUrl && uploadedUrls.length > 0) {
      heroPhotoUrl = uploadedUrls[0];
    }

    console.log(`Successfully processed ${uploadedUrls.length} images. Hero photo: ${heroPhotoUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        photoUrls: uploadedUrls,
        heroPhotoUrl,
        count: uploadedUrls.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    reportToSentry(error, { functionName: 'process-images' }).catch(() => {});
    console.error('Error in process-images:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});