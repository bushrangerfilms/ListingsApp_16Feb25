import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BrochureContent, BrochureBranding, ListingBrochure } from '@/lib/brochure/types';
import { useRef, useCallback, useEffect } from 'react';

// ── Fetch brochure for a listing ───────────────────────────────────────

export function useBrochureQuery(listingId: string) {
  return useQuery({
    queryKey: ['brochure', listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listing_brochures' as any)
        .select('*')
        .eq('listing_id', listingId)
        .eq('is_archived', false)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as ListingBrochure | null;
    },
    enabled: !!listingId,
  });
}

// ── Save/update brochure content ───────────────────────────────────────

export function useSaveBrochure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listingId,
      organizationId,
      content,
      branding,
      templateId = 'classic-1',
      status = 'draft',
    }: {
      listingId: string;
      organizationId: string;
      content: BrochureContent;
      branding: BrochureBranding;
      templateId?: string;
      status?: string;
    }) => {
      const { data: existing } = await supabase
        .from('listing_brochures' as any)
        .select('id')
        .eq('listing_id', listingId)
        .eq('is_archived', false)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('listing_brochures' as any)
          .update({
            content,
            branding,
            template_id: templateId,
            status,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', (existing as any).id)
          .select()
          .single();

        if (error) throw error;
        return data as unknown as ListingBrochure;
      } else {
        const { data, error } = await supabase
          .from('listing_brochures' as any)
          .insert({
            listing_id: listingId,
            organization_id: organizationId,
            content,
            branding,
            template_id: templateId,
            status,
          } as any)
          .select()
          .single();

        if (error) throw error;
        return data as unknown as ListingBrochure;
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['brochure', data.listing_id], data);
    },
  });
}

// ── Generate brochure via AI edge function ─────────────────────────────

export function useGenerateBrochure() {
  return useMutation({
    mutationFn: async ({
      listingId,
      organizationId,
      locale,
      regenerateSection,
      existingContent,
    }: {
      listingId: string;
      organizationId: string;
      locale?: string;
      regenerateSection?: string;
      existingContent?: Partial<BrochureContent>;
    }) => {
      const { data, error } = await supabase.functions.invoke('generate-brochure-content', {
        body: {
          listingId,
          organizationId,
          locale,
          regenerateSection,
          existingContent,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Generation failed');

      return data as {
        success: true;
        content: BrochureContent;
        branding: BrochureBranding;
        tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
        regeneratedSection: string | null;
      };
    },
  });
}

// ── Auto-save hook ─────────────────────────────────────────────────────

export function useBrochureAutoSave(
  listingId: string,
  organizationId: string,
  content: BrochureContent | null,
  branding: BrochureBranding | null,
  enabled: boolean = true
) {
  const saveMutation = useSaveBrochure();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

  const save = useCallback(() => {
    if (!content || !branding || !listingId || !organizationId) return;

    const contentHash = JSON.stringify(content);
    if (contentHash === lastSavedRef.current) return;

    lastSavedRef.current = contentHash;
    saveMutation.mutate({
      listingId,
      organizationId,
      content,
      branding,
      status: 'draft',
    });
  }, [content, branding, listingId, organizationId, saveMutation]);

  useEffect(() => {
    if (!enabled || !content) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(save, 3000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [content, enabled, save]);

  return {
    isSaving: saveMutation.isPending,
    lastSaved: saveMutation.data?.updated_at,
    saveNow: save,
  };
}

// ── Upload PDF to storage ──────────────────────────────────────────────

export function useUploadBrochurePdf() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      brochureId,
      listingId,
      organizationId,
      pdfBlob,
    }: {
      brochureId: string;
      listingId: string;
      organizationId: string;
      pdfBlob: Blob;
    }) => {
      const fileName = `${organizationId}/${listingId}/${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('brochure-pdfs')
        .upload(fileName, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('brochure-pdfs')
        .getPublicUrl(fileName);

      const pdfUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('listing_brochures' as any)
        .update({
          pdf_url: pdfUrl,
          pdf_generated_at: new Date().toISOString(),
          status: 'ready',
        } as any)
        .eq('id', brochureId);

      if (updateError) throw updateError;

      return pdfUrl;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['brochure', variables.listingId] });
    },
  });
}
