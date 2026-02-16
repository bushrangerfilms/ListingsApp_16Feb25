import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useState } from 'react';

const SOCIALS_HUB_SETUP_URL = 'https://socials.autolisting.io/organization/settings?setup=endcard';

interface EndCardSetupBannerProps {
  className?: string;
}

export function EndCardSetupBanner({ className }: EndCardSetupBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  const handleSetupClick = () => {
    window.open(SOCIALS_HUB_SETUP_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className={`border-amber-500/50 bg-amber-500/10 dark:bg-amber-500/20 ${className || ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-500/20 p-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-amber-700 dark:text-amber-300">
                Action Required: Set Up Your Branding First
              </h3>
              <p className="text-sm text-amber-800/80 dark:text-amber-200/80">
                <strong>Social media videos will not generate</strong> until you complete your branding setup.
                Do this BEFORE adding new listings. Add your logo, contact info, and brand colors in the Socials Hub.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleSetupClick}
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="button-setup-endcard"
            >
              Set up now
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDismissed(true)}
              aria-label="Dismiss"
              className="text-amber-700 hover:text-amber-800 hover:bg-amber-500/20 dark:text-amber-300 dark:hover:text-amber-200"
              data-testid="button-dismiss-endcard-banner"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
