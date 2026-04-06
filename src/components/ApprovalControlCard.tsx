import { ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';

const DISMISS_KEY_PREFIX = 'approval-control-dismissed-';
const AUTO_DISMISS_DAYS = 14;
const AUTO_DISMISS_LISTING_COUNT = 2;

interface ApprovalControlCardProps {
  className?: string;
  listingCount: number;
}

export function ApprovalControlCard({ className, listingCount }: ApprovalControlCardProps) {
  const { organization } = useOrganization();
  const { requirePostApproval, isLoading, updatePostApproval, isUpdating } =
    useOrganizationSettings();
  const [isDismissed, setIsDismissed] = useState(false);

  const dismissKey = organization?.id ? `${DISMISS_KEY_PREFIX}${organization.id}` : null;

  // Check localStorage dismiss
  useEffect(() => {
    if (!dismissKey) return;
    const dismissed = localStorage.getItem(dismissKey);
    if (dismissed) {
      setIsDismissed(true);
    }
  }, [dismissKey]);

  // Auto-dismiss conditions
  const shouldAutoDismiss = useMemo(() => {
    if (!organization?.created_at) return false;

    // 14 days since org creation
    const orgAgeMs = Date.now() - new Date(organization.created_at).getTime();
    if (orgAgeMs > AUTO_DISMISS_DAYS * 24 * 60 * 60 * 1000) return true;

    // 2+ listings
    if (listingCount >= AUTO_DISMISS_LISTING_COUNT) return true;

    return false;
  }, [organization?.created_at, listingCount]);

  if (isLoading || isDismissed || shouldAutoDismiss) {
    return null;
  }

  const handleDismiss = () => {
    if (dismissKey) {
      localStorage.setItem(dismissKey, Date.now().toString());
    }
    setIsDismissed(true);
    toast('Find this anytime in Settings \u2192 Post Approval', {
      description: 'Socials Hub \u2192 Settings \u2192 Post Approval',
    });
  };

  const handleToggle = async (checked: boolean) => {
    await updatePostApproval(checked);
    toast(checked ? 'Post approval enabled' : 'Post approval disabled');
  };

  return (
    <Card className={`border-blue-500/50 bg-blue-500/10 dark:bg-blue-500/20 ${className || ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-blue-500/20 p-2 flex-shrink-0">
              <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="font-semibold text-blue-700 dark:text-blue-300">
                You're in Control
              </h3>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="approval-card-toggle" className="text-sm text-blue-800/80 dark:text-blue-200/80 cursor-pointer">
                  Review posts before they go live
                </Label>
                <Switch
                  id="approval-card-toggle"
                  checked={requirePostApproval}
                  onCheckedChange={handleToggle}
                  disabled={isUpdating}
                />
              </div>
              <p className="text-xs text-blue-600/70 dark:text-blue-300/70">
                Change anytime in Socials Hub &rarr; Settings &rarr; Post Approval
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="text-blue-700 hover:text-blue-800 hover:bg-blue-500/20 dark:text-blue-300 dark:hover:text-blue-200 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
