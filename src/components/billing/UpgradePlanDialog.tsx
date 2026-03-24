import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCount: number;
  maxAllowed: number;
  planName: string;
}

export function UpgradePlanDialog({
  open,
  onOpenChange,
  currentCount,
  maxAllowed,
  planName,
}: UpgradePlanDialogProps) {
  const navigate = useNavigate();

  const displayPlanName = planName.charAt(0).toUpperCase() + planName.slice(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
            <DialogTitle>Listing Limit Reached</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            You've reached your <strong>{displayPlanName}</strong> plan's listing limit
            ({currentCount}/{maxAllowed}). Upgrade your plan to add more listings.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Dismiss
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate('/admin/billing/upgrade');
            }}
          >
            Upgrade Plan
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
