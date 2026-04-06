import { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';

interface PostingPreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function PostingPreferencesDialog({
  open,
  onOpenChange,
  onComplete,
}: PostingPreferencesDialogProps) {
  const { requirePostApproval, isLoading, updatePostApproval, isUpdating } =
    useOrganizationSettings();

  const [localValue, setLocalValue] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      setLocalValue(requirePostApproval);
    }
  }, [isLoading, requirePostApproval]);

  const handleSave = async () => {
    await updatePostApproval(localValue);
    onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-blue-500/20 p-2">
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <DialogTitle>Posting Preferences</DialogTitle>
          </div>
          <DialogDescription>
            Choose how your social media posts are handled.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-muted/30">
            <Label htmlFor="approval-toggle" className="flex-1 cursor-pointer">
              <p className="font-medium text-foreground">
                Review posts before they go live
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                You'll get a notification when posts are ready for review.
              </p>
            </Label>
            <Switch
              id="approval-toggle"
              checked={localValue}
              onCheckedChange={setLocalValue}
              disabled={isLoading}
            />
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Nothing posts without your say-so. You can change this anytime in Settings.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={isUpdating || isLoading}
          className="w-full"
        >
          {isUpdating ? 'Saving...' : 'Save & Continue'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
