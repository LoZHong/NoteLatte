'use client';

import * as React from 'react';

import type { PublicUser } from '@/lib/types';

export type AuthUser = PublicUser;

export type AuthResult = { ok: true } | { ok: false; error: string };

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /** Re-reads /api/auth/me. Used when an API call reports a dead session. */
  refreshUser: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

/** Left over from the mock-auth prototype; cleared on boot so a stale blob can't
 *  make a signed-out browser look signed in. */
const LEGACY_STORAGE_KEY = 'notelatte:user';

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const refreshUser = React.useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        cache: 'no-store',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        setUser(null);
        return;
      }

      const data = (await response.json()) as { user: AuthUser | null };
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    try {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // storage unavailable (private mode) — nothing to clean up
    }

    (async () => {
      await refreshUser();
      if (!cancelled) setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  const signIn = React.useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'same-origin',
      });

      if (!response.ok) {
        return { ok: false, error: await readErrorMessage(response, 'Could not sign you in.') };
      }

      const data = (await response.json()) as { user: AuthUser };
      setUser(data.user);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error — please try again.' };
    }
  }, []);

  const signUp = React.useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'same-origin',
      });

      if (!response.ok) {
        return {
          ok: false,
          error: await readErrorMessage(response, 'Could not create your account.'),
        };
      }

      const data = (await response.json()) as { user: AuthUser };
      setUser(data.user);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error — please try again.' };
    }
  }, []);

  const signOut = React.useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      // Even if the request fails the local session is dropped below; the cookie
      // will expire on its own.
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
