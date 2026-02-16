import { Navigate, useLocation } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePilotModeFlag } from '@/hooks/useFeatureFlag';
import { Loader2 } from 'lucide-react';

interface PilotModeRouteGuardProps {
  children: React.ReactNode;
}

export function PilotModeRouteGuard({ children }: PilotModeRouteGuardProps) {
  const { organization, loading: orgLoading } = useOrganization();
  const { user, impersonationState, isSuperAdmin } = useAuth();
  const { isEnabled: isPilotMode, isLoading: flagLoading } = usePilotModeFlag();
  const location = useLocation();

  const isLoading = orgLoading || flagLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isPilotMode) {
    return <>{children}</>;
  }

  if (isSuperAdmin) {
    return <>{children}</>;
  }

  if (impersonationState) {
    return <>{children}</>;
  }

  if (!organization) {
    return <Navigate to="/marketing" state={{ from: location }} replace />;
  }

  const isCompedOrg = organization.is_comped === true;

  if (!isCompedOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-4 p-6">
          <h1 className="text-2xl font-bold">Private Beta</h1>
          <p className="text-muted-foreground">
            AutoListing.io is currently in private beta. Your organization is not yet part of the pilot program.
          </p>
          <p className="text-sm text-muted-foreground">
            Contact us at support@autolisting.io to request access.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
