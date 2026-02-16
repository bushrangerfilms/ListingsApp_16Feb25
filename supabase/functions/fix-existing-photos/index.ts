/**
 * @deprecated LEGACY SINGLE-TENANT MIGRATION FUNCTION
 * This function uses hardcoded Airtable credentials for Bridge Auctioneers only.
 * It was created for a one-time migration from Airtable to Supabase.
 * NOT suitable for multi-tenant use - do not invoke in production.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting photo migration for existing listings');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });
    
    // Get Airtable credentials
    const airtableToken = Deno.env.get('AIRTABLE_PAT_BRIDGE_AUCTIONEERS')!;
    const airtableBaseId = Deno.env.get('AIRTABLE_BASE_ID_BRIDGE_AUCTIONEERS')!;
    const airtableTableName = Deno.env.get('AIRTABLE_TABLE_NAME_BRIDGE_AUCTIONEERS')!;

    // Find listings with Airtable photo objects (not simple strings)
    const { data: listings, error: fetchError } = await supabase
      .from('listings')
      .select('id, airtable_record_id, title, photos')
      .not('airtable_record_id', 'is', null);

    if (fetchError) {
      console.error('Error fetching listings:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch listings', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${listings.length} migrated listings to check`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    // Helper function to check if photo is an Airtable photo object or JSON string
    const isAirtablePhoto = (photo: any): boolean => {
      if (!photo) return false;
      
      // If it's a string, try to parse it as JSON
      if (typeof photo === 'string') {
        try {
          const parsed = JSON.parse(photo);
          // Check if it's an Airtable photo object (has url, id, and thumbnails)
          return parsed.url && parsed.id && parsed.thumbnails;
        } catch {
          // Not valid JSON, could be a plain URL
          return false;
        }
      }
      
      // If it's already an object, check directly
      return typeof photo === 'object' && photo.url && photo.id && photo.thumbnails;
    };

    // Helper function to migrate photo to Supabase Storage
    const migratePhotoToSupabase = async (
      photoUrl: string,
      listingId: string,
      photoIndex: number,
      filename?: string
    ): Promise<string | null> => {
      try {
        console.log(`Downloading photo ${photoIndex} for listing ${listingId} from: ${photoUrl}`);
        
        const response = await fetch(photoUrl);
        if (!response.ok) {
          console.error(`Failed to download photo: ${response.statusText}`);
          return null;
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const extension = filename?.split('.').pop() || 'jpg';
        const storageName = `${listingId}-${photoIndex}-${Date.now()}.${extension}`;
        
        console.log(`Uploading photo to Supabase Storage: ${storageName}`);
        
        const { data, error } = await supabase.storage
          .from('listing-photos')
          .upload(storageName, arrayBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });
        
        if (error) {
          console.error(`Failed to upload photo:`, error);
          return null;
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('listing-photos')
          .getPublicUrl(storageName);
        
        console.log(`Photo migrated: ${publicUrl}`);
        return publicUrl;
      } catch (error) {
        console.error(`Error migrating photo:`, error);
        return null;
      }
    };
    
    // Helper function to fetch hero photo URL and social media photos from Airtable
    const fetchPhotosFromAirtable = async (airtableRecordId: string): Promise<{ heroPhoto: string | null, socialMediaPhotos: string[] }> => {
      try {
        const url = `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableName}/${airtableRecordId}`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${airtableToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          console.error(`Failed to fetch from Airtable: ${response.statusText}`);
          return { heroPhoto: null, socialMediaPhotos: [] };
        }
        
        const record = await response.json();
        
        // Hero Photo is a URL field in Airtable
        const heroPhotoUrl = record.fields?.['Hero Photo'] || null;
        
        // Social Media Photos are attachment fields
        const socialMediaAttachments = record.fields?.['Social Media Photos'] || [];
        const socialMediaUrls: string[] = [];
        
        for (let i = 0; i < Math.min(socialMediaAttachments.length, 15); i++) {
          const attachment = socialMediaAttachments[i];
          if (attachment?.url) {
            const migratedUrl = await migratePhotoToSupabase(
              attachment.url,
              airtableRecordId,
              1000 + i, // Use 1000+ for social media photos
              attachment.filename
            );
            if (migratedUrl) {
              socialMediaUrls.push(migratedUrl);
            }
          }
        }
        
        return { heroPhoto: heroPhotoUrl, socialMediaPhotos: socialMediaUrls };
      } catch (error) {
        console.error(`Error fetching from Airtable:`, error);
        return { heroPhoto: null, socialMediaPhotos: [] };
      }
    };

    // Process each listing
    for (const listing of listings) {
      try {
        const photos = listing.photos || [];
        
        // Debug logging to see actual data structure
        console.log(`\n=== Listing ${listing.title} ===`);
        console.log(`Total photos: ${photos.length}`);
        if (photos.length > 0) {
          console.log(`First photo type: ${typeof photos[0]}`);
          console.log(`First photo sample:`, JSON.stringify(photos[0]).substring(0, 200));
        }
        
        // Fetch hero photo URL and social media photos from Airtable
        let heroPhotoUrl: string | null = null;
        let socialMediaPhotos: string[] = [];
        let photosUpdated = false;
        
        if (listing.airtable_record_id) {
          console.log(`Fetching photos from Airtable for ${listing.title}...`);
          const airtablePhotos = await fetchPhotosFromAirtable(listing.airtable_record_id);
          heroPhotoUrl = airtablePhotos.heroPhoto;
          socialMediaPhotos = airtablePhotos.socialMediaPhotos;
          photosUpdated = !!(heroPhotoUrl || socialMediaPhotos.length > 0);
        }
        
        // Check if gallery photos need migration (are still in Airtable format)
        const hasAirtablePhotos = photos.some((p: any) => isAirtablePhoto(p));
        
        if (!hasAirtablePhotos && !photosUpdated) {
          console.log(`Listing ${listing.title}: Gallery already migrated and no photos to update, skipping`);
          skipped++;
          continue;
        }

        // Migrate gallery photos if needed
        const migratedPhotos: string[] = [];
        if (hasAirtablePhotos) {
          console.log(`Listing ${listing.title}: Migrating gallery photos...`);
          for (let i = 0; i < photos.length; i++) {
            const photo = photos[i];
            
            if (isAirtablePhoto(photo)) {
              // Parse the JSON string to get the Airtable object
              const parsed = typeof photo === 'string' ? JSON.parse(photo) : photo;
              const newUrl = await migratePhotoToSupabase(
                parsed.url,
                listing.airtable_record_id || listing.id,
                i,
                parsed.filename
              );
              if (newUrl) {
                migratedPhotos.push(newUrl);
              }
            } else if (typeof photo === 'string') {
              // Check if it's already a Supabase Storage URL
              if (photo.includes('supabase.co/storage')) {
                migratedPhotos.push(photo);
              } else {
                console.log(`Skipping unknown URL format: ${photo.substring(0, 50)}...`);
              }
            }
          }
        } else {
          // Keep existing photos if they're already migrated
          migratedPhotos.push(...photos.filter((p: string) => typeof p === 'string'));
        }

        // Update listing with new photo URLs
        const updateData: any = {};
        if (hasAirtablePhotos) {
          updateData.photos = migratedPhotos;
        }
        if (heroPhotoUrl) {
          updateData.hero_photo = heroPhotoUrl;
        }
        if (socialMediaPhotos.length > 0) {
          updateData.social_media_photos = socialMediaPhotos;
        }
        
        if (Object.keys(updateData).length === 0) {
          console.log(`Nothing to update for ${listing.title}`);
          skipped++;
          continue;
        }
        
        const { error: updateError } = await supabase
          .from('listings')
          .update(updateData)
          .eq('id', listing.id);

        if (updateError) {
          console.error(`Error updating listing ${listing.title}:`, updateError);
          errors++;
        } else {
          console.log(`Updated ${listing.title}: ${migratedPhotos.length} photos migrated`);
          updated++;
        }
      } catch (error) {
        console.error(`Error processing listing ${listing.title}:`, error);
        errors++;
      }
    }

    const report = {
      success: true,
      total_checked: listings.length,
      updated,
      skipped,
      errors,
      message: `Photo migration complete: ${updated} listings updated, ${skipped} already had Supabase URLs, ${errors} errors`,
    };

    console.log('Migration report:', report);

    return new Response(
      JSON.stringify(report),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fix-existing-photos:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
