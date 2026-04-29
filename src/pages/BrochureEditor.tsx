import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/hooks/use-toast';
import { usePlanInfo } from '@/hooks/usePlanInfo';
import { UpgradePlanDialog } from '@/components/billing/UpgradePlanDialog';
import { pdf } from '@react-pdf/renderer';
import {
  ArrowLeft,
  Download,
  Printer,
  RefreshCw,
  Save,
  Loader2,
  Check,
  ChevronDown,
  BookOpen,
  FileStack,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { BrochureContent, BrochureBranding } from '@/lib/brochure/types';
import { DEFAULT_BROCHURE_CONTENT } from '@/lib/brochure/types';
import { DEFAULT_LOCALE } from '@/lib/locale/config';
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
import { updateOrganizationProfile } from '@/lib/organizationHelpers';

export default function BrochureEditor() {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const { toast } = useToast();
  const { planInfo, isLoading: planLoading } = usePlanInfo();

  // Plan gate: brochure generator is paid-only. Comped orgs (account_status === 'active')
  // and trial orgs pass through; free tier sees the upgrade dialog and is sent back.
  const isPaidPlan = planInfo?.accountStatus === 'active' || planInfo?.accountStatus === 'trial';
  const [showUpgrade, setShowUpgrade] = useState(false);
  useEffect(() => {
    if (!planLoading && planInfo && !isPaidPlan) {
      setShowUpgrade(true);
    }
  }, [planLoading, planInfo, isPaidPlan]);

  if (!planLoading && planInfo && !isPaidPlan) {
    return (
      <>
        <div className="p-8 text-center">
          <h1 className="text-2xl font-semibold mb-2">Brochure Generator</h1>
          <p className="text-muted-foreground mb-4">Available on paid plans.</p>
          <Button onClick={() => navigate('/admin/listings')} variant="outline">
            Back to Listings
          </Button>
        </div>
        <UpgradePlanDialog
          open={showUpgrade}
          onOpenChange={(open) => {
            setShowUpgrade(open);
            if (!open) navigate('/admin/listings');
          }}
          feature="brochure"
          planName={planInfo.planName ?? 'free'}
        />
      </>
    );
  }

  const [content, setContent] = useState<BrochureContent | null>(null);
  const [branding, setBranding] = useState<BrochureBranding | null>(null);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSavingDefaults, setIsSavingDefaults] = useState(false);
  const [isSavingCertDefaults, setIsSavingCertDefaults] = useState(false);
  const [isSavingStyleDefaults, setIsSavingStyleDefaults] = useState(false);

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

  // Fetch upscaled photo URLs (matches edge function logic so photo selections align)
  const { data: upscaleJobs } = useQuery({
    queryKey: ['photo-upscale-jobs', listingId],
    queryFn: async () => {
      const { data } = await supabase
        .from('photo_upscale_jobs' as any)
        .select('photo_index, photo_type, upscaled_url')
        .eq('listing_id', listingId!)
        .eq('status', 'completed')
        .not('upscaled_url', 'is', null);
      return (data as any[]) || [];
    },
    enabled: !!listingId,
  });

  // Build photo array with upscaled versions where available
  // This must match the logic in generate-brochure-content edge function
  // so that AI-assigned photoUrls match the thumbnails shown in the editor
  const photos: string[] = listing
    ? (() => {
        const originalPhotos = (listing.photos as string[]) || [];
        const mappedPhotos = originalPhotos.map((url: string, index: number) => {
          const upscaled = upscaleJobs?.find(
            (j: any) => j.photo_index === index && j.photo_type === 'gallery'
          );
          return upscaled?.upscaled_url || url;
        });
        const heroUpscale = upscaleJobs?.find((j: any) => j.photo_type === 'hero');
        const hero = heroUpscale?.upscaled_url || (listing.hero_photo as string);
        return [
          ...(hero ? [hero] : []),
          ...mappedPhotos,
        ].filter((v, i, a) => a.indexOf(v) === i);
      })()
    : [];

  // Generate full brochure
  const handleGenerate = useCallback(async () => {
    if (!listingId || !organization?.id) return;

    try {
      const result = await generateMutation.mutateAsync({
        listingId,
        organizationId: organization.id,
        locale: (organization as any).locale || DEFAULT_LOCALE,
      });

      setContent(result.content);
      setBranding(result.branding);

      // Save to DB (separate try/catch so a save failure doesn't mask successful generation)
      try {
        await saveMutation.mutateAsync({
          listingId,
          organizationId: organization.id,
          content: result.content,
          branding: result.branding,
          status: 'draft',
        });
      } catch (saveErr) {
        console.error('Brochure save failed after generation:', saveErr);
      }

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
        locale: (organization as any).locale || DEFAULT_LOCALE,
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

  // Download PDF — format-aware (standard, reader, or print-ready)
  const handleDownload = useCallback(async (format?: 'reader' | 'print-ready') => {
    if (!content || !branding) return;

    setIsDownloading(true);
    try {
      const template = getTemplate(branding.styleOptions?.templateId || 'classic-1');
      const pageFormat = branding.styleOptions?.pageFormat || 'a5';

      let TemplateComponent;
      let filenameSuffix = 'Brochure';
      if (pageFormat === 'a5' && format === 'print-ready') {
        TemplateComponent = template.a5PrintReadyComponent || template.component;
        filenameSuffix = 'Booklet (Print)';
      } else if (pageFormat === 'a5') {
        TemplateComponent = template.a5ReaderComponent || template.component;
        filenameSuffix = 'Booklet (Reader)';
      } else {
        TemplateComponent = template.component;
      }

      const blob = await pdf(
        <TemplateComponent content={content} branding={branding} />
      ).toBlob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${content.cover.address || 'Property'} - ${filenameSuffix}.pdf`;
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

      toast({
        title: 'PDF downloaded',
        description: format === 'print-ready'
          ? 'Print on A4, double-sided (flip on short edge), then fold in half.'
          : undefined,
      });
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
    } catch (err) {
      console.error('Brochure manual save failed:', err);
      toast({ title: 'Save failed', description: err instanceof Error ? err.message : 'Check console for details.', variant: 'destructive' });
    }
  }, [content, branding, listingId, organization, saveMutation, toast]);

  // Save header branding as org defaults
  const handleSaveDefaults = useCallback(async () => {
    if (!branding || !organization?.id) return;
    setIsSavingDefaults(true);
    try {
      await updateOrganizationProfile(organization.id, {
        business_name: branding.businessName,
        logo_url: branding.logoUrl,
        contact_email: branding.contactEmail,
        contact_phone: branding.contactPhone,
        business_address: branding.businessAddress,
        psr_licence_number: branding.psrLicenceNumber || undefined,
        primary_color: branding.primaryColor,
        secondary_color: branding.secondaryColor,
      });
      toast({ title: 'Org defaults saved', description: 'Future brochures will use these details.' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setIsSavingDefaults(false);
    }
  }, [branding, organization, toast]);

  // Save certification logos as org defaults
  const handleSaveCertDefaults = useCallback(async () => {
    if (!branding || !organization?.id) return;
    setIsSavingCertDefaults(true);
    try {
      const certLogos = branding.styleOptions?.certificationLogos || [];
      await updateOrganizationProfile(organization.id, {
        default_brochure_certifications: certLogos,
      });
      toast({ title: 'Certification defaults saved', description: 'Future brochures will use these certifications.' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setIsSavingCertDefaults(false);
    }
  }, [branding, organization, toast]);

  // Save style options + colors as org defaults
  const handleSaveStyleDefaults = useCallback(async () => {
    if (!branding || !organization?.id) return;
    setIsSavingStyleDefaults(true);
    try {
      const opts = branding.styleOptions || {};
      await updateOrganizationProfile(organization.id, {
        primary_color: branding.primaryColor,
        secondary_color: branding.secondaryColor,
        default_brochure_style_options: {
          templateId: opts.templateId,
          frameStyle: opts.frameStyle,
          imageCornerRadius: opts.imageCornerRadius,
          imageBorder: opts.imageBorder,
          showInnerPrice: opts.showInnerPrice,
          showBackCoverPrice: opts.showBackCoverPrice,
          pageFormat: opts.pageFormat,
        },
      });
      toast({ title: 'Style defaults saved', description: 'Future brochures will use these style preferences.' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setIsSavingStyleDefaults(false);
    }
  }, [branding, organization, toast]);

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
          {branding?.styleOptions?.pageFormat === 'a5' ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" disabled={isDownloading}>
                  {isDownloading ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1" />
                  )}
                  Download PDF
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onClick={() => handleDownload('print-ready')}>
                  <FileStack className="h-3.5 w-3.5 mr-2 shrink-0" />
                  <div>
                    <div className="text-xs font-medium">Print-Ready PDF</div>
                    <div className="text-[10px] text-muted-foreground">2 sheets — print double-sided, fold in half</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload('reader')}>
                  <BookOpen className="h-3.5 w-3.5 mr-2 shrink-0" />
                  <div>
                    <div className="text-xs font-medium">Reader PDF</div>
                    <div className="text-[10px] text-muted-foreground">4 individual pages — for email or screen</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    <span className="font-medium">Print tip:</span> Select "Print-Ready", then print on A4 with
                    double-sided / flip on short edge. Fold the sheet in half for a finished booklet.
                  </p>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" onClick={() => handleDownload()} disabled={isDownloading}>
              {isDownloading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1" />
              )}
              Download PDF
            </Button>
          )}
        </div>
      </div>

      {/* Split pane: Edit panel + Preview */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Edit panel (left) */}
        <div className="w-full lg:w-[45%] lg:min-w-[360px] border-b lg:border-b-0 lg:border-r overflow-y-auto p-3">
          <BrochureEditPanel
            content={content}
            onChange={setContent}
            photos={photos}
            onRegenerateSection={handleRegenerateSection}
            regeneratingSection={regeneratingSection}
            branding={branding}
            onBrandingChange={setBranding}
            orgId={organization?.id}
            onSaveAsDefaults={handleSaveDefaults}
            isSavingDefaults={isSavingDefaults}
            onSaveCertDefaults={handleSaveCertDefaults}
            isSavingCertDefaults={isSavingCertDefaults}
            onSaveStyleDefaults={handleSaveStyleDefaults}
            isSavingStyleDefaults={isSavingStyleDefaults}
            orgLogoUrl={organization?.logo_url}
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
