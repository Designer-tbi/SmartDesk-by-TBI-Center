/**
 * Global auth/company context.
 *
 * Provides `useAuth()` so any component can access (and mutate) the current
 * `user` and the company-related data without prop drilling.
 *
 * Backwards compatible — existing modules that still receive `user` as a
 * prop keep working. New code (and refactored modules) should consume the
 * context instead.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from './api';

export type AuthUser = {
  id: string;
  companyId: string | null;
  email: string;
  role: string;
  name: string;
  country?: string;
  state?: string | null;
  language?: string;
  currency?: string;
  companyType?: string | null;
  isDemo?: boolean;
  preferences?: any;
} | null;

export type CompanyInfo = {
  id?: string;
  name?: string;
  type?: string;
  country?: string;
  niu?: string | null;
  taxId?: string | null;
  address?: string | null;
  fiscalizationApiKey?: string | null;
  [key: string]: any;
} | null;

type AuthContextValue = {
  user: AuthUser;
  setUser: (u: AuthUser | ((prev: AuthUser) => AuthUser)) => void;
  company: CompanyInfo;
  refreshUser: () => Promise<void>;
  refreshCompany: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type ProviderProps = {
  user: AuthUser;
  setUser: (u: AuthUser | ((prev: AuthUser) => AuthUser)) => void;
  children: React.ReactNode;
};

export const AuthProvider = ({ user, setUser, children }: ProviderProps) => {
  const [company, setCompany] = useState<CompanyInfo>(null);

  const refreshCompany = useCallback(async () => {
    if (!user?.companyId) {
      setCompany(null);
      return;
    }
    try {
      const r = await apiFetch('/api/company');
      if (r.ok) {
        setCompany(await r.json());
      }
    } catch {
      /* non-fatal */
    }
  }, [user?.companyId]);

  const refreshUser = useCallback(async () => {
    try {
      const r = await apiFetch('/api/auth/me');
      if (r.ok) {
        setUser(await r.json());
      }
    } catch {
      /* non-fatal */
    }
  }, [setUser]);

  useEffect(() => {
    refreshCompany();
  }, [refreshCompany]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, setUser, company, refreshUser, refreshCompany }),
    [user, setUser, company, refreshUser, refreshCompany],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Read the auth context. Throws when used outside an AuthProvider so the
 * mistake is visible at dev time.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be used within <AuthProvider>');
  }
  return ctx;
}

/**
 * Soft variant — returns null if no provider is mounted (used for shared
 * components that may be rendered before the provider exists, e.g. login).
 */
export function useAuthOptional(): AuthContextValue | null {
  return useContext(AuthContext);
}
