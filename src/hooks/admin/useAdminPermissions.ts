import { useAuth } from '@/contexts/AuthContext';
import { 
  SuperAdminRole, 
  AdminPermission, 
  getPermissionsForRole, 
  hasPermission as checkPermission 
} from '@/lib/admin/types';

export function useAdminPermissions() {
  const { user, session, userRole, isSuperAdmin, isDeveloper, loading } = useAuth();
  
  const isAuthenticated = !!user;
  const hasSession = !!session?.access_token;
  
  // Consider still loading if:
  // 1. Auth context is still loading
  // 2. User exists but role check hasn't completed yet (userRole is null)
  // 3. User exists but session token isn't available yet
  const isRoleLoading = loading || (isAuthenticated && (userRole === null || !hasSession));
  
  // Only grant super admin access when session is fully ready
  const hasSuperAdminAccess = isAuthenticated && hasSession && (isSuperAdmin || isDeveloper);
  
  const adminRole = (isSuperAdmin ? 'super_admin' : isDeveloper ? 'developer' : null) as SuperAdminRole | null;
  const permissions = getPermissionsForRole(adminRole);
  
  const hasPermission = (permission: keyof AdminPermission): boolean => {
    if (!isAuthenticated) return false;
    return checkPermission(adminRole, permission);
  };
  
  return {
    loading: isRoleLoading,
    isAuthenticated,
    isSuperAdmin,
    isDeveloper,
    hasSuperAdminAccess,
    permissions,
    hasPermission,
    userRole: adminRole,
  };
}
