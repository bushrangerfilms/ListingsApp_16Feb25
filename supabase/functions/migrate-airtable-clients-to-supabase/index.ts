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
    console.log('Starting migration of Real Estate Clients from Airtable to Supabase');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // Get Airtable credentials for Real Estate Clients base
    // This is separate from the listings base
    const airtablePat = Deno.env.get('AIRTABLE_PAT_CLIENTS');
    const airtableBaseId = Deno.env.get('AIRTABLE_BASE_ID_CLIENTS');
    const airtableTableName = Deno.env.get('AIRTABLE_TABLE_NAME_CLIENTS') || 'Real Estate Clients';

    console.log('Checking Airtable credentials:');
    console.log('- PAT exists:', !!airtablePat);
    console.log('- PAT length:', airtablePat?.length || 0);
    console.log('- Base ID:', airtableBaseId);
    console.log('- Table Name:', airtableTableName);

    if (!airtablePat || !airtableBaseId) {
      return new Response(
        JSON.stringify({ 
          error: 'Airtable configuration not found',
          message: 'Please set AIRTABLE_PAT_CLIENTS and AIRTABLE_BASE_ID_CLIENTS environment variables',
          debug: {
            hasPat: !!airtablePat,
            hasBaseId: !!airtableBaseId
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all records from Airtable Real Estate Clients table
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
    console.log(`Fetched ${airtableData.records.length} client records from Airtable`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    const results: any[] = [];

    // Helper function to migrate logo from Airtable to Supabase Storage
    const migrateLogoToSupabase = async (
      airtableLogo: any,
      clientSlug: string
    ): Promise<string | null> => {
      try {
        console.log(`Downloading logo for client: ${clientSlug}`);
        
        // Download from Airtable CDN
        const response = await fetch(airtableLogo.url);
        if (!response.ok) {
          console.error(`Failed to download logo: ${response.statusText}`);
          return null;
        }
        
        const arrayBuffer = await response.arrayBuffer();
        
        // Generate unique filename
        const extension = airtableLogo.filename?.split('.').pop() || 'png';
        const filename = `${clientSlug}-logo.${extension}`;
        
        console.log(`Uploading logo to Supabase Storage: ${filename}`);
        
        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('organization-logos')
          .upload(filename, arrayBuffer, {
            contentType: airtableLogo.type || 'image/png',
            upsert: true
          });
        
        if (error) {
          console.error(`Failed to upload logo:`, error);
          return null;
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('organization-logos')
          .getPublicUrl(filename);
        
        console.log(`Logo migrated successfully: ${publicUrl}`);
        return publicUrl;
      } catch (error) {
        console.error(`Error migrating logo:`, error);
        return null;
      }
    };

    // Helper function to create slug from business name
    const createSlug = (businessName: string): string => {
      return businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    };

    // Process each Airtable record
    for (const record of airtableData.records) {
      try {
        const businessName = record.fields['Business Name'];
        if (!businessName) {
          console.log(`Skipping record ${record.id}: No business name`);
          skipped++;
          continue;
        }

        const slug = createSlug(businessName);

        // Check if organization already exists
        const { data: existing } = await supabase
          .from('organizations')
          .select('id, slug')
          .eq('slug', slug)
          .maybeSingle();

        if (existing) {
          console.log(`Skipping duplicate: ${slug}`);
          results.push({ slug, status: 'skipped', reason: 'already exists' });
          skipped++;
          continue;
        }

        // Migrate logo if exists
        let logoUrl = null;
        if (record.fields['Logo'] && Array.isArray(record.fields['Logo']) && record.fields['Logo'].length > 0) {
          logoUrl = await migrateLogoToSupabase(record.fields['Logo'][0], slug);
        }

        // Map Airtable fields to Supabase columns
        const organizationData = {
          slug,
          business_name: businessName,
          logo_url: logoUrl,
          domain: record.fields['Domain'] || null,
          contact_name: record.fields['Contact Name'] || null,
          contact_email: record.fields['Email'] || null,
          contact_phone: record.fields['Phone Number'] || null,
          business_address: record.fields['Business Address'] || null,
          psr_licence_number: record.fields['PSR Licence Number'] || null,
          listings_base_id: record.fields['Listings Base ID'] || null,
          is_active: true,
          settings: {}
        };

        // Insert into Supabase
        const { data: newOrg, error: insertError } = await supabase
          .from('organizations')
          .insert([organizationData])
          .select()
          .single();

        if (insertError) {
          console.error(`Error inserting organization ${slug}:`, insertError);
          results.push({ slug, status: 'error', error: insertError.message });
          errors++;
          continue;
        }

        console.log(`Migrated organization: ${slug} (${newOrg.id})`);

        // Link existing admin users to this organization
        // Find the first admin user (assumes single-tenant setup initially)
        const { data: adminUser } = await supabase
          .rpc('get_first_admin_user_id');

        if (adminUser) {
          const { error: linkError } = await supabase
            .from('user_organizations')
            .insert({
              user_id: adminUser,
              organization_id: newOrg.id,
              role: 'admin'
            });

          if (linkError) {
            console.error(`Failed to link admin user to organization ${slug}:`, linkError);
          } else {
            console.log(`Linked admin user to organization ${slug}`);
          }
        }

        results.push({ 
          slug, 
          status: 'migrated', 
          organizationId: newOrg.id,
          linkedAdmin: !!adminUser
        });
        migrated++;

      } catch (error) {
        console.error(`Error processing record ${record.id}:`, error);
        results.push({ 
          recordId: record.id, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        errors++;
      }
    }

    const report = {
      success: true,
      total_records: airtableData.records.length,
      migrated,
      skipped,
      errors,
      message: `Migration complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`,
      results
    };

    console.log('Migration report:', report);

    return new Response(
      JSON.stringify(report),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in migrate-airtable-clients-to-supabase:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
