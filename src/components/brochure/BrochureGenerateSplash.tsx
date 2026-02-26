import { FileText, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BrochureGenerateSplashProps {
  listingTitle: string;
  listingAddress: string;
  heroPhoto?: string;
  isGenerating: boolean;
  onGenerate: () => void;
}

export function BrochureGenerateSplash({
  listingTitle,
  listingAddress,
  heroPhoto,
  isGenerating,
  onGenerate,
}: BrochureGenerateSplashProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
      <div className="max-w-md text-center space-y-6">
        {heroPhoto ? (
          <div className="w-64 h-44 mx-auto rounded-lg overflow-hidden shadow-lg">
            <img src={heroPhoto} alt={listingTitle} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-24 h-24 mx-auto rounded-full bg-muted flex items-center justify-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-1">{listingTitle}</h2>
          <p className="text-sm text-muted-foreground">{listingAddress}</p>
        </div>

        <div className="space-y-2">
          <h3 className="font-medium">Generate Property Brochure</h3>
          <p className="text-sm text-muted-foreground">
            AI will create a professional brochure from your listing data — description, photos,
            room details, features, and more. You can then edit everything in the visual editor.
          </p>
        </div>

        <Button
          size="lg"
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full max-w-xs"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating brochure...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate with AI
            </>
          )}
        </Button>

        {isGenerating && (
          <p className="text-xs text-muted-foreground animate-pulse">
            This usually takes 5-10 seconds...
          </p>
        )}
      </div>
    </div>
  );
}
