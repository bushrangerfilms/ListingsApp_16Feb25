import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const ImpersonationBanner = () => {
  const { impersonationState, endImpersonation } = useAuth();
  const { toast } = useToast();

  if (!impersonationState) return null;

  const handleEndImpersonation = async () => {
    try {
      await endImpersonation();
      toast({
        title: 'Impersonation ended',
        description: 'You have returned to your normal account',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to end impersonation session',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="bg-yellow-500 dark:bg-yellow-600 text-white px-4 py-2 flex items-center justify-between gap-4 sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5" data-testid="icon-impersonation-warning" />
        <span className="font-medium" data-testid="text-impersonation-message">
          Impersonating: {impersonationState.organizationName} 
          ({impersonationState.organizationSlug})
        </span>
        {impersonationState.reason && (
          <span className="text-sm opacity-90" data-testid="text-impersonation-reason">
            • {impersonationState.reason}
          </span>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleEndImpersonation}
        className="bg-white/20 hover:bg-white/30 text-white"
        data-testid="button-end-impersonation"
      >
        <X className="h-4 w-4 mr-1" />
        Exit Impersonation
      </Button>
    </div>
  );
};
