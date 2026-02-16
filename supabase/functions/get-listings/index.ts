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
    // Support both GET (with URL params) and POST (with JSON body)
    let clientSlug, filter, archived, isPublic, recordId;
    
    if (req.method === 'GET') {
      // Extract parameters from URL query string
      const url = new URL(req.url);
      clientSlug = url.searchParams.get('clientSlug');
      filter = url.searchParams.get('filter');
      archived = url.searchParams.get('archived') === 'true';
      isPublic = url.searchParams.get('isPublic') === 'true';
      recordId = url.searchParams.get('recordId');
    } else {
      // POST request - parse JSON body
      try {
        const body = await req.json();
        clientSlug = body.clientSlug;
        filter = body.filter;
        archived = body.archived;
        isPublic = body.isPublic;
        recordId = body.recordId;
      } catch (jsonError) {
        console.error('Failed to parse JSON body:', jsonError);
        return new Response(
          JSON.stringify({ error: 'Invalid JSON in request body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    console.log('Fetching listings from Supabase for client:', clientSlug, 'with filter:', filter, 'recordId:', recordId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    });

    // Get organization ID and property_services from clientSlug (organizations in public schema)
    const { data: orgData, error: orgError } = await supabase
      .schema('public')
      .from('organizations')
      .select('id, property_services')
      .eq('slug', clientSlug)
      .eq('is_active', true)
      .single();

    if (orgError || !orgData) {
      console.error('Organization not found for slug:', clientSlug, orgError);
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = orgData.id;
    // Property services: NULL or empty means no filtering (show all - backwards compatible)
    const propertyServices: string[] | null = orgData.property_services;
    console.log('Organization property_services:', propertyServices);
    console.log('Using organization ID:', organizationId);
    
    // DEBUG: Check what's in listings
    const { data: debugListings, error: debugError } = await supabase
      .from('listings')
      .select('client_id, title')
      .limit(5);
    console.log('DEBUG: Sample listings records:', debugListings);
    console.log('DEBUG: Looking for client_id matching:', organizationId);

    // Helper function to extract URL from photo (either string URL or Airtable JSON string)
    const extractPhotoUrl = (photo: any): string | null => {
      if (!photo) return null;
      if (typeof photo === 'string') {
        try {
          // Try to parse as JSON (Airtable format)
          const parsed = JSON.parse(photo);
          return parsed.url || null;
        } catch {
          // If parsing fails, it's already a plain URL string
          return photo;
        }
      }
      // If it's already an object, extract URL directly
      return photo.url || null;
    };

    // If recordId is provided, fetch a single record
    if (recordId) {
      console.log('Fetching single record from Supabase:', recordId);
      
      // Check if recordId is a valid UUID format
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId);
      
      let query = supabase
        .from('listings')
        .select('*')
        .eq('organization_id', organizationId);
      
      // If it's a UUID, check the id field; otherwise check airtable_record_id
      if (isUUID) {
        query = query.eq('id', recordId);
      } else {
        query = query.eq('airtable_record_id', recordId);
      }
      
      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('Supabase error:', error);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to fetch listing from database',
            details: error.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!data) {
        return new Response(
          JSON.stringify({ error: 'Listing not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Fetched single listing from Supabase');

      // Transform Supabase record to match frontend format
      const listing = {
        id: data.airtable_record_id || data.id,
        title: data.title,
        status: data.status || 'Published',
        category: data.category || 'Listing', // Include category (backwards compatible)
        price: data.price,
        priceOnApplication: !data.price,
        addressLine1: data.address_detail || data.address || '',
        addressLine2: '',
        addressTown: data.address_town || '',
        county: data.county || '',
        eircode: data.eircode || '',
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        buildingType: data.building_type,
        buildingSize: data.floor_area_size,
        landSize: data.land_size,
        berRating: data.ber_rating,
        description: data.description,
        specs: data.specs,
        heroPhoto: data.hero_photo,
        photos: (() => {
          try {
            const galleryPhotos = data.photos ? (typeof data.photos === 'string' ? JSON.parse(data.photos) : data.photos) : [];
            return galleryPhotos.filter((photo: any) => photo && typeof photo === 'string');
          } catch (error) {
            console.error('Error parsing photos:', error);
            return [];
          }
        })(),
        socialMediaPhotos: (() => {
          try {
            const socialPhotos = data.social_media_photos ? (typeof data.social_media_photos === 'string' ? JSON.parse(data.social_media_photos) : data.social_media_photos) : [];
            return socialPhotos.filter((photo: any) => photo && typeof photo === 'string');
          } catch (error) {
            console.error('Error parsing social_media_photos:', error);
            return [];
          }
        })(),
        datePosted: data.date_posted,
        statusChangedDate: data.status_changed_date || data.status_changed_at,
        newStatusSetDate: data.new_status_set_date,
      };

      return new Response(
        JSON.stringify({
          success: true,
          listings: [listing],
          count: 1,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query for list view
    let query = supabase
      .from('listings')
      .select('*')
      .eq('organization_id', organizationId); // CRITICAL: Filter by organization
    
    // For public view, show Published, New, Sale Agreed, and Sold listings (not archived)
    if (isPublic) {
      query = query
        .eq('archived', false)
        .in('status', ['Published', 'New', 'Sale Agreed', 'Sold']);
    } else {
      // Admin view: apply status and archived filters
      if (filter && filter !== 'All') {
        query = query.eq('status', filter);
      }
      if (archived === true) {
        query = query.eq('archived', true);
      } else if (archived === false) {
        query = query.eq('archived', false);
      }
    }
    
    // Sort by date posted, newest first
    query = query.order('date_posted', { ascending: false }).order('id', { ascending: false });

    console.log('Fetching listings from Supabase');
    
    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch listings from database',
          details: error.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetched ${data.length} listings from Supabase`);

    // Helper: Map category to service type
    const categoryToService = (category: string | null): string => {
      switch (category) {
        case 'Rental': return 'rentals';
        case 'Holiday Rental': return 'holiday_rentals';
        case 'Listing':
        default: return 'sales'; // NULL defaults to 'sales'
      }
    };

    // Transform Supabase records to match frontend format
    const allListings = data.map((record: any) => {
      // Category defaults to 'Listing' if NULL (backwards compatibility)
      const category = record.category || 'Listing';
      
      const base = {
        id: record.airtable_record_id || record.id,
        title: record.title,
        status: record.status || 'Published',
        category, // Include category in response
        price: record.price,
        priceOnApplication: !record.price,
        addressLine1: record.address_detail || record.address || '',
        addressLine2: '',
        addressTown: record.address_town || '',
        county: record.county || '',
        eircode: record.eircode || '',
        bedrooms: record.bedrooms,
        bathrooms: record.bathrooms,
        buildingType: record.building_type,
        buildingSize: record.floor_area_size,
        landSize: record.land_size,
        berRating: record.ber_rating,
        description: record.description,
        specs: record.specs,
        heroPhoto: record.hero_photo,
        photos: (() => {
          try {
            const galleryPhotos = record.photos ? (typeof record.photos === 'string' ? JSON.parse(record.photos) : record.photos) : [];
            return galleryPhotos.filter((photo: any) => photo && typeof photo === 'string');
          } catch (error) {
            console.error('Error parsing photos:', error);
            return [];
          }
        })(),
        socialMediaPhotos: (() => {
          try {
            const socialPhotos = record.social_media_photos ? (typeof record.social_media_photos === 'string' ? JSON.parse(record.social_media_photos) : record.social_media_photos) : [];
            return socialPhotos.filter((photo: any) => photo && typeof photo === 'string');
          } catch (error) {
            console.error('Error parsing social_media_photos:', error);
            return [];
          }
        })(),
        datePosted: record.date_posted,
        statusChangedDate: record.status_changed_date || record.status_changed_at,
        newStatusSetDate: record.new_status_set_date,
      };
      
      if (!isPublic) {
        return {
          ...base,
          archived: record.archived || false,
        };
      }
      
      return base;
    });

    // For public view, filter by organization's property_services
    // NULL or empty property_services = no filtering (backwards compatible - show all)
    let listings = allListings;
    if (isPublic && propertyServices && propertyServices.length > 0) {
      listings = allListings.filter((listing: any) => {
        const service = categoryToService(listing.category);
        return propertyServices.includes(service);
      });
      console.log(`Filtered ${allListings.length} listings to ${listings.length} based on property_services:`, propertyServices);
    } else if (isPublic) {
      console.log(`No property_services filtering - showing all ${allListings.length} listings (backwards compatible)`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        listings,
        count: listings.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-listings:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

