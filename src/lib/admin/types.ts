export type SuperAdminRole = 'super_admin' | 'developer';

export interface AdminPermission {
  canImpersonate: boolean;
  canProcessRefunds: boolean;
  canGrantCredits: boolean;
  canGrantCreditsUnlimited: boolean;
  canManageDiscounts: boolean;
  canModifyFeatureFlags: boolean;
  canModifyProductionFlags: boolean;
  canSuspendOrgs: boolean;
  canDeleteOrgs: boolean;
  canAccessBilling: boolean;
  canExportGDPRData: boolean;
  canManageTickets: boolean;
  canViewAuditLog: boolean;
}

export const ROLE_PERMISSIONS: Record<SuperAdminRole, AdminPermission> = {
  super_admin: {
    canImpersonate: true,
    canProcessRefunds: true,
    canGrantCredits: true,
    canGrantCreditsUnlimited: true,
    canManageDiscounts: true,
    canModifyFeatureFlags: true,
    canModifyProductionFlags: true,
    canSuspendOrgs: true,
    canDeleteOrgs: true,
    canAccessBilling: true,
    canExportGDPRData: true,
    canManageTickets: true,
    canViewAuditLog: true,
  },
  developer: {
    canImpersonate: false,
    canProcessRefunds: false,
    canGrantCredits: true,
    canGrantCreditsUnlimited: false,
    canManageDiscounts: false,
    canModifyFeatureFlags: true,
    canModifyProductionFlags: false,
    canSuspendOrgs: false,
    canDeleteOrgs: false,
    canAccessBilling: false,
    canExportGDPRData: false,
    canManageTickets: true,
    canViewAuditLog: true,
  },
};

export function getPermissionsForRole(role: SuperAdminRole | null): AdminPermission | null {
  if (!role || !(role in ROLE_PERMISSIONS)) {
    return null;
  }
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(
  role: SuperAdminRole | null,
  permission: keyof AdminPermission
): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions ? permissions[permission] : false;
}
