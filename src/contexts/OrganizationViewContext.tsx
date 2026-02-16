import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import type { PropertyService } from '@/lib/billing/types';

interface OrganizationData {
  id: string;
  business_name: string;
  slug: string;
  logo_url: string | null;
  favicon_url: string | null;
  is_active: boolean;
  domain: string | null;
  custom_domain: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  business_address: string | null;
  psr_licence_number: string | null;
  property_services?: PropertyService[];
  primary_color?: string | null;
  secondary_color?: string | null;
}

interface OrganizationViewContextType {
  viewAsOrganizationId: string | null;
  setViewAsOrganization: (orgId: string | null) => Promise<void>;
  isOrganizationView: boolean;
  clearOrganizationView: () => Promise<void>;
  organizations: OrganizationData[];
  isLoadingOrganizations: boolean;
  selectedOrganization: OrganizationData | null;
  isSuperAdmin: boolean;
}

const OrganizationViewContext = createContext<OrganizationViewContextType>({
  viewAsOrganizationId: null,
  setViewAsOrganization: async () => {},
  isOrganizationView: false,
  clearOrganizationView: async () => {},
  organizations: [],
  isLoadingOrganizations: false,
  selectedOrganization: null,
  isSuperAdmin: false,
});

export const useOrganizationView = () => {
  const context = useContext(OrganizationViewContext);
  if (!context) {
    throw new Error('useOrganizationView must be used within OrganizationViewProvider');
  }
  return context;
};

const STORAGE_KEY = 'admin_view_as_organization';

interface OrganizationViewProviderProps {
  children: ReactNode;
}

export const OrganizationViewProvider = ({ children }: OrganizationViewProviderProps) => {
  const { user, loading: authLoading, isSuperAdmin } = useAuth();
  const [viewAsOrganizationId, setViewAsOrganizationIdState] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationData[]>([]);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);

  // Load stored organization view preference
  useEffect(() => {
    if (!isSuperAdmin) {
      // Clear organization view if user is not super admin
      localStorage.removeItem(STORAGE_KEY);
      setViewAsOrganizationIdState(null);
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setViewAsOrganizationIdState(stored);
    }
  }, [isSuperAdmin]);

  // Fetch all organizations for super admins
  useEffect(() => {
    const fetchOrganizations = async () => {
      if (!isSuperAdmin) {
        setOrganizations([]);
        return;
      }

      setIsLoadingOrganizations(true);
      try {
        // Cast needed: property_services column added but Supabase types not regenerated yet
        const { data, error } = await (supabase as any)
          .from('organizations')
          .select('id, business_name, slug, logo_url, favicon_url, is_active, domain, contact_name, contact_email, contact_phone, business_address, psr_licence_number, property_services')
          .order('business_name');

        if (error) throw error;
        setOrganizations((data || []) as OrganizationData[]);
      } catch (error) {
        console.error('Error fetching organizations:', error);
        setOrganizations([]);
      } finally {
        setIsLoadingOrganizations(false);
      }
    };

    fetchOrganizations();
  }, [isSuperAdmin]);

  // Use the Edge Function to create proper impersonation sessions for RLS
  const setViewAsOrganization = useCallback(async (orgId: string | null) => {
    if (!isSuperAdmin) {
      console.warn('Only super admins can use organization view');
      return;
    }

    try {
      if (orgId) {
        // Create database impersonation session via Edge Function
        const { adminApi } = await import('@/lib/admin/adminApi');
        await adminApi.impersonation.start({ 
          organizationId: orgId, 
          reason: 'Admin portal view-as' 
        });
        
        localStorage.setItem(STORAGE_KEY, orgId);
        setViewAsOrganizationIdState(orgId);
        console.log('[OrganizationViewContext] Started impersonation for:', orgId);
      } else {
        // End impersonation session
        const { adminApi } = await import('@/lib/admin/adminApi');
        await adminApi.impersonation.end({});
        
        localStorage.removeItem(STORAGE_KEY);
        setViewAsOrganizationIdState(null);
        console.log('[OrganizationViewContext] Ended impersonation');
      }
    } catch (error) {
      console.error('[OrganizationViewContext] Impersonation error:', error);
      // Still update local state to maintain UI consistency
      if (orgId) {
        localStorage.setItem(STORAGE_KEY, orgId);
        setViewAsOrganizationIdState(orgId);
      } else {
        localStorage.removeItem(STORAGE_KEY);
        setViewAsOrganizationIdState(null);
      }
    }
  }, [isSuperAdmin]);

  const clearOrganizationView = useCallback(async () => {
    try {
      // End impersonation session in database
      const { adminApi } = await import('@/lib/admin/adminApi');
      await adminApi.impersonation.end({});
    } catch (error) {
      console.error('[OrganizationViewContext] Error ending impersonation:', error);
    }
    
    localStorage.removeItem(STORAGE_KEY);
    setViewAsOrganizationIdState(null);
  }, []);

  const selectedOrganization = organizations.find(org => org.id === viewAsOrganizationId) || null;
  const isOrganizationView = isSuperAdmin && !!viewAsOrganizationId;

  return (
    <OrganizationViewContext.Provider
      value={{
        viewAsOrganizationId,
        setViewAsOrganization,
        isOrganizationView,
        clearOrganizationView,
        organizations,
        isLoadingOrganizations,
        selectedOrganization,
        isSuperAdmin,
      }}
    >
      {children}
    </OrganizationViewContext.Provider>
  );
};
