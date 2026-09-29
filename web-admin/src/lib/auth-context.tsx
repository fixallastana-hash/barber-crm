'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
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
  authError: string | null;
  isTenantMissing: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  authError: null,
  isTenantMissing: false,
  signOut: async () => {},
});

type FbUserLike = {
  uid: string;
  email: string | null;
  getIdTokenResult: (forceRefresh?: boolean) => Promise<{
    claims: Record<string, unknown>;
  }>;
};

function readUserFromToken(fbUser: FbUserLike): Promise<AuthUser> {
  return fbUser.getIdTokenResult().then((tokenResult) => ({
    uid: fbUser.uid,
    email: fbUser.email,
    tenantId: (tokenResult.claims.tenantId as string) || null,
    role: (tokenResult.claims.role as UserRole) || null,
  }));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: () => void = () => {};

    try {
      const auth = getFirebaseAuth();

      unsubscribe = onIdTokenChanged(auth, async (fbUser) => {
        if (cancelled) return;

        try {
          if (!fbUser) {
            setUser(null);
            setAuthError(null);
            setLoading(false);
            return;
          }

          let parsed = await readUserFromToken(fbUser);

          // Если в токене нет tenantId — форсируем обновление один раз.
          // Это покрывает случай, когда claims появились только что
          // (например, через bootstrap-owner.js).
          if (!parsed.tenantId) {
            parsed = await readUserFromToken({
              uid: fbUser.uid,
              email: fbUser.email,
              getIdTokenResult: () => fbUser.getIdTokenResult(true),
            });
          }

          if (cancelled) return;

          setUser(parsed);
          setAuthError(null);
          setLoading(false);
        } catch (err) {
          if (cancelled) return;
          const message =
            err instanceof Error
              ? err.message
              : 'Не удалось получить данные аккаунта';
          setAuthError(message);
          setUser(null);
          setLoading(false);
        }
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Не удалось инициализировать Firebase';
      setAuthError(message);
      setUser(null);
      setLoading(false);
    }

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fbSignOut(getFirebaseAuth());
    } finally {
      setUser(null);
      setAuthError(null);
    }
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      authError,
      isTenantMissing: !loading && !!user && !user.tenantId,
      signOut,
    }),
    [user, loading, authError, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);