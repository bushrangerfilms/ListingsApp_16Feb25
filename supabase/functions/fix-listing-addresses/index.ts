import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' }
    })

    console.log('Starting address data cleanup...')

    // Fetch all listings
    const { data: listings, error: fetchError } = await supabase
      .from('listings')
      .select('id, address, address_detail, address_town, county, eircode, title')

    if (fetchError) {
      throw fetchError
    }

    console.log(`Processing ${listings?.length || 0} listings...`)

    const results = {
      updated: 0,
      skipped: 0,
      errors: 0,
      details: [] as any[]
    }

    for (const listing of listings || []) {
      try {
        const updates: any = {}
        let needsUpdate = false

        // 1. Fix eircode - move from address_detail to eircode field
        if (listing.address_detail && !listing.eircode) {
          // Check if address_detail looks like an eircode (alphanumeric, 7-8 chars)
          const potentialEircode = listing.address_detail.trim()
          if (/^[A-Z0-9]{7,8}$/i.test(potentialEircode)) {
            updates.eircode = potentialEircode.toUpperCase()
            needsUpdate = true
            console.log(`Listing ${listing.id}: Moving eircode ${potentialEircode} from address_detail to eircode`)
          }
        }

        // 2. Parse address field to extract components
        if (listing.address) {
          const addressParts = listing.address.split(',').map((part: string) => part.trim()).filter((part: string) => part)
          
          // Try to extract county from address or title
          let county = listing.county
          if (!county && addressParts.length > 0) {
            // Check last part for county
            const lastPart = addressParts[addressParts.length - 1]
            // Common Irish counties
            const counties = ['Wexford', 'Dublin', 'Cork', 'Galway', 'Kerry', 'Mayo', 'Donegal', 
                            'Clare', 'Limerick', 'Tipperary', 'Waterford', 'Kilkenny', 'Carlow',
                            'Kildare', 'Meath', 'Louth', 'Wicklow', 'Offaly', 'Laois', 'Westmeath',
                            'Longford', 'Roscommon', 'Sligo', 'Leitrim', 'Cavan', 'Monaghan']
            
            const foundCounty = counties.find(c => 
              lastPart.toLowerCase().includes(c.toLowerCase()) || 
              listing.title?.toLowerCase().includes(c.toLowerCase())
            )
            
            if (foundCounty) {
              county = foundCounty
            }
          }

          if (county && county !== listing.county) {
            updates.county = county
            needsUpdate = true
            console.log(`Listing ${listing.id}: Setting county to ${county}`)
          }

          // Extract town/city (usually second-to-last or last significant part)
          let town = listing.address_town
          if (!town && addressParts.length > 1) {
            // Find the town (typically after the street address, before county)
            const townCandidates = addressParts.filter((part: string) => 
              part.length > 2 && 
              !/^[A-Z0-9]{7,8}$/i.test(part) && // Not an eircode
              part !== county // Not the county
            )
            
            if (townCandidates.length > 0) {
              // Use the last non-county part as town
              town = townCandidates[townCandidates.length - 1]
            }
          }

          if (town && town !== listing.address_town) {
            updates.address_town = town
            needsUpdate = true
            console.log(`Listing ${listing.id}: Setting town to ${town}`)
          }

          // Extract street address (first part, before town)
          if (addressParts.length > 0 && updates.eircode) {
            // First part is usually the street address
            const streetAddress = addressParts[0]
            if (streetAddress !== listing.address_detail) {
              updates.address_detail = streetAddress
              needsUpdate = true
              console.log(`Listing ${listing.id}: Setting address_detail to ${streetAddress}`)
            }
          }
        }

        if (needsUpdate) {
          const { error: updateError } = await supabase
            .from('listings')
            .update(updates)
            .eq('id', listing.id)

          if (updateError) {
            console.error(`Error updating listing ${listing.id}:`, updateError)
            results.errors++
            results.details.push({
              id: listing.id,
              status: 'error',
              error: updateError.message
            })
          } else {
            results.updated++
            results.details.push({
              id: listing.id,
              status: 'updated',
              updates
            })
          }
        } else {
          results.skipped++
          results.details.push({
            id: listing.id,
            status: 'skipped',
            reason: 'No updates needed'
          })
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Error processing listing ${listing.id}:`, error)
        results.errors++
        results.details.push({
          id: listing.id,
          status: 'error',
          error: errorMessage
        })
      }
    }

    console.log('Address cleanup completed:', results)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Address data cleanup completed',
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in fix-listing-addresses:', error)
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: 'Failed to fix listing addresses'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})