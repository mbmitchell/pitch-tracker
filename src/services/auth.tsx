import { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type AuthAction = 'signIn' | 'signUp' | 'signOut' | null;

type Credentials = {
  email: string;
  password: string;
};

type SignInResult = {
  success: boolean;
  error?: string;
};

type SignUpResult = {
  success: boolean;
  error?: string;
  requiresEmailConfirmation: boolean;
};

type SignOutResult = {
  success: boolean;
  error?: string;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  authError: string | null;
  isSigningIn: boolean;
  isSigningUp: boolean;
  isSigningOut: boolean;
  signIn: (credentials: Credentials) => Promise<SignInResult>;
  signUp: (credentials: Credentials) => Promise<SignUpResult>;
  signOut: () => Promise<SignOutResult>;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const missingConfigMessage =
  'Supabase Auth is not configured yet. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to continue.';

/**
 * Provides the authenticated Supabase session and Phase 1 auth actions to the app.
 *
 * @param children - app subtree that needs auth state
 * @returns provider wrapping auth-aware UI
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authAction, setAuthAction] = useState<AuthAction>(null);

  useEffect(() => {
    function handleAppStateChange(state: AppStateStatus) {
      if (Platform.OS === 'web') {
        return;
      }

      if (state === 'active') {
        supabase.auth.startAutoRefresh();
        return;
      }

      supabase.auth.stopAutoRefresh();
    }

    async function bootstrapSession() {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setAuthError(error.message);
      }

      setSession(data.session);
      setUser(data.session?.user ?? null);
      setIsBootstrapping(false);
    }

    void bootstrapSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsBootstrapping(false);
      setAuthError(null);
    });

    const appStateSubscription =
      Platform.OS === 'web'
        ? null
        : AppState.addEventListener('change', handleAppStateChange);

    if (Platform.OS !== 'web') {
      supabase.auth.startAutoRefresh();
    }

    return () => {
      subscription.unsubscribe();
      appStateSubscription?.remove();

      if (Platform.OS !== 'web') {
        supabase.auth.stopAutoRefresh();
      }
    };
  }, []);

  async function signIn({ email, password }: Credentials): Promise<SignInResult> {
    setAuthError(null);

    if (!isSupabaseConfigured) {
      setAuthError(missingConfigMessage);
      return { success: false, error: missingConfigMessage };
    }

    setAuthAction('signIn');

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setAuthAction(null);

    if (error) {
      setAuthError(error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  async function signUp({ email, password }: Credentials): Promise<SignUpResult> {
    setAuthError(null);

    if (!isSupabaseConfigured) {
      setAuthError(missingConfigMessage);
      return {
        success: false,
        error: missingConfigMessage,
        requiresEmailConfirmation: false,
      };
    }

    setAuthAction('signUp');

    const {
      data: { session: nextSession },
      error,
    } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setAuthAction(null);

    if (error) {
      setAuthError(error.message);
      return { success: false, error: error.message, requiresEmailConfirmation: false };
    }

    return {
      success: true,
      requiresEmailConfirmation: !nextSession,
    };
  }

  async function signOut(): Promise<SignOutResult> {
    setAuthError(null);
    setAuthAction('signOut');

    const { error } = await supabase.auth.signOut();

    setAuthAction(null);

    if (error) {
      setAuthError(error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      isAuthenticated: Boolean(session?.user),
      isBootstrapping,
      authError,
      isSigningIn: authAction === 'signIn',
      isSigningUp: authAction === 'signUp',
      isSigningOut: authAction === 'signOut',
      signIn,
      signUp,
      signOut,
      clearAuthError: () => setAuthError(null),
    }),
    [authAction, authError, isBootstrapping, session, user]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

/**
 * Reads the shared auth context.
 *
 * @returns current session, user, and auth actions
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
