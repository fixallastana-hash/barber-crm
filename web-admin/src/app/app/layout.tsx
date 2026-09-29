'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, authError, isTenantMissing, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && !isTenantMissing && !authError) {
      router.push('/login');
    }
  }, [user, loading, isTenantMissing, authError, router]);

  if (loading) {
    return <main className="page-loading">Загрузка...</main>;
  }

  if (authError) {
    return (
      <main className="page-loading">
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626' }}>
            Ошибка авторизации
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: '#737373' }}>
            {authError}
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            style={{
              marginTop: 20,
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid #e7e7e4',
              background: '#fff',
              fontSize: 12,
              color: '#404040',
              cursor: 'pointer',
            }}
          >
            Выйти из аккаунта
          </button>
        </div>
      </main>
    );
  }

  if (isTenantMissing) {
    return (
      <main className="page-loading">
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#171717' }}>
            Аккаунт не привязан к салону
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: '#737373' }}>
            Обратитесь к владельцу платформы, чтобы привязать аккаунт к салону.
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            style={{
              marginTop: 20,
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid #e7e7e4',
              background: '#fff',
              fontSize: 12,
              color: '#404040',
              cursor: 'pointer',
            }}
          >
            Выйти из аккаунта
          </button>
        </div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}