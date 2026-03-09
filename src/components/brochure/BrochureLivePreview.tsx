import { useMemo, useState, useEffect } from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import type { BrochureContent, BrochureBranding } from '@/lib/brochure/types';
import { getTemplate } from './templates/templateRegistry';
import { Loader2 } from 'lucide-react';

interface BrochureLivePreviewProps {
  content: BrochureContent;
  branding: BrochureBranding;
  templateId?: string;
}

export function BrochureLivePreview({ content, branding, templateId }: BrochureLivePreviewProps) {
  const resolvedTemplateId = branding.styleOptions?.templateId || templateId || 'classic-1';
  const template = getTemplate(resolvedTemplateId);
  const pageFormat = branding.styleOptions?.pageFormat || 'a5';
  // Preview always uses reader layout (individual pages) for easy editing.
  // The print-ready imposed layout is only generated on download.
  const TemplateComponent = pageFormat === 'a5'
    ? (template.a5ReaderComponent || template.component)
    : template.component;

  // Debounce the content to avoid excessive re-renders of the PDF
  const [debouncedContent, setDebouncedContent] = useState(content);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setIsUpdating(true);
    const timeout = setTimeout(() => {
      setDebouncedContent(content);
      setIsUpdating(false);
    }, 500);
    return () => clearTimeout(timeout);
  }, [content]);

  const pdfDocument = useMemo(
    () => <TemplateComponent content={debouncedContent} branding={branding} />,
    [debouncedContent, branding, TemplateComponent]
  );

  return (
    <div className="relative h-full w-full bg-muted/30 rounded-lg overflow-hidden">
      {isUpdating && (
        <div className="absolute top-2 right-2 z-10 bg-background/80 rounded-full px-3 py-1 flex items-center gap-1.5 text-xs text-muted-foreground shadow-sm">
          <Loader2 className="h-3 w-3 animate-spin" />
          Updating preview...
        </div>
      )}
      <PDFViewer
        width="100%"
        height="100%"
        showToolbar={false}
        style={{ border: 'none' }}
      >
        {pdfDocument}
      </PDFViewer>
    </div>
  );
}
