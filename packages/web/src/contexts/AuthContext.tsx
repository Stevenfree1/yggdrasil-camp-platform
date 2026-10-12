'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { trpc } from '@/lib/trpc';

export interface User {
  id: string;
  email: string;
  name: string;
  playaName?: string | null;
  role: 'LEAD' | 'MANAGER' | 'STAFF' | 'MEMBER';
  /** Per-area admin grants. Drives which admin sections are offered. */
  adminScopes: AdminScope[];
  emailVerified: boolean;
}

export type AdminScope = 'INVENTORY' | 'SHIFTS';

/** True when the user may reach the admin shell at all. */
export function hasAdminAccess(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'LEAD' || user.role === 'MANAGER' || user.adminScopes.length > 0;
}

/** Whether a user may reach an area, by role or by explicit grant. */
export function canAccessScope(user: User | null, scope: AdminScope): boolean {
  if (!user) return false;
  if (user.role === 'LEAD' || user.role === 'MANAGER') return true;
  return user.adminScopes.includes(scope);
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (inviteToken: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useContext();

  const profileQuery = trpc.auth.getProfile.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const loginMutation = trpc.auth.login.useMutation();
  const acceptInviteMutation = trpc.auth.acceptInvite.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();

  const user = useMemo<User | null>(() => {
    const p = profileQuery.data;
    if (!p) return null;
    return {
      id: p.id,
      email: p.email,
      name: p.name,
      playaName: p.playaName,
      role: p.role as User['role'],
      adminScopes: (p.adminScopes ?? []) as AdminScope[],
      emailVerified: p.emailVerified,
    };
  }, [profileQuery.data]);

  const isLoading =
    profileQuery.isLoading ||
    loginMutation.isLoading ||
    acceptInviteMutation.isLoading ||
    logoutMutation.isLoading;

  const error =
    loginMutation.error?.message ??
    acceptInviteMutation.error?.message ??
    null;

  const login = useCallback(
    async (email: string, password: string) => {
      await loginMutation.mutateAsync({ email, password });
      await utils.auth.getProfile.invalidate();
    },
    [loginMutation, utils.auth.getProfile],
  );

  const register = useCallback(
    async (inviteToken: string, password: string) => {
      await acceptInviteMutation.mutateAsync({ inviteToken, password });
      await utils.auth.getProfile.invalidate();
    },
    [acceptInviteMutation, utils.auth.getProfile],
  );

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      // Optimistically clear the cached profile so isAuthenticated flips to
      // false synchronously — prevents the /login page from bouncing the user
      // back to /portal on stale "still authenticated" state.
      utils.auth.getProfile.setData(undefined, null);
      await utils.invalidate();
    }
  }, [logoutMutation, utils]);

  const refreshSession = useCallback(async () => {
    const result = await profileQuery.refetch();
    return !!result.data;
  }, [profileQuery]);

  const clearError = useCallback(() => {
    loginMutation.reset();
    acceptInviteMutation.reset();
  }, [loginMutation, acceptInviteMutation]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        error,
        login,
        register,
        logout,
        clearError,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
