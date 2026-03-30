import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Rocket, Video, Users, Palette } from 'lucide-react';
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

const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSnoozeKey(orgId: string): string {
  return `welcome-modal-snoozed-${orgId}`;
}

function isSnoozed(orgId: string | undefined): boolean {
  if (!orgId) return false;
  try {
    const raw = localStorage.getItem(getSnoozeKey(orgId));
    if (!raw) return false;
    return Date.now() - parseInt(raw, 10) < SNOOZE_DURATION_MS;
  } catch {
    return false;
  }
}

function snoozeModal(orgId: string): void {
  try {
    localStorage.setItem(getSnoozeKey(orgId), String(Date.now()));
  } catch {
    // localStorage unavailable — modal will show again next load
  }
}

interface WelcomeModalProps {
  onClose?: () => void;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function WelcomeModal({ onClose, externalOpen, onExternalOpenChange }: WelcomeModalProps) {
  const { organization } = useOrganization();
  const { isComplete, isLoading } = useOnboarding();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const isControlled = externalOpen !== undefined;
  const modalOpen = isControlled ? externalOpen : isOpen;

  // Check if organization is in pilot/comped mode - skip welcome modal for pilot users
  const isPilot = organization?.is_comped === true;

  useEffect(() => {
    // Skip for pilot users, completed onboarding, or externally controlled
    if (isControlled) return;
    if (!isLoading && !isComplete && organization && !isPilot && !isSnoozed(organization.id)) {
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isComplete, organization, isPilot, isControlled]);

  const handleGetStarted = () => {
    if (organization) snoozeModal(organization.id);
    setIsOpen(false);
    onExternalOpenChange?.(false);
    onClose?.();
    navigate('/admin/settings');
  };

  const handleDismiss = () => {
    if (organization) snoozeModal(organization.id);
    setIsOpen(false);
    onExternalOpenChange?.(false);
    onClose?.();
  };

  if (isLoading || isComplete) {
    return null;
  }

  return (
    <Dialog open={modalOpen} onOpenChange={(open) => {
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
              <Rocket className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Free Forever Plan</p>
              <p className="text-xs text-muted-foreground">
                3 listings, automated social posting, CRM & email — no credit card required
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Video className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">AI-Generated Videos</p>
              <p className="text-xs text-muted-foreground">
                Access to 3 video styles, posted to all your social platforms
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
            <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
              <Palette className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Your Brand on Every Video</p>
              <p className="text-xs text-muted-foreground">
                Custom end cards with your logo, colours, and contact info
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
                We'll take you to your profile settings first
              </p>
            </div>
          </div>
        </div>

        <Button 
          onClick={handleGetStarted} 
          className="w-full"
          data-testid="button-get-started"
        >
          Set Up Your Profile
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}
