import { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { clearLocalOfflineData } from '@/services/localData';

type AuthAction = 'signIn' | 'signUp' | 'signOut' | 'resetPassword' | null;
export type AccountType = 'coach' | 'player';

type Credentials = {
  email: string;
  password: string;
};

type SignUpCredentials = Credentials & {
  accountType: AccountType;
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

type PasswordResetResult = {
  success: boolean;
  error?: string;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  accountType: AccountType;
  isPlayerAccount: boolean;
  profileAccessRefreshKey: number;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  authError: string | null;
  isSigningIn: boolean;
  isSigningUp: boolean;
  isSigningOut: boolean;
  isRequestingPasswordReset: boolean;
  signIn: (credentials: Credentials) => Promise<SignInResult>;
  signUp: (credentials: SignUpCredentials) => Promise<SignUpResult>;
  signOut: () => Promise<SignOutResult>;
  requestPasswordReset: (email: string) => Promise<PasswordResetResult>;
  refreshProfileAccess: () => void;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const missingConfigMessage =
  'Supabase Auth is not configured yet. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to continue.';

function getAccountTypeFromUser(user: User | null): AccountType {
  return user?.user_metadata?.account_type === 'player' ? 'player' : 'coach';
}

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
  const [profileAccessRefreshKey, setProfileAccessRefreshKey] = useState(0);

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

  async function signUp({
    accountType,
    email,
    password,
  }: SignUpCredentials): Promise<SignUpResult> {
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
      options: {
        data: {
          account_type: accountType,
        },
      },
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

    if (error) {
      setAuthAction(null);
      setAuthError(error.message);
      return { success: false, error: error.message };
    }

    try {
      await clearLocalOfflineData();
    } catch (clearError) {
      const message =
        clearError instanceof Error
          ? `Signed out, but local offline data could not be cleared: ${clearError.message}`
          : 'Signed out, but local offline data could not be cleared.';

      setAuthAction(null);
      setAuthError(message);
      return { success: false, error: message };
    }

    setAuthAction(null);
    return { success: true };
  }

  async function requestPasswordReset(email: string): Promise<PasswordResetResult> {
    setAuthError(null);

    if (!isSupabaseConfigured) {
      setAuthError(missingConfigMessage);
      return { success: false, error: missingConfigMessage };
    }

    setAuthAction('signIn');

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

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
      accountType: getAccountTypeFromUser(user),
      isPlayerAccount: getAccountTypeFromUser(user) === 'player',
      profileAccessRefreshKey,
      isAuthenticated: Boolean(session?.user),
      isBootstrapping,
      authError,
      isSigningIn: authAction === 'signIn',
      isSigningUp: authAction === 'signUp',
      isSigningOut: authAction === 'signOut',
      isRequestingPasswordReset: authAction === 'resetPassword',
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      refreshProfileAccess: () => {
        setProfileAccessRefreshKey((value) => value + 1);
      },
      clearAuthError: () => setAuthError(null),
    }),
    [authAction, authError, isBootstrapping, profileAccessRefreshKey, session, user]
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
