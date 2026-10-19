'use client';

import * as React from 'react';

type MockUser = {
  email: string;
  name: string;
};

type AuthContextValue = {
  user: MockUser | null;
  isLoading: boolean;
  signIn: (email: string) => void;
  signUp: (email: string) => void;
  signOut: () => void;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'notelatte:user';

function nameFromEmail(email: string): string {
  const localPart = email.split('@')[0] || 'Friend';
  return localPart
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<MockUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MockUser;
        setUser(parsed);
      }
    } catch {
      // ignore malformed storage
    }
    setIsLoading(false);
  }, []);

  const persist = (next: MockUser | null) => {
    setUser(next);
    try {
      if (next) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  };

  const signIn = (email: string) => {
    persist({ email, name: nameFromEmail(email) });
  };

  const signUp = (email: string) => {
    persist({ email, name: nameFromEmail(email) });
  };

  const signOut = () => {
    persist(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
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
