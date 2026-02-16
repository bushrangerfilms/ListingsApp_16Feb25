import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi, isCreditsRedacted } from '@/lib/admin/adminApi';
import { useAuth } from '@/contexts/AuthContext';

interface SuperAdminOnlyRouteGuardProps {
  children: React.ReactNode;
  fallbackPath?: string;
}

export function SuperAdminOnlyRouteGuard({ 
  children, 
  fallbackPath = '/internal' 
}: SuperAdminOnlyRouteGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();

  const { data: roleData, isLoading: roleLoading, isError, isSuccess, error } = useQuery({
    queryKey: ['admin', 'verify-super-admin-role'],
    queryFn: async () => {
      const overview = await adminApi.analytics.getOverview();
      return overview;
    },
    enabled: !!user,
    staleTime: 30000,
    retry: false,
  });

  if (authLoading || (!!user && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/admin/login?returnUrl=${returnUrl}`} replace />;
  }

  if (isError) {
    const errorMsg = (error as Error)?.message || '';
    if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('Unauthorized')) {
      return <Navigate to="/admin/listings" replace />;
    }
    return <Navigate to={fallbackPath} replace />;
  }

  if (!isSuccess || !roleData) {
    return <Navigate to={fallbackPath} replace />;
  }

  if (isCreditsRedacted(roleData.credits)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
