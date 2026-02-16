/**
 * @deprecated LEGACY SINGLE-TENANT MIGRATION FUNCTION
 * This function uses hardcoded Airtable credentials for Bridge Auctioneers only.
 * It was created for a one-time migration from Airtable to Supabase.
 * NOT suitable for multi-tenant use - do not invoke in production.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting hero photo fix process...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // Get Airtable credentials for Bridge Auctioneers
    const airtablePat = Deno.env.get('AIRTABLE_PAT_BRIDGE_AUCTIONEERS');
    const airtableBaseId = Deno.env.get('AIRTABLE_BASE_ID_BRIDGE_AUCTIONEERS');
    const airtableTableName = Deno.env.get('AIRTABLE_TABLE_NAME_BRIDGE_AUCTIONEERS');

    if (!airtablePat || !airtableBaseId || !airtableTableName) {
      throw new Error('Missing Airtable credentials');
    }

    console.log(`Fetching records from Airtable base: ${airtableBaseId}, table: ${airtableTableName}`);

    // Fetch all records from Airtable
    const airtableUrl = `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableName}`;
    const airtableResponse = await fetch(airtableUrl, {
      headers: {
        'Authorization': `Bearer ${airtablePat}`,
        'Content-Type': 'application/json',
      },
    });

    if (!airtableResponse.ok) {
      throw new Error(`Airtable API error: ${airtableResponse.statusText}`);
    }

    const airtableData = await airtableResponse.json();
    const records = airtableData.records || [];
    console.log(`Found ${records.length} records in Airtable`);

    const results = {
      total: records.length,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
      details: [] as any[],
    };

    // Helper function to migrate photo to Supabase Storage
    async function migratePhotoToSupabase(
      attachment: any,
      recordId: string,
      index: number
    ): Promise<string> {
      const photoUrl = attachment.url;
      const photoResponse = await fetch(photoUrl);
      
      if (!photoResponse.ok) {
        throw new Error(`Failed to download photo: ${photoResponse.statusText}`);
      }

      const photoBlob = await photoResponse.blob();
      const fileExt = attachment.filename?.split('.').pop() || 'jpg';
      const fileName = `${recordId}-${index}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('listing-photos')
        .upload(fileName, photoBlob, {
          contentType: attachment.type || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('listing-photos')
        .getPublicUrl(fileName);

      return publicUrl;
    }

    // Process each record
    for (const record of records) {
      const recordId = record.id;
      console.log(`\n=== Processing record ${recordId} ===`);
      console.log('Available fields:', Object.keys(record.fields));

      // Try to find hero photo in various field names
      const possibleFields = ['Hero Photo', 'Hero photo', 'hero_photo', 'heroPhoto'];
      let heroPhotoUrl: string | null = null;
      let foundInField: string | null = null;

      for (const fieldName of possibleFields) {
        const fieldValue = record.fields[fieldName];
        if (fieldValue && Array.isArray(fieldValue) && fieldValue.length > 0) {
          console.log(`Found Hero Photo in field "${fieldName}"`);
          console.log('Hero Photo data:', JSON.stringify(fieldValue[0]));
          foundInField = fieldName;

          try {
            heroPhotoUrl = await migratePhotoToSupabase(
              fieldValue[0],
              recordId,
              -1 // Special index for hero photos
            );
            console.log(`✓ Successfully migrated hero photo: ${heroPhotoUrl}`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`✗ Failed to migrate hero photo: ${errorMessage}`);
            results.errors.push(`${recordId}: ${errorMessage}`);
          }
          break;
        }
      }

      if (!heroPhotoUrl) {
        console.log('No Hero Photo found in Airtable, skipping...');
        results.skipped++;
        results.details.push({
          recordId,
          status: 'skipped',
          reason: 'No hero photo field found in Airtable',
        });
        continue;
      }

      // Update the database with the new hero photo URL
      try {
        const { error: updateError } = await supabase
          .from('listings')
          .update({ hero_photo: heroPhotoUrl })
          .eq('airtable_record_id', recordId);

        if (updateError) {
          throw new Error(`Database update failed: ${updateError.message}`);
        }

        console.log(`✓ Updated database with new hero photo`);
        results.updated++;
        results.details.push({
          recordId,
          status: 'success',
          foundInField,
          newUrl: heroPhotoUrl,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`✗ Failed to update database: ${errorMessage}`);
        results.errors.push(`${recordId}: ${errorMessage}`);
      }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`Total records: ${results.total}`);
    console.log(`Updated: ${results.updated}`);
    console.log(`Skipped: ${results.skipped}`);
    console.log(`Errors: ${results.errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Hero photo migration complete',
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error during hero photo fix:', errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
