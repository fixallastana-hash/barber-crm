'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

type Stats = {
  mastersActive: number;
  mastersTotal: number;
  appointmentsToday: number;
  revenueTodayKzt: number;
  revenueMonthKzt: number;
  clientsTotal: number;
};

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function todayKey(): string {
  const now = new Date();
  return now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
}

function monthPrefix(): string {
  const now = new Date();
  return now.getFullYear() + '-' + pad2(now.getMonth() + 1);
}

function formatKzt(value: number): string {
  return value.toLocaleString('ru-RU') + ' ₸';
}

export default function AppIndexPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (user.role !== 'owner') {
      router.replace('/app/calendar');
    }
  }, [user, loading, router]);

  const loadStats = useCallback(async () => {
    if (!user?.tenantId) return;
    if (user.role !== 'owner') return;

    setStatsLoading(true);
    setError('');
    try {
      const db = getFirebaseDb();
      const [mastersSnap, clientsSnap, apptsSnap] = await Promise.all([
        getDocs(collection(db, 'tenants', user.tenantId, 'masters')),
        getDocs(collection(db, 'tenants', user.tenantId, 'clients')),
        getDocs(collection(db, 'tenants', user.tenantId, 'appointments')),
      ]);

      const mastersTotal = mastersSnap.size;
      let mastersActive = 0;
      mastersSnap.forEach((d) => {
        if (d.data().isActive === true) mastersActive += 1;
      });

      const clientsTotal = clientsSnap.size;

      const todayStr = todayKey();
      const monthPfx = monthPrefix();

      let appointmentsToday = 0;
      let revenueTodayKzt = 0;
      let revenueMonthKzt = 0;

      apptsSnap.forEach((d) => {
        const a = d.data();
        const date = typeof a.date === 'string' ? a.date : '';
        const status = a.status;
        const price = typeof a.totalPriceKzt === 'number' ? a.totalPriceKzt : 0;

        if (date === todayStr) appointmentsToday += 1;

        if (status === 'completed' && price > 0) {
          if (date === todayStr) revenueTodayKzt += price;
          if (date.length >= 7 && date.slice(0, 7) === monthPfx) revenueMonthKzt += price;
        }
      });

      setStats({
        mastersActive,
        mastersTotal,
        appointmentsToday,
        revenueTodayKzt,
        revenueMonthKzt,
        clientsTotal,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить статистику');
    } finally {
      setStatsLoading(false);
    }
  }, [user?.tenantId, user?.role]);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (user.role !== 'owner') return;
    void loadStats();
  }, [loading, user, loadStats]);

  if (loading) return <p>Загрузка...</p>;
  if (!user) return <p>Загрузка...</p>;
  if (user.role !== 'owner') return <p>Переход в календарь...</p>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Дашборд</h1>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {statsLoading || !stats ? (
        <p>Загрузка...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Мастера"
            value={String(stats.mastersActive)}
            hint={'всего: ' + stats.mastersTotal}
          />
          <StatCard
            title="Клиенты"
            value={String(stats.clientsTotal)}
            hint="в базе"
          />
          <StatCard
            title="Записи сегодня"
            value={String(stats.appointmentsToday)}
            hint="все статусы"
          />
          <StatCard
            title="Выручка сегодня"
            value={formatKzt(stats.revenueTodayKzt)}
            hint="по завершённым"
          />
          <StatCard
            title="Выручка за месяц"
            value={formatKzt(stats.revenueMonthKzt)}
            hint="по завершённым"
          />
        </div>
      )}
    </div>
  );
}

function StatCard(props: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <p className="text-sm text-gray-500">{props.title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{props.value}</p>
      {props.hint && <p className="mt-1 text-xs text-gray-400">{props.hint}</p>}
    </div>
  );
}
