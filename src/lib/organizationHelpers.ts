import { supabase } from "@/integrations/supabase/client";

import type { PropertyService } from "@/lib/billing/types";

interface OrganizationUpdate {
  business_name?: string;
  logo_url?: string | null;
  favicon_url?: string | null;
  domain?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  business_address?: string;
  psr_licence_number?: string;
  from_email?: string | null;
  from_name?: string | null;
  notification_emails?: string[];
  primary_color?: string | null;
  secondary_color?: string | null;
  property_services?: PropertyService[];
  hide_public_site?: boolean;
}

export async function uploadOrganizationLogo(file: File, orgId: string): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${orgId}-${Date.now()}.${fileExt}`;
  const filePath = `organization-logos/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('real-estate-videos')
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('real-estate-videos')
    .getPublicUrl(filePath);

  return publicUrl;
}

export async function deleteOrganizationLogo(logoUrl: string): Promise<void> {
  const urlParts = logoUrl.split('/organization-logos/');
  if (urlParts.length < 2) return;
  
  const fileName = urlParts[1];
  const filePath = `organization-logos/${fileName}`;

  const { error } = await supabase.storage
    .from('real-estate-videos')
    .remove([filePath]);

  if (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }
}

export async function uploadOrganizationFavicon(file: File, orgId: string): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${orgId}-favicon-${Date.now()}.${fileExt}`;
  const filePath = `client-logos/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('real-estate-videos')
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('real-estate-videos')
    .getPublicUrl(filePath);

  return publicUrl;
}

export async function deleteOrganizationFavicon(faviconUrl: string): Promise<void> {
  const urlParts = faviconUrl.split('/client-logos/');
  if (urlParts.length < 2) return;
  
  const fileName = urlParts[1];
  const filePath = `client-logos/${fileName}`;

  const { error } = await supabase.storage
    .from('real-estate-videos')
    .remove([filePath]);

  if (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }
}

export async function updateOrganizationProfile(
  orgId: string,
  updates: OrganizationUpdate
): Promise<void> {
  console.log('[updateOrganizationProfile] Updating org:', orgId, 'with:', updates);
  
  const { data, error, count } = await supabase
    .from('organizations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', orgId)
    .select()
    .single();

  console.log('[updateOrganizationProfile] Result:', { data, error, count });

  if (error) {
    console.error('[updateOrganizationProfile] Error:', error);
    throw new Error(`Update failed: ${error.message}`);
  }
  
  if (!data) {
    console.error('[updateOrganizationProfile] No rows updated - RLS may be blocking');
    throw new Error('Update failed: No rows were updated. You may not have permission to modify this organization.');
  }
}
