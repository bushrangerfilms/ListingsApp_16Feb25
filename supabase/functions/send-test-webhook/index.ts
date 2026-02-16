import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { organizationId } = await req.json()

    console.log(`Sending test webhook for organization ${organizationId}`)

    // Fetch organization details
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, business_name, logo_url, webhook_url, webhook_secret, webhook_enabled')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      throw new Error(`Organization not found: ${orgError?.message}`)
    }

    if (!org.webhook_enabled || !org.webhook_url || !org.webhook_secret) {
      throw new Error('Webhook not configured. Please set URL and secret first.')
    }

    // Create test payload
    const testPayload = {
      event: 'listing.created',
      listing: {
        id: '00000000-0000-0000-0000-000000000000',
        organization_id: org.id,
        title: 'Test Property - Ignore',
        description: 'This is a test webhook. Please ignore this listing.',
        address_line_1: '123 Test Street',
        address_line_2: null,
        city: 'Test City',
        county: 'Test County',
        eircode: 'T12 TEST',
        category: 'For Sale',
        status: 'Published',
        price: 250000,
        bedrooms: 3,
        bathrooms: 2,
        building_size_sqm: 120,
        land_size_acres: 0.25,
        building_type: 'Detached',
        ber_rating: 'B2',
        hero_photo_url: 'https://via.placeholder.com/800x600?text=Test+Hero+Photo',
        gallery_photo_urls: [
          'https://via.placeholder.com/800x600?text=Test+Photo+1',
          'https://via.placeholder.com/800x600?text=Test+Photo+2',
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      organization: {
        id: org.id,
        name: org.business_name,
        logo_url: org.logo_url,
      },
      timestamp: new Date().toISOString(),
    }

    // Generate signature
    const signature = await generateSignature(testPayload, org.webhook_secret)

    console.log(`Sending test webhook to ${org.webhook_url}`)

    // Send webhook
    const webhookResponse = await fetch(org.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': signature,
      },
      body: JSON.stringify(testPayload),
    })

    const responseBody = await webhookResponse.text()

    // Log the test webhook
    await supabase.from('webhook_logs').insert({
      organization_id: org.id,
      listing_id: null,
      event_type: 'listing.created',
      payload: testPayload,
      response_status: webhookResponse.status,
      response_body: responseBody.substring(0, 1000),
      error_message: webhookResponse.ok ? null : `Test webhook failed: HTTP ${webhookResponse.status}`,
      attempt_number: 1,
      delivered_at: webhookResponse.ok ? new Date().toISOString() : null,
    })

    if (webhookResponse.ok) {
      console.log(`Test webhook sent successfully (${webhookResponse.status})`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: webhookResponse.status,
          message: 'Test webhook sent successfully',
        }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    throw new Error(`Webhook failed with status ${webhookResponse.status}: ${responseBody}`)

  } catch (error: any) {
    console.error('Error in send-test-webhook:', error)
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
