import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebhookPayload {
  event: 'listing.created' | 'listing.updated' | 'listing.deleted'
  listing: {
    id: string
    organization_id: string
    title: string
    description: string | null
    address: string
    address_line_1: string | null
    address_line_2: string | null
    city: string | null
    county: string | null
    eircode: string | null
    category: string
    status: string
    price: number | null
    bedrooms: number | null
    bathrooms: number | null
    ensuite: number | null
    building_size_sqm: number | null
    land_size_acres: number | null
    building_type: string | null
    ber_rating: string | null
    furnished: string | null
    specs: string | null
    hero_photo_url: string | null
    gallery_photo_urls: string[] | null
    slug: string | null
    live_url: string | null
    booking_link: string | null
    sm_posting_status: string | null
    date_posted: string
    status_changed_date: string | null
    new_status_set_date: string | null
    archived: boolean
    airtable_record_id: string | null
    created_at: string
    updated_at: string
  }
  organization: {
    id: string
    name: string
    logo_url: string | null
  }
  timestamp: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    })

    const { listing_id, event_type } = await req.json()

    console.log(`Processing webhook for listing ${listing_id}, event: ${event_type}`)

    // Fetch listing with organization details
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select(`
        *,
        organization:organizations(id, business_name, contact_email, webhook_url, webhook_secret, webhook_enabled, webhook_events)
      `)
      .eq('id', listing_id)
      .single()

    if (listingError || !listing) {
      throw new Error(`Listing not found: ${listingError?.message}`)
    }

    const org = listing.organization as any

    // Check if webhooks are enabled for this organization
    if (!org.webhook_enabled || !org.webhook_url) {
      console.log(`Webhooks not enabled for organization ${org.id}`)
      return new Response(JSON.stringify({ message: 'Webhooks not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Check if this event type is enabled
    if (!org.webhook_events?.includes(event_type)) {
      console.log(`Event ${event_type} not enabled for organization ${org.id}`)
      return new Response(JSON.stringify({ message: 'Event not enabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Prepare webhook payload
    const payload: WebhookPayload = {
      event: event_type,
      listing: {
        id: listing.id,
        organization_id: org.id,
        title: listing.title,
        description: listing.description,
        address: listing.address,
        address_line_1: listing.address_detail,
        address_line_2: null,
        city: listing.address_town,
        county: listing.county,
        eircode: listing.eircode,
        category: listing.category,
        status: listing.status,
        price: listing.price,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        ensuite: listing.ensuite,
        building_size_sqm: listing.floor_area_size,
        land_size_acres: listing.land_size,
        building_type: listing.building_type,
        ber_rating: listing.ber_rating,
        furnished: listing.furnished,
        specs: listing.specs,
        hero_photo_url: listing.hero_photo,
        gallery_photo_urls: listing.photos || [], // Send ALL photos, not just social_media subset
        slug: listing.slug,
        live_url: listing.live_url,
        booking_link: listing.booking_link,
        sm_posting_status: listing.sm_posting_status,
        date_posted: listing.date_posted,
        status_changed_date: listing.status_changed_date,
        new_status_set_date: listing.new_status_set_date,
        archived: listing.archived,
        airtable_record_id: listing.airtable_record_id,
        created_at: listing.created_at,
        updated_at: listing.updated_at,
      },
      organization: {
        id: org.id,
        name: org.business_name,
        logo_url: org.logo_url,
      },
      timestamp: new Date().toISOString(),
    }

    // Send webhook with retry logic
    let attempts = 0
    let lastError = null
    const maxAttempts = 3

    while (attempts < maxAttempts) {
      attempts++
      
      try {
        console.log(`Sending webhook to ${org.webhook_url} (attempt ${attempts})`)
        
        const webhookResponse = await fetch(org.webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-signature': await generateSignature(payload, org.webhook_secret),
          },
          body: JSON.stringify(payload),
        })

        const responseBody = await webhookResponse.text()

        // Log webhook attempt
        await supabase.from('webhook_logs').insert({
          organization_id: org.id,
          listing_id: listing.id,
          event_type,
          payload,
          response_status: webhookResponse.status,
          response_body: responseBody.substring(0, 1000),
          error_message: webhookResponse.ok ? null : `HTTP ${webhookResponse.status}`,
          attempt_number: attempts,
          delivered_at: webhookResponse.ok ? new Date().toISOString() : null,
        })

        if (webhookResponse.ok) {
          console.log(`Webhook sent successfully (${webhookResponse.status})`)
          return new Response(
            JSON.stringify({ 
              success: true, 
              status: webhookResponse.status,
              attempts 
            }), 
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          )
        }

        lastError = `HTTP ${webhookResponse.status}: ${responseBody}`
        console.error(`Webhook failed (attempt ${attempts}): ${lastError}`)
        
        // Wait before retry (exponential backoff)
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000))
        }
      } catch (fetchError: any) {
        lastError = fetchError.message
        console.error(`Webhook request failed (attempt ${attempts}):`, fetchError)
        
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000))
        }
      }
    }

    // All attempts failed
    await supabase.from('webhook_logs').insert({
      organization_id: org.id,
      listing_id: listing.id,
      event_type,
      payload,
      response_status: null,
      error_message: `Failed after ${maxAttempts} attempts: ${lastError}`,
      attempt_number: maxAttempts,
      delivered_at: null,
    })

    throw new Error(`Webhook delivery failed after ${maxAttempts} attempts: ${lastError}`)

  } catch (error: any) {
    console.error('Error in send-listing-webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

// Generate HMAC signature for webhook security
async function generateSignature(payload: any, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(JSON.stringify(payload))
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, data)
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
