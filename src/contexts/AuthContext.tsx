import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useReducer } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

// Temporary: Extend auth roles until Supabase types are regenerated after migration
type AuthRole = Database['public']['Enums']['app_role'] | 'super_admin' | 'developer';

// Consolidated auth state to enable atomic updates via useReducer
interface AuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isDeveloper: boolean;
  userRole: 'super_admin' | 'developer' | 'admin' | 'user' | null;
  loading: boolean;
}

type AuthAction =
  | { type: 'SET_SESSION'; session: Session | null }
  | { type: 'SET_ROLES'; roles: AuthRole[] }
  | { type: 'SET_LOADING'; loading: boolean };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_SESSION': {
      const user = action.session?.user ?? null;
      if (!user) {
        return { user: null, session: null, isAdmin: false, isSuperAdmin: false, isDeveloper: false, userRole: null, loading: false };
      }
      return { ...state, user, session: action.session, loading: true };
    }
    case 'SET_ROLES': {
      const roles = action.roles;
      let highestRole: AuthState['userRole'] = 'user';
      if (roles.includes('super_admin')) highestRole = 'super_admin';
      else if (roles.includes('developer')) highestRole = 'developer';
      else if (roles.includes('admin')) highestRole = 'admin';
      return {
        ...state,
        userRole: highestRole,
        isSuperAdmin: roles.includes('super_admin'),
        isDeveloper: roles.includes('developer'),
        isAdmin: roles.includes('admin') || roles.includes('super_admin'),
        loading: false,
      };
    }
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    default:
      return state;
  }
}

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
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    session: null,
    isAdmin: false,
    isSuperAdmin: false,
    isDeveloper: false,
    userRole: null,
    loading: true,
  });
  const [impersonationState, setImpersonationState] = useState<ImpersonationState | null>(null);

  // Shared role-fetching logic (eliminates duplication)
  const fetchRoles = useCallback((userId: string) => {
    setTimeout(() => {
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .then(({ data, error }) => {
          console.log('AuthContext: Role check result', { data, error });
          const roles = (data?.map(r => r.role) || []) as AuthRole[];
          dispatch({ type: 'SET_ROLES', roles });
        });
    }, 0);
  }, []);

  useEffect(() => {
    console.log('AuthContext: Initializing auth state');

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthContext: Auth state changed', { event, hasSession: !!session, userId: session?.user?.id });
        dispatch({ type: 'SET_SESSION', session });
        if (session?.user) {
          fetchRoles(session.user.id);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('AuthContext: Initial session check', { hasSession: !!session, userId: session?.user?.id, error });
      dispatch({ type: 'SET_SESSION', session });
      if (session?.user) {
        fetchRoles(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchRoles]);

  // Load active impersonation session on auth state change
  useEffect(() => {
    if (state.user && state.isSuperAdmin) {
      loadActiveImpersonation();
    } else {
      setImpersonationState(null);
      localStorage.removeItem('impersonationState');
    }
  }, [state.user, state.isSuperAdmin]);

  const loadActiveImpersonation = async () => {
    if (!state.user) return;
    
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

  const startImpersonation = useCallback(async (orgId: string, reason?: string) => {
    if (!state.user || !state.isSuperAdmin) {
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
  }, [state.user, state.isSuperAdmin]);

  const endImpersonation = useCallback(async () => {
    if (!state.user) return;

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
  }, [state.user, impersonationState]);

  const signOut = useCallback(async () => {
    // End any active impersonation before signing out
    if (impersonationState) {
      await endImpersonation();
    }
    await supabase.auth.signOut();
  }, [impersonationState, endImpersonation]);

  const contextValue = useMemo(() => ({
    user: state.user,
    session: state.session,
    isAdmin: state.isAdmin,
    isSuperAdmin: state.isSuperAdmin,
    isDeveloper: state.isDeveloper,
    userRole: state.userRole,
    loading: state.loading,
    signOut,
    impersonationState,
    startImpersonation,
    endImpersonation,
  }), [state, impersonationState, signOut, startImpersonation, endImpersonation]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
