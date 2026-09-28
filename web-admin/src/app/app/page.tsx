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
  return (
    now.getFullYear() +
    '-' +
    pad2(now.getMonth() + 1) +
    '-' +
    pad2(now.getDate())
  );
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
        getDocs(
          collection(
            db,
            'tenants',
            user.tenantId,
            'masters',
          ),
        ),
        getDocs(
          collection(
            db,
            'tenants',
            user.tenantId,
            'clients',
          ),
        ),
        getDocs(
          collection(
            db,
            'tenants',
            user.tenantId,
            'appointments',
          ),
        ),
      ]);

      const mastersTotal = mastersSnap.size;

      let mastersActive = 0;

      mastersSnap.forEach((d) => {
        if (d.data().isActive === true) {
          mastersActive += 1;
        }
      });

      const clientsTotal = clientsSnap.size;

      const todayStr = todayKey();
      const monthPfx = monthPrefix();

      let appointmentsToday = 0;
      let revenueTodayKzt = 0;
      let revenueMonthKzt = 0;

      apptsSnap.forEach((d) => {
        const a = d.data();

        const date =
          typeof a.date === 'string'
            ? a.date
            : '';

        const status = a.status;

        const price =
          typeof a.totalPriceKzt === 'number'
            ? a.totalPriceKzt
            : 0;

        if (date === todayStr) {
          appointmentsToday += 1;
        }

        if (status === 'completed' && price > 0) {
          if (date === todayStr) {
            revenueTodayKzt += price;
          }

          if (
            date.length >= 7 &&
            date.slice(0, 7) === monthPfx
          ) {
            revenueMonthKzt += price;
          }
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
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось загрузить статистику',
      );
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] p-6">
        <div className="mx-auto max-w-7xl">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-200" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (user.role !== 'owner') {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
              Barber CRM
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-gray-950">
              Главная
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Обзор вашего бизнеса
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadStats()}
            disabled={statsLoading}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {statsLoading ? 'Обновление...' : 'Обновить'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {statsLoading || !stats ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Main stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

              <StatCard
                label="Мастера"
                value={String(stats.mastersActive)}
                hint={`из ${stats.mastersTotal}`}
                description="Активные мастера"
              />

              <StatCard
                label="Клиенты"
                value={String(stats.clientsTotal)}
                hint="в базе"
                description="Всего клиентов"
              />

              <StatCard
                label="Записи сегодня"
                value={String(stats.appointmentsToday)}
                hint="все статусы"
                description="Запланировано на сегодня"
              />

              <StatCard
                label="Выручка сегодня"
                value={formatKzt(stats.revenueTodayKzt)}
                hint="завершённые"
                description="За сегодняшний день"
              />
            </div>

            {/* Revenue */}
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] lg:col-span-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Выручка за месяц
                    </p>

                    <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-950">
                      {formatKzt(stats.revenueMonthKzt)}
                    </p>

                    <p className="mt-2 text-sm text-gray-400">
                      По завершённым записям
                    </p>
                  </div>

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-950 text-sm font-semibold text-white">
                    ₸
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <p className="text-sm font-medium text-gray-500">
                  Сегодня
                </p>

                <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-950">
                  {stats.appointmentsToday}
                </p>

                <p className="mt-2 text-sm text-gray-400">
                  записей в календаре
                </p>

                <button
                  type="button"
                  onClick={() => router.push('/app/calendar')}
                  className="mt-5 text-sm font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 transition hover:decoration-gray-900"
                >
                  Открыть календарь
                </button>
              </div>
            </div>

            {/* Quick navigation */}
            <div className="mt-8">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-950">
                  Быстрый доступ
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Основные разделы управления салоном
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <QuickLink
                  title="Календарь"
                  description="Записи"
                  onClick={() => router.push('/app/calendar')}
                />

                <QuickLink
                  title="Мастера"
                  description="Команда"
                  onClick={() => router.push('/app/masters')}
                />

                <QuickLink
                  title="Клиенты"
                  description="База"
                  onClick={() => router.push('/app/clients')}
                />

                <QuickLink
                  title="Услуги"
                  description="Прайс"
                  onClick={() => router.push('/app/services')}
                />

                <QuickLink
                  title="Филиалы"
                  description="Салоны"
                  onClick={() => router.push('/app/branches')}
                />

                <QuickLink
                  title="Настройки"
                  description="Салон"
                  onClick={() => router.push('/app/settings')}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard(props: {
  label: string;
  value: string;
  hint: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">
            {props.label}
          </p>

          <p className="mt-3 truncate text-2xl font-semibold tracking-tight text-gray-950">
            {props.value}
          </p>
        </div>

        <span className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
          {props.hint}
        </span>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        {props.description}
      </p>
    </div>
  );
}

function QuickLink(props: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="group rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-sm"
    >
      <div className="mb-6 flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-xs font-semibold text-gray-600 transition group-hover:bg-gray-950 group-hover:text-white">
        →
      </div>

      <p className="text-sm font-semibold text-gray-900">
        {props.title}
      </p>

      <p className="mt-1 text-xs text-gray-400">
        {props.description}
      </p>
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-36 animate-pulse rounded-2xl border border-gray-200 bg-white"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-40 animate-pulse rounded-2xl border border-gray-200 bg-white lg:col-span-2" />
        <div className="h-40 animate-pulse rounded-2xl border border-gray-200 bg-white" />
      </div>
    </div>
  );
            }
