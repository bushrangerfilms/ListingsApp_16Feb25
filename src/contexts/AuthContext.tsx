import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

// Temporary: Extend auth roles until Supabase types are regenerated after migration
type AuthRole = Database['public']['Enums']['app_role'] | 'super_admin' | 'developer';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isDeveloper: boolean;
  userRole: 'super_admin' | 'developer' | 'admin' | 'user' | null;
  loading: boolean;
  signOut: () => Promise<void>;
  impersonationState: ImpersonationState | null;
  startImpersonation: (orgId: string, reason?: string) => Promise<void>;
  endImpersonation: () => Promise<void>;
}

interface ImpersonationState {
  sessionId: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  startedAt: string;
  reason?: string;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAdmin: false,
  isSuperAdmin: false,
  isDeveloper: false,
  userRole: null,
  loading: true,
  signOut: async () => {},
  impersonationState: null,
  startImpersonation: async () => {},
  endImpersonation: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [userRole, setUserRole] = useState<'super_admin' | 'developer' | 'admin' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonationState, setImpersonationState] = useState<ImpersonationState | null>(null);

  useEffect(() => {
    console.log('AuthContext: Initializing auth state');
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthContext: Auth state changed', { event, hasSession: !!session, userId: session?.user?.id });
        setSession(session);
        setUser(session?.user ?? null);

        // Check admin roles when session changes
        if (session?.user) {
          // Defer Supabase query to avoid auth state change deadlock
          setTimeout(() => {
            supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .then(({ data, error }) => {
                console.log('AuthContext: Role check result', { data, error });
                const roles = (data?.map(r => r.role) || []) as AuthRole[];
                
                // Determine highest role (super_admin > developer > admin > user)
                let highestRole: 'super_admin' | 'developer' | 'admin' | 'user' | null = null;
                if (roles.includes('super_admin')) {
                  highestRole = 'super_admin';
                } else if (roles.includes('developer')) {
                  highestRole = 'developer';
                } else if (roles.includes('admin')) {
                  highestRole = 'admin';
                } else {
                  highestRole = 'user';
                }
                
                setUserRole(highestRole);
                setIsSuperAdmin(roles.includes('super_admin'));
                setIsDeveloper(roles.includes('developer'));
                setIsAdmin(roles.includes('admin') || roles.includes('super_admin'));
                setLoading(false);
              });
          }, 0);
        } else {
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setIsDeveloper(false);
          setUserRole(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('AuthContext: Initial session check', { hasSession: !!session, userId: session?.user?.id, error });
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .then(({ data, error }) => {
              console.log('AuthContext: Initial role check result', { data, error });
              const roles = (data?.map(r => r.role) || []) as AuthRole[];
              
              // Determine highest role (super_admin > developer > admin > user)
              let highestRole: 'super_admin' | 'developer' | 'admin' | 'user' | null = null;
              if (roles.includes('super_admin')) {
                highestRole = 'super_admin';
              } else if (roles.includes('developer')) {
                highestRole = 'developer';
              } else if (roles.includes('admin')) {
                highestRole = 'admin';
              } else {
                highestRole = 'user';
              }
              
              setUserRole(highestRole);
              setIsSuperAdmin(roles.includes('super_admin'));
              setIsDeveloper(roles.includes('developer'));
              setIsAdmin(roles.includes('admin') || roles.includes('super_admin'));
              setLoading(false);
            });
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load active impersonation session on auth state change
  useEffect(() => {
    if (user && isSuperAdmin) {
      loadActiveImpersonation();
    } else {
      setImpersonationState(null);
      localStorage.removeItem('impersonationState');
    }
  }, [user, isSuperAdmin]);

  const loadActiveImpersonation = async () => {
    if (!user) return;
    
    try {
      // Temporary: Type assertion until Supabase types are regenerated
      // Function uses auth.uid() internally for security
      const { data, error } = await (supabase.rpc as any)('get_active_impersonation');

      if (error) {
        console.error('Failed to load active impersonation:', error);
        // Clear stale localStorage if server has no active session
        localStorage.removeItem('impersonationState');
        setImpersonationState(null);
        return;
      }

      if (data && data.length > 0) {
        const session = data[0];
        const state: ImpersonationState = {
          sessionId: session.session_id,
          organizationId: session.organization_id,
          organizationSlug: session.organization_slug,
          organizationName: session.organization_name,
          startedAt: session.started_at,
          reason: session.reason,
        };
        setImpersonationState(state);
        localStorage.setItem('impersonationState', JSON.stringify(state));
        console.log('Loaded active impersonation:', state);
      } else {
        // No active session
        setImpersonationState(null);
        localStorage.removeItem('impersonationState');
      }
    } catch (err) {
      console.error('Error loading impersonation:', err);
    }
  };

  const startImpersonation = async (orgId: string, reason?: string) => {
    if (!user || !isSuperAdmin) {
      console.error('Only super admins can impersonate');
      return;
    }

    try {
      // Use secured Edge Function for impersonation with audit logging
      const { adminApi } = await import('@/lib/admin/adminApi');
      await adminApi.impersonation.start({ organizationId: orgId, reason });

      // Load the active impersonation state
      await loadActiveImpersonation();
      
      // Trigger organization context reload
      window.dispatchEvent(new CustomEvent('impersonation-changed'));
      
      console.log('Started impersonation via Edge Function');
    } catch (err) {
      console.error('Error starting impersonation:', err);
      throw err;
    }
  };

  const endImpersonation = async () => {
    if (!user) return;

    const currentState = impersonationState;

    try {
      // Use secured Edge Function for ending impersonation with audit logging
      const { adminApi } = await import('@/lib/admin/adminApi');
      await adminApi.impersonation.end({
        sessionId: currentState?.sessionId,
        organizationId: currentState?.organizationId,
      });

      setImpersonationState(null);
      localStorage.removeItem('impersonationState');
      
      // Trigger organization context reload
      window.dispatchEvent(new CustomEvent('impersonation-changed'));
      
      console.log('Ended impersonation via Edge Function');
    } catch (err) {
      console.error('Error ending impersonation:', err);
      throw err;
    }
  };

  const signOut = async () => {
    // End any active impersonation before signing out
    if (impersonationState) {
      await endImpersonation();
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      isAdmin, 
      isSuperAdmin,
      isDeveloper, 
      userRole, 
      loading, 
      signOut,
      impersonationState,
      startImpersonation,
      endImpersonation
    }}>
      {children}
    </AuthContext.Provider>
  );
};
