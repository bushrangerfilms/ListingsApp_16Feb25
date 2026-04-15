import { Navigate, useLocation } from 'react-router-dom';
import { useAdminPermissions } from '@/hooks/admin/useAdminPermissions';
import { useAuth } from '@/contexts/AuthContext';

interface SuperAdminRouteGuardProps {
  children: React.ReactNode;
}

export function SuperAdminRouteGuard({ children }: SuperAdminRouteGuardProps) {
  const { hasSuperAdminAccess, isAuthenticated, loading } = useAdminPermissions();
  const { impersonationState } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/admin/login?returnUrl=${returnUrl}`} replace />;
  }

  if (impersonationState) {
    return <Navigate to="/admin/listings" replace />;
  }

  if (!hasSuperAdminAccess) {
    return <Navigate to="/admin/listings" replace />;
  }

  return <>{children}</>;
}
