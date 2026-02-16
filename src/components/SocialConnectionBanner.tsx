import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useState } from 'react';

const SOCIALS_HUB_CONNECTIONS_URL = 'https://socials.autolisting.io/connections';

interface SocialConnectionBannerProps {
  className?: string;
}

export function SocialConnectionBanner({ className }: SocialConnectionBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  const handleConnectClick = () => {
    window.open(SOCIALS_HUB_CONNECTIONS_URL, '_blank', 'noopener,noreferrer');
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
                Action Required: Connect Your Social Accounts
              </h3>
              <p className="text-sm text-amber-800/80 dark:text-amber-200/80">
                <strong>Social media posts will not publish</strong> until you connect at least one social account.
                Do this BEFORE creating content. Link your Facebook, Instagram, or other social profiles in the Socials Hub.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleConnectClick}
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="button-connect-social"
            >
              Connect now
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDismissed(true)}
              aria-label="Dismiss"
              className="text-amber-700 hover:text-amber-800 hover:bg-amber-500/20 dark:text-amber-300 dark:hover:text-amber-200"
              data-testid="button-dismiss-social-banner"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
