'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.push('/app');
    } else {
      router.push('/login');
    }
  }, [user, loading, router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      Загрузка...
    </main>
  );
}
