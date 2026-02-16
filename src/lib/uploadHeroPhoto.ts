import { supabase } from "@/integrations/supabase/client";

interface UploadHeroPhotoResult {
  success: boolean;
  listingId?: string;
  listingTitle?: string;
  heroPhotoUrl?: string;
  message: string;
  error?: string;
}

export async function uploadHeroPhoto(
  listingTitle: string,
  imageData: string
): Promise<UploadHeroPhotoResult> {
  try {
    const { data, error } = await supabase.functions.invoke('upload-hero-photo', {
      body: {
        listingTitle,
        imageData,
      },
    });

    if (error) {
      console.error('Error uploading hero photo:', error);
      return {
        success: false,
        message: 'Failed to upload hero photo',
        error: error.message,
      };
    }

    return data as UploadHeroPhotoResult;
  } catch (error) {
    console.error('Exception uploading hero photo:', error);
    return {
      success: false,
      message: 'Exception occurred during upload',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
