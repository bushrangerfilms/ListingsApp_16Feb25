import { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, Gift, Zap, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOrganization } from '@/contexts/OrganizationContext';

interface WelcomeModalProps {
  onClose?: () => void;
}

export function WelcomeModal({ onClose }: WelcomeModalProps) {
  const { organization } = useOrganization();
  const { hasSeenWelcome, markWelcomeSeen, isLoading } = useOnboarding();
  const [isOpen, setIsOpen] = useState(false);

  // Check if organization is in pilot/comped mode - skip welcome modal for pilot users
  const isPilot = organization?.is_comped === true;

  useEffect(() => {
    // Skip showing welcome modal for pilot users
    if (!isLoading && !hasSeenWelcome && organization && !isPilot) {
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, hasSeenWelcome, organization, isPilot]);

  const handleGetStarted = async () => {
    await markWelcomeSeen();
    setIsOpen(false);
    onClose?.();
  };

  const handleDismiss = () => {
    setIsOpen(false);
    onClose?.();
  };

  if (isLoading || hasSeenWelcome) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleDismiss();
    }}>
      <DialogContent 
        className="sm:max-w-md"
        data-testid="welcome-modal"
      >
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-xl">
            Welcome to AutoListing.io
            {organization?.business_name && (
              <span className="block text-base font-normal text-muted-foreground mt-1">
                {organization.business_name}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            Your all-in-one platform for real estate listings, CRM, and marketing automation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <Gift className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">14-Day Free Trial</p>
              <p className="text-xs text-muted-foreground">
                Full access to all features, no credit card required
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">100 Free Credits</p>
              <p className="text-xs text-muted-foreground">
                Use AI features, generate content, and more
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
            <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Guided Setup</p>
              <p className="text-xs text-muted-foreground">
                We'll help you get everything configured
              </p>
            </div>
          </div>
        </div>

        <Button 
          onClick={handleGetStarted} 
          className="w-full"
          data-testid="button-get-started"
        >
          Let's Get Started
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}
