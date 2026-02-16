import { useAuth } from '@/contexts/AuthContext';

type Permission =
  | 'canViewDashboards'
  | 'canViewAuditLogs'
  | 'canImpersonateUsers'
  | 'canProcessRefunds'
  | 'canGrantCredits'
  | 'canGrantCreditsOver100'
  | 'canManageDiscountCodes'
  | 'canManageFeatureFlags'
  | 'canManageProductionFlags'
  | 'canSuspendOrganizations'
  | 'canDeleteOrganizations'
  | 'canAccessBilling'
  | 'canManageSupportTickets'
  | 'canExportGDPRData'
  | 'canExtendTrial';

const SUPER_ADMIN_PERMISSIONS: Permission[] = [
  'canViewDashboards',
  'canViewAuditLogs',
  'canImpersonateUsers',
  'canProcessRefunds',
  'canGrantCredits',
  'canGrantCreditsOver100',
  'canManageDiscountCodes',
  'canManageFeatureFlags',
  'canManageProductionFlags',
  'canSuspendOrganizations',
  'canDeleteOrganizations',
  'canAccessBilling',
  'canManageSupportTickets',
  'canExportGDPRData',
  'canExtendTrial',
];

const DEVELOPER_PERMISSIONS: Permission[] = [
  'canViewDashboards',
  'canViewAuditLogs',
  'canGrantCredits',
  'canManageFeatureFlags',
  'canManageSupportTickets',
];

export function useSuperAdminPermissions() {
  const { userRole, loading, session, user } = useAuth();

  const isSuperAdmin = userRole === 'super_admin';
  const isDeveloper = userRole === 'developer';
  const isAuthenticated = !!user;
  const hasSession = !!session?.access_token;

  const hasPermission = (permission: Permission): boolean => {
    if (isSuperAdmin) {
      return SUPER_ADMIN_PERMISSIONS.includes(permission);
    }
    if (isDeveloper) {
      return DEVELOPER_PERMISSIONS.includes(permission);
    }
    return false;
  };

  const canAccessSuperAdminPortal = isSuperAdmin || isDeveloper;
  
  // Only grant super admin access when session token is fully ready
  const hasSuperAdminAccess = isAuthenticated && hasSession && canAccessSuperAdminPortal;
  
  // Consider loading until: auth context done AND (if authenticated: role check complete AND session token available)
  const isLoading = loading || (isAuthenticated && (userRole === null || !hasSession));

  return {
    userRole,
    isSuperAdmin,
    isDeveloper,
    hasPermission,
    canAccessSuperAdminPortal,
    hasSuperAdminAccess,
    loading: isLoading,
  };
}
