import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import type { AccountStatus, PropertyService } from '@/lib/billing/types';

interface Organization {
  id: string;
  slug: string;
  business_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  domain: string | null;
  custom_domain: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  business_address: string | null;
  psr_licence_number: string | null;
  // Property services (sales, rentals, holiday_rentals)
  property_services?: PropertyService[];
  // Phase 2.5: Account lifecycle fields (optional - may not be in DB yet)
  account_status?: AccountStatus;
  credit_spending_enabled?: boolean;
  read_only_reason?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  grace_period_ends_at?: string | null;
  archived_at?: string | null;
  is_active: boolean;
  // Pilot program: Billing exemption for comped organizations
  is_comped?: boolean;
  // Branding colors
  primary_color?: string | null;
  secondary_color?: string | null;
}

interface UserOrganization {
  id: string;
  business_name: string;
  slug: string;
  logo_url: string | null;
}

interface OrganizationContextType {
  organization: Organization | null;
  loading: boolean;
  setOrganizationBySlug: (slug: string) => Promise<Organization | null>;
  userOrganizations: UserOrganization[];
  switchOrganization: (orgId: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [userOrganizations, setUserOrganizations] = useState<UserOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, impersonationState } = useAuth();

  // Load organization for authenticated admin users
  useEffect(() => {
    const loadUserOrganization = async () => {
      if (!user) {
        console.log('[OrganizationContext] No user found, skipping organization load');
        setLoading(false);
        return;
      }

      console.log('[OrganizationContext] Loading organization for user:', user.id);

      try {
        // PRIORITY 1: Check for active impersonation session
        if (impersonationState) {
          console.log('[OrganizationContext] Loading impersonated organization:', impersonationState.organizationSlug);
          
          const { data: org, error: orgError } = await supabase
            .schema('public')
            .from('organizations')
            .select('*')
            .eq('id', impersonationState.organizationId)
            .single();

          if (orgError) {
            console.error('[OrganizationContext] Error fetching impersonated organization:', orgError);
          } else {
            console.log('[OrganizationContext] Successfully loaded impersonated organization:', org.business_name);
            setOrganization(org);
          }
          setLoading(false);
          return;
        }

        // PRIORITY 2: Get ALL user's organizations from public schema
        const { data: userOrgs, error: userOrgError } = await supabase
          .schema('public')
          .from('user_organizations')
          .select('organization_id')
          .eq('user_id', user.id);

        if (userOrgError) {
          console.error('[OrganizationContext] Error fetching user organization:', userOrgError);
          setLoading(false);
          return;
        }

        if (!userOrgs || userOrgs.length === 0) {
          console.warn('[OrganizationContext] No organization link found for user:', user.id);
          console.log('[OrganizationContext] User email:', user.email);
          setLoading(false);
          return;
        }

        const orgIds = userOrgs.map(uo => uo.organization_id);

        // Fetch all org details for the switcher
        const { data: allOrgs, error: allOrgsError } = await supabase
          .schema('public')
          .from('organizations')
          .select('id, business_name, slug, logo_url')
          .in('id', orgIds);

        if (!allOrgsError && allOrgs) {
          setUserOrganizations(allOrgs);
        }

        // Check if user previously selected an org (persisted in localStorage)
        const savedOrgId = localStorage.getItem('selectedOrganizationId');
        const targetOrgId = savedOrgId && orgIds.includes(savedOrgId) ? savedOrgId : orgIds[0];

        console.log('[OrganizationContext] Found organization_id:', targetOrgId);

        // Get organization details from public schema (shared with Social Media app)
        const { data: org, error: orgError } = await supabase
          .schema('public')
          .from('organizations')
          .select('*')
          .eq('id', targetOrgId)
          .single();

        if (orgError) {
          console.error('[OrganizationContext] Error fetching organization:', orgError);
        } else {
          console.log('[OrganizationContext] Successfully loaded organization:', org.business_name, '(', org.slug, ')');
          setOrganization(org);
        }
      } catch (error) {
        console.error('[OrganizationContext] Error loading user organization:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserOrganization();
  }, [user, impersonationState]);

  // Listen for impersonation changes
  useEffect(() => {
    const handleImpersonationChange = () => {
      console.log('[OrganizationContext] Impersonation changed, reloading organization');
      setLoading(true);
      // The dependency on impersonationState will trigger a reload
    };

    window.addEventListener('impersonation-changed', handleImpersonationChange);
    return () => window.removeEventListener('impersonation-changed', handleImpersonationChange);
  }, []);

  // Switch to a different organization (for multi-org users)
  const switchOrganization = useCallback(async (orgId: string) => {
    try {
      setLoading(true);
      console.log('[OrganizationContext] Switching to organization:', orgId);

      const { data: org, error: orgError } = await supabase
        .schema('public')
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

      if (orgError) {
        console.error('[OrganizationContext] Error switching organization:', orgError);
      } else {
        console.log('[OrganizationContext] Switched to organization:', org.business_name);
        setOrganization(org);
        localStorage.setItem('selectedOrganizationId', orgId);
      }
    } catch (error) {
      console.error('[OrganizationContext] Exception switching organization:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Set organization by slug (for public pages)
  const setOrganizationBySlug = useCallback(async (slug: string): Promise<Organization | null> => {
    try {
      setLoading(true);
      console.log('[OrganizationContext] Loading organization by slug (public mode):', slug);
      
      // organizations is in public schema (shared with Social Media app)
      const { data: org, error } = await supabase
        .schema('public')
        .from('organizations')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('[OrganizationContext] ERROR fetching organization by slug:', error);
        console.error('[OrganizationContext] Error details:', {
          message: error.message,
          code: error.code,
          hint: error.hint,
          details: error.details
        });
        setOrganization(null);
        return null;
      } else {
        setOrganization(org);
        return org;
      }
    } catch (error) {
      console.error('[OrganizationContext] Exception loading organization:', error);
      setOrganization(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const contextValue = useMemo(() => ({
    organization,
    loading,
    setOrganizationBySlug,
    userOrganizations,
    switchOrganization,
  }), [organization, loading, setOrganizationBySlug, userOrganizations, switchOrganization]);

  return (
    <OrganizationContext.Provider value={contextValue}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};