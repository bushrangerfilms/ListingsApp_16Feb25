import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      db: { schema: 'public' }
    }
  )

  try {
    const { listingId: requestListingId } = await req.json()

    console.log(`Migrating photos for listing: ${requestListingId}`)

    // Fetch the listing
    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select('id, photos, hero_photo, social_media_photos')
      .eq('id', requestListingId)
      .single()

    if (fetchError || !listing) throw new Error('Listing not found')

    const listingId = listing.id
    let migratedHeroPhoto: string | null = null
    const migratedPhotos: string[] = []
    const migratedSocialMediaPhotos: string[] = []

    // Helper function to migrate a single photo
    async function migratePhoto(photoUrl: string): Promise<string | null> {
      // Skip if already a Supabase Storage URL
      if (photoUrl.includes('supabase.co/storage')) {
        return photoUrl
      }

      try {
        console.log(`Downloading photo: ${photoUrl}`)
        
        // Download photo from external URL
        const photoResponse = await fetch(photoUrl)
        if (!photoResponse.ok) {
          console.error(`Failed to fetch photo: ${photoUrl}`)
          return null
        }

        const photoBlob = await photoResponse.blob()
        const fileExtension = photoUrl.split('.').pop()?.split('?')[0] || 'jpg'
        const fileName = `${listingId}/${crypto.randomUUID()}.${fileExtension}`

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('listing-photos')
          .upload(fileName, photoBlob, {
            contentType: photoResponse.headers.get('content-type') || 'image/jpeg',
            upsert: false
          })

        if (uploadError) {
          console.error(`Upload error for ${photoUrl}:`, uploadError)
          return null
        }

        // Get public URL
        const { data: { publicUrl } } = supabase
          .storage
          .from('listing-photos')
          .getPublicUrl(fileName)

        console.log(`Migrated: ${photoUrl} -> ${publicUrl}`)
        return publicUrl
      } catch (error) {
        console.error(`Error migrating photo ${photoUrl}:`, error)
        return null
      }
    }

    // Migrate hero photo
    if (listing.hero_photo) {
      const migratedUrl = await migratePhoto(listing.hero_photo)
      if (migratedUrl) {
        migratedHeroPhoto = migratedUrl
      }
    }

    // Migrate gallery photos
    if (listing.photos && Array.isArray(listing.photos)) {
      for (const photoUrl of listing.photos) {
        const migratedUrl = await migratePhoto(photoUrl)
        if (migratedUrl) {
          migratedPhotos.push(migratedUrl)
        }
      }
    }

    // Migrate social media photos
    if (listing.social_media_photos && Array.isArray(listing.social_media_photos)) {
      for (const photoUrl of listing.social_media_photos) {
        const migratedUrl = await migratePhoto(photoUrl)
        if (migratedUrl) {
          migratedSocialMediaPhotos.push(migratedUrl)
        }
      }
    }

    // Update listing with new URLs
    const updateData: any = {}
    if (migratedHeroPhoto) {
      updateData.hero_photo = migratedHeroPhoto
    }
    if (migratedPhotos.length > 0) {
      updateData.photos = migratedPhotos
    }
    if (migratedSocialMediaPhotos.length > 0) {
      updateData.social_media_photos = migratedSocialMediaPhotos
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('listings')
        .update(updateData)
        .eq('id', listingId)

      if (updateError) throw updateError
    }

    const totalMigrated = 
      (migratedHeroPhoto ? 1 : 0) + 
      migratedPhotos.length + 
      migratedSocialMediaPhotos.length

    return new Response(
      JSON.stringify({ 
        success: true, 
        migratedCount: totalMigrated,
        hero_photo: migratedHeroPhoto,
        photos: migratedPhotos,
        social_media_photos: migratedSocialMediaPhotos
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('Photo migration error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
