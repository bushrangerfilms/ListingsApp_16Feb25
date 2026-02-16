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
    const { clientSlug } = await req.json();
    
    console.log('Starting migration from Airtable to Supabase for client:', clientSlug);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // Get Airtable credentials
    const airtablePat = Deno.env.get(`AIRTABLE_PAT_${clientSlug.toUpperCase().replace(/-/g, '_')}`);
    const airtableBaseId = Deno.env.get(`AIRTABLE_BASE_ID_${clientSlug.toUpperCase().replace(/-/g, '_')}`);
    const airtableTableName = Deno.env.get(`AIRTABLE_TABLE_NAME_${clientSlug.toUpperCase().replace(/-/g, '_')}`);

    if (!airtablePat || !airtableBaseId || !airtableTableName) {
      return new Response(
        JSON.stringify({ error: 'Airtable configuration not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all records from Airtable
    const airtableUrl = `https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(airtableTableName)}`;
    console.log('Fetching from Airtable:', airtableUrl);

    const airtableResponse = await fetch(airtableUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${airtablePat}`,
        'Content-Type': 'application/json',
      },
    });

    if (!airtableResponse.ok) {
      const errorText = await airtableResponse.text();
      console.error('Airtable API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch from Airtable', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const airtableData = await airtableResponse.json();
    console.log(`Fetched ${airtableData.records.length} records from Airtable`);

    let inserted = 0;
    let updated = 0;
    let errors = 0;

    // Helper function to migrate photo from Airtable to Supabase Storage
    const migratePhotoToSupabase = async (
      airtablePhoto: any,
      recordId: string,
      photoIndex: number
    ): Promise<string | null> => {
      try {
        console.log(`Downloading photo ${photoIndex} from Airtable for record ${recordId}`);
        
        // Download from Airtable CDN
        const response = await fetch(airtablePhoto.url);
        if (!response.ok) {
          console.error(`Failed to download photo: ${response.statusText}`);
          return null;
        }
        
        const arrayBuffer = await response.arrayBuffer();
        
        // Generate unique filename
        const extension = airtablePhoto.filename?.split('.').pop() || 'jpg';
        const filename = `${recordId}-${photoIndex}-${Date.now()}.${extension}`;
        
        console.log(`Uploading photo to Supabase Storage: ${filename}`);
        
        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('listing-photos')
          .upload(filename, arrayBuffer, {
            contentType: airtablePhoto.type || 'image/jpeg',
            upsert: true
          });
        
        if (error) {
          console.error(`Failed to upload photo ${photoIndex}:`, error);
          return null;
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('listing-photos')
          .getPublicUrl(filename);
        
        console.log(`Photo migrated successfully: ${publicUrl}`);
        return publicUrl;
      } catch (error) {
        console.error(`Error migrating photo ${photoIndex}:`, error);
        return null;
      }
    };

    // Process each Airtable record
    for (const record of airtableData.records) {
      try {
        // Check if record already exists in Supabase
        const { data: existing } = await supabase
          .from('listings')
          .select('id, organization_id')
          .eq('airtable_record_id', record.id)
          .maybeSingle();

        // If exists, we'll update it. If not, we'll insert.
        const shouldUpdate = !!existing;

        if (shouldUpdate) {
          console.log(`Updating existing record: ${record.id}`);
        } else {
          console.log(`Creating new record: ${record.id}`);
        }

        // Debug: Show all available Airtable fields
        console.log('DEBUG: Record ID:', record.id);
        console.log('DEBUG: Available fields:', Object.keys(record.fields));
        console.log('DEBUG: Hero Photo field value:', record.fields['Hero Photo']);

        // Migrate Hero Photo - try multiple field name variations
        let heroPhotoUrl: string | null = null;
        const possibleFields = ['Hero Photo', 'hero photo', 'HeroPhoto', 'Hero_Photo', 'hero_photo'];

        for (const fieldName of possibleFields) {
          const fieldValue = record.fields[fieldName];
          if (fieldValue && Array.isArray(fieldValue) && fieldValue.length > 0) {
            console.log('DEBUG: Found Hero Photo in field:', fieldName, 'for record:', record.id);
            try {
              heroPhotoUrl = await migratePhotoToSupabase(
                fieldValue[0],
                record.id,
                -1 // Special index for hero photos
              );
              console.log('DEBUG: Successfully migrated hero photo:', heroPhotoUrl);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              console.error('DEBUG: Failed to migrate hero photo:', errorMessage);
            }
            break;
          }
        }

        if (!heroPhotoUrl) {
          console.log('DEBUG: No Hero Photo found for record:', record.id, '- will use first gallery photo');
        }

        // Migrate photos from Airtable CDN to Supabase Storage
        const migratedPhotos: string[] = [];
        if (record.fields['Photos'] && Array.isArray(record.fields['Photos'])) {
          console.log(`Migrating ${record.fields['Photos'].length} photos for record ${record.id}`);
          for (let i = 0; i < record.fields['Photos'].length; i++) {
            const photoUrl = await migratePhotoToSupabase(
              record.fields['Photos'][i],
              record.id,
              i
            );
            if (photoUrl) {
              migratedPhotos.push(photoUrl);
            }
          }
          console.log(`Successfully migrated ${migratedPhotos.length} photos for record ${record.id}`);
        }

        // Map Airtable fields to Supabase columns
        const listingData = {
          airtable_record_id: record.id,
          title: record.fields['Listing Title'],
          status: record.fields['Status'] || 'Published',
          price: record.fields['Price €'],
          
          // CORRECTED ADDRESS MAPPING
          address: `${record.fields['Address Line 1'] || ''}, ${record.fields['Address Town'] || ''}, ${record.fields['County'] || ''}`.replace(/, ,/g, ',').trim(),
          address_detail: record.fields['Address Line 1'] || null,
          address_town: record.fields['Address Town'] || null,
          county: record.fields['County'] || null,
          eircode: record.fields['Eircode'] || null,
          
          // PROPERTY DETAILS
          bedrooms: record.fields['Bedrooms'],
          bathrooms: record.fields['Bathrooms'],
          ensuite: record.fields['Ensuite'] || null,
          building_type: record.fields['Building Type'],
          floor_area_size: record.fields['Building Size sqm'],
          land_size: record.fields['Land Size (Acres)'] || null,
          ber_rating: record.fields['BER Rating'],
          furnished: record.fields['Furnishing Status'] || null,
          
          // TEXT FIELDS
          description: record.fields['Description'],
          specs: record.fields['Specs (Dimensions / Services)'] || null,
          
          // PHOTOS
          photos: migratedPhotos,
          hero_photo: heroPhotoUrl || migratedPhotos[0] || null,
          social_media_photos: migratedPhotos.length > 0 ? migratedPhotos.slice(0, 15) : null,
          
          // METADATA
          slug: record.fields['Slug'] || null,
          booking_link: record.fields['Booking Platform Link'] || null,
          category: record.fields['Category'] || (record.fields['Building Type'] === 'Residential' ? 'Residential' : 'Commercial'),
          
          // DATES & STATUS
          date_posted: record.fields['Date Posted'] || new Date().toISOString().split('T')[0],
          status_changed_date: record.fields['Status Changed Date'] || null,
          new_status_set_date: record.fields['New Status Set Date'] || null,
          archived: record.fields['Archived'] || false,
        };

        // Upsert into Supabase (update if exists, insert if new)
        if (shouldUpdate) {
          const { error: updateError } = await supabase
            .from('listings')
            .update(listingData)
            .eq('airtable_record_id', record.id);
          
          if (updateError) {
            console.error(`Error updating record ${record.id}:`, updateError);
            errors++;
          } else {
            console.log(`Updated: ${record.id}`);
            updated++;
          }
        } else {
          // Need to add organization_id for new records
          // Get organization from clientSlug
          const { data: orgData } = await supabase
            .from('organizations')
            .select('id')
            .eq('slug', clientSlug)
            .single();
          
          if (!orgData) {
            console.error(`Organization not found for slug: ${clientSlug}`);
            errors++;
            continue;
          }
          
          const { error: insertError } = await supabase
            .from('listings')
            .insert([{ ...listingData, organization_id: orgData.id }]);
          
          if (insertError) {
            console.error(`Error inserting record ${record.id}:`, insertError);
            errors++;
          } else {
            console.log(`Inserted: ${record.id}`);
            inserted++;
          }
        }
      } catch (error) {
        console.error(`Error processing record ${record.id}:`, error);
        errors++;
      }
    }

    const report = {
      success: true,
      total_records: airtableData.records.length,
      inserted,
      updated,
      errors,
      message: `Migration complete: ${inserted} new records inserted, ${updated} existing records updated, ${errors} errors`,
    };

    console.log('Migration report:', report);

    return new Response(
      JSON.stringify(report),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in migrate-airtable-to-supabase:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
