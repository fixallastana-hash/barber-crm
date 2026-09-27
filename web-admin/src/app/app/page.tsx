'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function AppIndexPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) return;

    if (user.role === 'owner') {
      router.replace('/app/masters');
    } else {
      router.replace('/app/calendar');
    }
  }, [user, loading, router]);

  return <p>Загрузка...</p>;
}
