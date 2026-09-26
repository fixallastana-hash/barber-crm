'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function AppPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center">Загрузка...</main>;
  }

  if (!user) return null;

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-4">Личный кабинет</h1>
        <p className="text-gray-700">Email: {user.email}</p>
        <p className="text-gray-700">Роль: {user.role}</p>
        <p className="text-gray-700">Tenant ID: {user.tenantId}</p>
        <p className="mt-6 text-sm text-gray-500">
          Это заглушка. Полноценный дашборд будет в следующих спринтах.
        </p>
      </div>
    </main>
  );
}
