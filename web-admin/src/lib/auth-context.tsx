'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onIdTokenChanged, signOut as fbSignOut } from 'firebase/auth';
import { getFirebaseAuth } from './firebase';

export type UserRole = 'owner' | 'admin' | null;

export type AuthUser = {
  uid: string;
  email: string | null;
  tenantId: string | null;
  role: UserRole;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onIdTokenChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      const tokenResult = await fbUser.getIdTokenResult();
      setUser({
        uid: fbUser.uid,
        email: fbUser.email,
        tenantId: (tokenResult.claims.tenantId as string) || null,
        role: (tokenResult.claims.role as UserRole) || null,
      });
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    await fbSignOut(getFirebaseAuth());
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
