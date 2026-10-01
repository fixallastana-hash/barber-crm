'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

type Master = { id: string; name: string; isActive?: boolean };

type Totals = {
  totalPriceKzt: number;
  masterEarningKzt: number;
  salonRevenueKzt: number;
  appointmentsCount: number;
  compensationMissingCount: number;
};

type ByMasterRow = {
  masterId: string;
  masterName: string;
  appointmentsCount: number;
  totalPriceKzt: number;
  masterEarningKzt: number;
  salonRevenueKzt: number;
};

type ByDayRow = {
  date: string;
  appointmentsCount: number;
  totalPriceKzt: number;
  masterEarningKzt: number;
  salonRevenueKzt: number;
};

type Report = {
  totals: Totals;
  byMaster: ByMasterRow[];
  byDay: ByDayRow[];
};

type Preset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function fmtDateRu(ymdStr: string): string {
  if (!ymdStr) return '';
  const [y, m, d] = ymdStr.split('-');
  return `${d}.${m}.${y}`;
}
function fmtKzt(n: number): string {
  return Number(n || 0).toLocaleString('ru-RU') + ' ₸';
}

export default function FinancePage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const todayStr = useMemo(() => ymd(new Date()), []);
  const [preset, setPreset] = useState<Preset>('today');
  const [dateFrom, setDateFrom] = useState<string>(todayStr);
  const [dateTo, setDateTo] = useState<string>(todayStr);
  const [masterId, setMasterId] = useState<string>('');
  const [report, setReport] = useState<Report | null>(null);
  const [masters, setMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Загрузка мастеров для фильтра
  useEffect(() => {
    if (!user?.tenantId) return;
    const unsub = onSnapshot(
      collection(getFirebaseDb(), 'tenants', user.tenantId, 'masters'),
      (snap) => {
        setMasters(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Master, 'id'>) }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        );
      },
      () => setMasters([]),
    );
    return () => unsub();
  }, [user?.tenantId]);

  const applyPreset = useCallback((p: Preset) => {
    const now = new Date();
    setPreset(p);
    if (p === 'today') {
      const s = ymd(now);
      setDateFrom(s); setDateTo(s);
    } else if (p === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const s = ymd(y);
      setDateFrom(s); setDateTo(s);
    } else if (p === '7d') {
      const s = new Date(now); s.setDate(s.getDate() - 6);
      setDateFrom(ymd(s)); setDateTo(ymd(now));
    } else if (p === '30d') {
      const s = new Date(now); s.setDate(s.getDate() - 29);
      setDateFrom(ymd(s)); setDateTo(ymd(now));
    } else if (p === 'month') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateFrom(ymd(s)); setDateTo(ymd(now));
    }
  }, []);

  const loadReport = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    setError('');
    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'getFinancialReport');
      const res = await fn({
        dateFrom,
        dateTo,
        ...(masterId ? { masterId } : {}),
      });
      setReport(res.data as Report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить отчёт');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, dateFrom, dateTo, masterId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  if (!isOwner) {
    return (
      <div className="min-w-0">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-[#171717]">Нет доступа</h1>
          <p className="mt-1 text-sm text-[#8b8781]">
            Раздел «Финансы» доступен только владельцу салона.
          </p>
        </div>
      </div>
    );
  }

  const totals = report?.totals;
  const byMaster = report?.byMaster || [];
  const byDay = report?.byDay || [];

  return (
    <div className="min-w-0">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#aaa6a0]">
          Учёт и отчёты
        </div>
        <h1 className="text-[28px] font-semibold tracking-[-0.035em] text-[#171717]">
          Финансы
        </h1>
        <p className="mt-1 text-sm text-[#8b8781]">
          Выручка салона и выплаты мастерам за выбранный период
        </p>
      </div>

      {/* Фильтры */}
      <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {([
            { key: 'today', label: 'Сегодня' },
            { key: 'yesterday', label: 'Вчера' },
            { key: '7d', label: '7 дней' },
            { key: '30d', label: '30 дней' },
            { key: 'month', label: 'Этот месяц' },
          ] as const).map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              className={
                'h-9 rounded-full px-4 text-xs font-medium transition ' +
                (preset === p.key
                  ? 'bg-black text-white'
                  : 'border border-gray-200 bg-white text-[#77736d] hover:border-black hover:text-[#171717]')
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#77736d]">С даты</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => { setDateFrom(e.target.value); setPreset('custom'); }}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-[#171717] outline-none transition focus:border-black"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#77736d]">По дату</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => { setDateTo(e.target.value); setPreset('custom'); }}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-[#171717] outline-none transition focus:border-black"
            />
          </label>

          <label className="block md:col-span-1">
            <span className="mb-1.5 block text-xs font-medium text-[#77736d]">Мастер</span>
            <select
              value={masterId}
              onChange={(e) => setMasterId(e.target.value)}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-[#171717] outline-none transition focus:border-black"
            >
              <option value="">Все мастера</option>
              {masters.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void loadReport()}
              disabled={loading}
              className="h-11 w-full rounded-xl bg-[#171717] text-sm font-medium text-white transition hover:bg-[#292929] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Загрузка…' : 'Показать'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Сводка */}
      {totals && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card label="Выручка салона" value={fmtKzt(totals.salonRevenueKzt)} />
          <Card label="Выплаты мастерам" value={fmtKzt(totals.masterEarningKzt)} />
          <Card label="Общая сумма" value={fmtKzt(totals.totalPriceKzt)} />
          <Card label="Визитов" value={String(totals.appointmentsCount)} />
        </div>
      )}

      {totals && totals.compensationMissingCount > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          У {totals.compensationMissingCount} визитов не настроена компенсация мастера — вся сумма ушла в салон.
          Настройте компенсацию в разделе «Мастера».
        </div>
      )}

      {/* По дням */}
      <section className="mb-6">
        <h2 className="mb-3 text-base font-semibold text-[#171717]">По дням</h2>
        {byDay.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-[#8b8781] shadow-sm">
            За выбранный период записей нет.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
              <table className="w-full text-sm">
                <thead className="bg-[#faf9f7] text-xs uppercase tracking-wider text-[#8b8781]">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Дата</th>
                    <th className="px-4 py-3 text-right font-medium">Визитов</th>
                    <th className="px-4 py-3 text-right font-medium">Общая сумма</th>
                    <th className="px-4 py-3 text-right font-medium">Мастеру</th>
                    <th className="px-4 py-3 text-right font-medium">Салону</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {byDay.map((row) => (
                    <tr key={row.date}>
                      <td className="px-4 py-3 font-medium text-[#171717]">{fmtDateRu(row.date)}</td>
                      <td className="px-4 py-3 text-right text-[#404040]">{row.appointmentsCount}</td>
                      <td className="px-4 py-3 text-right text-[#171717]">{fmtKzt(row.totalPriceKzt)}</td>
                      <td className="px-4 py-3 text-right text-[#404040]">{fmtKzt(row.masterEarningKzt)}</td>
                      <td className="px-4 py-3 text-right font-medium text-[#171717]">{fmtKzt(row.salonRevenueKzt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {byDay.map((row) => (
                <div key={row.date} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <b className="text-sm text-[#171717]">{fmtDateRu(row.date)}</b>
                    <span className="text-xs text-[#8b8781]">{row.appointmentsCount} визитов</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-[#8b8781]">Общая</span>
                    <span className="text-[#171717]">{fmtKzt(row.totalPriceKzt)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-[#8b8781]">Мастеру</span>
                    <span className="text-[#404040]">{fmtKzt(row.masterEarningKzt)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-[#8b8781]">Салону</span>
                    <b className="text-[#171717]">{fmtKzt(row.salonRevenueKzt)}</b>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* По мастерам */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-[#171717]">По мастерам</h2>
        {byMaster.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-[#8b8781] shadow-sm">
            За выбранный период записей нет.
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
              <table className="w-full text-sm">
                <thead className="bg-[#faf9f7] text-xs uppercase tracking-wider text-[#8b8781]">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Мастер</th>
                    <th className="px-4 py-3 text-right font-medium">Визитов</th>
                    <th className="px-4 py-3 text-right font-medium">Общая сумма</th>
                    <th className="px-4 py-3 text-right font-medium">Заработал</th>
                    <th className="px-4 py-3 text-right font-medium">Салону</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {byMaster.map((row) => (
                    <tr key={row.masterId}>
                      <td className="px-4 py-3 font-medium text-[#171717]">{row.masterName}</td>
                      <td className="px-4 py-3 text-right text-[#404040]">{row.appointmentsCount}</td>
                      <td className="px-4 py-3 text-right text-[#171717]">{fmtKzt(row.totalPriceKzt)}</td>
                      <td className="px-4 py-3 text-right font-medium text-[#171717]">{fmtKzt(row.masterEarningKzt)}</td>
                      <td className="px-4 py-3 text-right text-[#404040]">{fmtKzt(row.salonRevenueKzt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 md:hidden">
              {byMaster.map((row) => (
                <div key={row.masterId} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <b className="text-sm text-[#171717]">{row.masterName}</b>
                    <span className="text-xs text-[#8b8781]">{row.appointmentsCount} визитов</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-[#8b8781]">Общая</span>
                    <span className="text-[#171717]">{fmtKzt(row.totalPriceKzt)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-[#8b8781]">Заработал</span>
                    <b className="text-[#171717]">{fmtKzt(row.masterEarningKzt)}</b>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-[#8b8781]">Салону</span>
                    <span className="text-[#404040]">{fmtKzt(row.salonRevenueKzt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-[#8b8781]">{label}</div>
      <div className="mt-1 text-lg font-semibold text-[#171717]">{value}</div>
    </div>
  );
}