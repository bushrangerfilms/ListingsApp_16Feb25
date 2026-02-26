import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/hooks/use-toast';
import { pdf } from '@react-pdf/renderer';
import {
  ArrowLeft,
  Download,
  Printer,
  RefreshCw,
  Save,
  Loader2,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

import type { BrochureContent, BrochureBranding } from '@/lib/brochure/types';
import { DEFAULT_BROCHURE_CONTENT } from '@/lib/brochure/types';
import {
  useBrochureQuery,
  useGenerateBrochure,
  useBrochureAutoSave,
  useSaveBrochure,
  useUploadBrochurePdf,
} from '@/hooks/useBrochure';
import { BrochureGenerateSplash } from '@/components/brochure/BrochureGenerateSplash';
import { BrochureEditPanel } from '@/components/brochure/BrochureEditPanel';
import { BrochureLivePreview } from '@/components/brochure/BrochureLivePreview';
import { getTemplate } from '@/components/brochure/templates/templateRegistry';

export default function BrochureEditor() {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const { toast } = useToast();

  const [content, setContent] = useState<BrochureContent | null>(null);
  const [branding, setBranding] = useState<BrochureBranding | null>(null);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch listing data
  const { data: listing, isLoading: listingLoading } = useQuery({
    queryKey: ['listing', listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', listingId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!listingId,
  });

  // Fetch existing brochure
  const { data: existingBrochure, isLoading: brochureLoading } = useBrochureQuery(listingId!);

  // Load existing brochure content
  useEffect(() => {
    if (existingBrochure?.content && !content) {
      setContent(existingBrochure.content as unknown as BrochureContent);
      setBranding(existingBrochure.branding as unknown as BrochureBranding);
    }
  }, [existingBrochure, content]);

  // AI generation
  const generateMutation = useGenerateBrochure();
  const saveMutation = useSaveBrochure();
  const uploadPdfMutation = useUploadBrochurePdf();

  // Auto-save
  const { isSaving, lastSaved } = useBrochureAutoSave(
    listingId!,
    organization?.id || '',
    content,
    branding,
    !!content && !!organization
  );

  // Get listing photos
  const photos: string[] = listing
    ? [
        ...(listing.hero_photo ? [listing.hero_photo as string] : []),
        ...((listing.photos as string[]) || []),
      ].filter((v, i, a) => a.indexOf(v) === i)
    : [];

  // Generate full brochure
  const handleGenerate = useCallback(async () => {
    if (!listingId || !organization?.id) return;

    try {
      const result = await generateMutation.mutateAsync({
        listingId,
        organizationId: organization.id,
        locale: (organization as any).locale || 'en-IE',
      });

      setContent(result.content);
      setBranding(result.branding);

      // Save to DB
      await saveMutation.mutateAsync({
        listingId,
        organizationId: organization.id,
        content: result.content,
        branding: result.branding,
        status: 'draft',
      });

      toast({ title: 'Brochure generated', description: 'You can now edit and download your brochure.' });
    } catch (err) {
      toast({
        title: 'Generation failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }, [listingId, organization, generateMutation, saveMutation, toast]);

  // Regenerate a single section
  const handleRegenerateSection = useCallback(async (section: string) => {
    if (!listingId || !organization?.id || !content) return;

    setRegeneratingSection(section);
    try {
      const result = await generateMutation.mutateAsync({
        listingId,
        organizationId: organization.id,
        locale: (organization as any).locale || 'en-IE',
        regenerateSection: section,
        existingContent: content,
      });

      // Merge regenerated section into existing content
      const sectionData = result.content as any;
      if (sectionData[section]) {
        setContent((prev) => prev ? { ...prev, [section]: sectionData[section] } : prev);
      }

      toast({ title: `${section} regenerated` });
    } catch (err) {
      toast({
        title: 'Regeneration failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRegeneratingSection(null);
    }
  }, [listingId, organization, content, generateMutation, toast]);

  // Download PDF
  const handleDownload = useCallback(async () => {
    if (!content || !branding) return;

    setIsDownloading(true);
    try {
      const template = getTemplate('classic-1');
      const TemplateComponent = template.component;

      const blob = await pdf(
        <TemplateComponent content={content} branding={branding} />
      ).toBlob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${content.cover.address || 'Property'} - Brochure.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Upload to storage if we have a brochure record
      if (existingBrochure?.id) {
        await uploadPdfMutation.mutateAsync({
          brochureId: existingBrochure.id,
          listingId: listingId!,
          organizationId: organization!.id,
          pdfBlob: blob,
        });
      }

      toast({ title: 'PDF downloaded' });
    } catch (err) {
      toast({
        title: 'Download failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [content, branding, existingBrochure, listingId, organization, uploadPdfMutation, toast]);

  // Print
  const handlePrint = useCallback(() => {
    const iframe = document.querySelector('.brochure-preview-area iframe') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.print();
    }
  }, []);

  // Manual save
  const handleSave = useCallback(async () => {
    if (!content || !branding || !listingId || !organization?.id) return;
    try {
      await saveMutation.mutateAsync({
        listingId,
        organizationId: organization.id,
        content,
        branding,
        status: 'draft',
      });
      toast({ title: 'Brochure saved' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  }, [content, branding, listingId, organization, saveMutation, toast]);

  // Loading state
  if (listingLoading || brochureLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">Listing not found.</p>
        <Button variant="outline" onClick={() => navigate('/admin/listings')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Listings
        </Button>
      </div>
    );
  }

  // Show generation splash if no brochure exists
  if (!content) {
    return (
      <div>
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/listings')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-lg font-semibold truncate">{listing.title as string}</h1>
        </div>
        <BrochureGenerateSplash
          listingTitle={listing.title as string}
          listingAddress={`${listing.address || ''}, ${listing.address_town || ''}, ${listing.county || ''}`}
          heroPhoto={(listing.hero_photo as string) || ((listing.photos as string[]) || [])[0]}
          isGenerating={generateMutation.isPending}
          onGenerate={handleGenerate}
        />
      </div>
    );
  }

  // Main editor view
  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/listings')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-sm font-semibold truncate flex-1">{listing.title as string}</h1>

        <div className="flex items-center gap-1.5">
          {/* Save status indicator */}
          <span className="text-xs text-muted-foreground mr-2">
            {isSaving ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving...
              </span>
            ) : lastSaved ? (
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-green-500" /> Saved
              </span>
            ) : null}
          </span>

          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generateMutation.isPending}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
            Regenerate All
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
            <Save className="h-3.5 w-3.5 mr-1" />
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5 mr-1" />
            Print
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5 mr-1" />
            )}
            Download PDF
          </Button>
        </div>
      </div>

      {/* Split pane: Edit panel + Preview */}
      <div className="flex flex-1 overflow-hidden">
        {/* Edit panel (left) */}
        <div className="w-[45%] min-w-[360px] border-r overflow-y-auto p-3">
          <BrochureEditPanel
            content={content}
            onChange={setContent}
            photos={photos}
            onRegenerateSection={handleRegenerateSection}
            regeneratingSection={regeneratingSection}
          />
        </div>

        {/* Live preview (right) */}
        <div className="flex-1 p-3 brochure-preview-area">
          {branding && (
            <BrochureLivePreview
              content={content}
              branding={branding}
              templateId="classic-1"
            />
          )}
        </div>
      </div>
    </div>
  );
}
