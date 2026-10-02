'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

type Master = { id: string; name: string; isActive?: boolean };
type Totals = { totalPriceKzt: number; masterEarningKzt: number; salonRevenueKzt: number; appointmentsCount: number; compensationMissingCount: number };
type ByMasterRow = { masterId: string; masterName: string; appointmentsCount: number; totalPriceKzt: number; masterEarningKzt: number; salonRevenueKzt: number };
type ByDayRow = { date: string; appointmentsCount: number; totalPriceKzt: number; masterEarningKzt: number; salonRevenueKzt: number };
type Report = { totals: Totals; byMaster: ByMasterRow[]; byDay: ByDayRow[] };
type Preset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom';

const PAGE_SIZE = 30;
const BAR_COLOR = '#F4C842';
const LARGE_PAYOUT_THRESHOLD = 50000;

const pad2 = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fmtDateRu = (s: string) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}.${m}.${y}`; };
const fmtKzt = (n: number) => Number(n || 0).toLocaleString('ru-RU') + ' ₸';

function shiftDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return ymd(dt);
}

function downloadCsv(filename: string, rows: string[][]) {
  const escape = (v: string) => {
    const s = String(v ?? '');
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(escape).join(';')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadXls(filename: string, rows: string[][]) {
  const escape = (v: string) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = rows
    .map((r) => '<tr>' + r.map((c) => `<td>${escape(c)}</td>`).join('') + '</tr>')
    .join('');
  const html = `<html><head><meta charset="utf-8"></head><body><table border="1">${body}</table></body></html>`;
  const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function BarChart({ data }: { data: ByDayRow[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (!data.length) return null;
  const sliced = data.slice(0, 30).reverse();
  const max = Math.max(1, ...sliced.map((d) => d.salonRevenueKzt));
  const roundMax = Math.ceil(max / 10000) * 10000 || max;
  const w = 720, h = 200, padL = 60, padR = 12, padT = 12, padB = 28;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const barW = innerW / sliced.length;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[220px] w-full min-w-[500px]">
        {ticks.map((t) => {
          const y = padT + innerH * (1 - t);
          return (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#eee" strokeDasharray="3 4" />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#8b8781">
                {Math.round(roundMax * t).toLocaleString('ru-RU')}
              </text>
            </g>
          );
        })}
        {sliced.map((d, i) => {
          const barH = (d.salonRevenueKzt / roundMax) * innerH;
          const x = padL + i * barW + barW * 0.15;
          const bw = barW * 0.7;
          const y = padT + innerH - barH;
          return (
            <g key={d.date} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <rect x={x} y={y} width={bw} height={barH} fill={BAR_COLOR} opacity={hovered === i ? 1 : 0.85} rx={3} />
              <rect x={x} y={padT} width={bw} height={innerH} fill="transparent" />
              {hovered === i && (
                <g>
                  <rect x={x + bw / 2 - 55} y={Math.max(2, y - 34)} width={110} height={26} rx={6} fill="#171717" />
                  <text x={x + bw / 2} y={Math.max(2, y - 34) + 17} textAnchor="middle" fontSize="11" fill="#fff">
                    {fmtKzt(d.salonRevenueKzt)}
                  </text>
                </g>
              )}
              {i % Math.ceil(sliced.length / 8) === 0 && (
                <text x={x + bw / 2} y={h - 8} textAnchor="middle" fontSize="10" fill="#8b8781">
                  {d.date.slice(8)}.{d.date.slice(5, 7)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {data.length > 30 && (
        <p className="mt-2 text-center text-xs text-[#8b8781]">Показаны последние 30 дней из {data.length}</p>
      )}
    </div>
  );
}

export default function FinancePage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const router = useRouter();

  const todayStr = useMemo(() => ymd(new Date()), []);
  const [preset, setPreset] = useState<Preset>('today');
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [masterId, setMasterId] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [prevReport, setPrevReport] = useState<Report | null>(null);
  const [masters, setMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [showCompare, setShowCompare] = useState(false);

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
    if (p === 'today') { const s = ymd(now); setDateFrom(s); setDateTo(s); }
    else if (p === 'yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); const s = ymd(y); setDateFrom(s); setDateTo(s); }
    else if (p === '7d') { const s = new Date(now); s.setDate(s.getDate() - 6); setDateFrom(ymd(s)); setDateTo(ymd(now)); }
    else if (p === '30d') { const s = new Date(now); s.setDate(s.getDate() - 29); setDateFrom(ymd(s)); setDateTo(ymd(now)); }
    else if (p === 'month') { const s = new Date(now.getFullYear(), now.getMonth(), 1); setDateFrom(ymd(s)); setDateTo(ymd(now)); }
  }, []);

  const loadReport = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true); setError('');
    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'getFinancialReport');
      const res = await fn({ dateFrom, dateTo, ...(masterId ? { masterId } : {}) });
      setReport(res.data as Report);
      if (showCompare) {
        const days = Math.max(1, Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000) + 1);
        const prevFrom = shiftDays(dateFrom, -days);
        const prevTo = shiftDays(dateTo, -days);
        try {
          const res2 = await fn({ dateFrom: prevFrom, dateTo: prevTo, ...(masterId ? { masterId } : {}) });
          setPrevReport(res2.data as Report);
        } catch { setPrevReport(null); }
      } else setPrevReport(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить отчёт');
      setReport(null); setPrevReport(null);
    } finally { setLoading(false); }
  }, [user?.tenantId, dateFrom, dateTo, masterId, showCompare]);

  useEffect(() => { void loadReport(); }, [loadReport]);
  useEffect(() => { setPage(1); }, [dateFrom, dateTo, masterId]);

  if (!isOwner) {
    return (
      <div className="min-w-0">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-[#171717]">Нет доступа</h1>
          <p className="mt-1 text-sm text-[#8b8781]">Раздел «Финансы» доступен только владельцу салона.</p>
        </div>
      </div>
    );
  }

  const totals = report?.totals;
  const byMaster = report?.byMaster || [];
  const byDay = report?.byDay || [];
  const totalPages = Math.max(1, Math.ceil(byDay.length / PAGE_SIZE));
  const pagedDays = byDay.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const sumByDay = byDay.reduce((acc, r) => {
    acc.appointmentsCount += r.appointmentsCount; acc.totalPriceKzt += r.totalPriceKzt;
    acc.masterEarningKzt += r.masterEarningKzt; acc.salonRevenueKzt += r.salonRevenueKzt;
    return acc;
  }, { appointmentsCount: 0, totalPriceKzt: 0, masterEarningKzt: 0, salonRevenueKzt: 0 });

  const sumByMaster = byMaster.reduce((acc, r) => {
    acc.appointmentsCount += r.appointmentsCount; acc.totalPriceKzt += r.totalPriceKzt;
    acc.masterEarningKzt += r.masterEarningKzt; acc.salonRevenueKzt += r.salonRevenueKzt;
    return acc;
  }, { appointmentsCount: 0, totalPriceKzt: 0, masterEarningKzt: 0, salonRevenueKzt: 0 });

  const buildReportRows = (): string[][] => {
    const rows: string[][] = [];
    rows.push(['Отчёт за период', `${fmtDateRu(dateFrom)} — ${fmtDateRu(dateTo)}`]);
    rows.push([]);
    rows.push(['Сводка']);
    rows.push(['Показатель', 'Значение']);
    rows.push(['Выручка салона', String(totals?.salonRevenueKzt ?? 0)]);
    rows.push(['Выплаты мастерам', String(totals?.masterEarningKzt ?? 0)]);
    rows.push(['Общая сумма', String(totals?.totalPriceKzt ?? 0)]);
    rows.push(['Визитов', String(totals?.appointmentsCount ?? 0)]);
    rows.push([]);
    rows.push(['По дням']);
    rows.push(['Дата', 'Визитов', 'Общая', 'Мастеру', 'Салону']);
    byDay.forEach((r) => rows.push([fmtDateRu(r.date), String(r.appointmentsCount), String(r.totalPriceKzt), String(r.masterEarningKzt), String(r.salonRevenueKzt)]));
    rows.push(['ИТОГО', String(sumByDay.appointmentsCount), String(sumByDay.totalPriceKzt), String(sumByDay.masterEarningKzt), String(sumByDay.salonRevenueKzt)]);
    rows.push([]);
    rows.push(['По мастерам']);
    rows.push(['Мастер', 'Визитов', 'Общая', 'Мастеру', 'Салону']);
    byMaster.forEach((r) => rows.push([r.masterName, String(r.appointmentsCount), String(r.totalPriceKzt), String(r.masterEarningKzt), String(r.salonRevenueKzt)]));
    rows.push(['ИТОГО', String(sumByMaster.appointmentsCount), String(sumByMaster.totalPriceKzt), String(sumByMaster.masterEarningKzt), String(sumByMaster.salonRevenueKzt)]);

    return rows;
  };

  const buildFilename = (ext: string) =>
    `finance_${dateFrom}_${dateTo}${masterId ? '_' + (masters.find((m) => m.id === masterId)?.name || 'master') : ''}.${ext}`;

  const handleExportCsv = () => {
    if (!report) return;
    downloadCsv(buildFilename('csv'), buildReportRows());
  };

  const handleExportXls = () => {
    if (!report) return;
    downloadXls(buildFilename('xls'), buildReportRows());
  };

  const cmpDelta = (cur: number, prev: number): { label: string; cls: string } => {
    if (prev === 0 && cur === 0) return { label: '—', cls: 'text-[#8b8781]' };
    if (prev === 0) return { label: '+∞', cls: 'text-green-600' };
    const d = ((cur - prev) / Math.abs(prev)) * 100;
    const cls = d > 0 ? 'text-green-600' : d < 0 ? 'text-red-600' : 'text-[#8b8781]';
    return { label: (d > 0 ? '+' : '') + d.toFixed(1) + '%', cls };
  };

  return (
    <div className="min-w-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-block { display: block !important; }
          body { background: #fff !important; }
          .rounded-2xl, .shadow-sm { box-shadow: none !important; }
        }
      `}</style>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#aaa6a0]">Учёт и отчёты</div>
          <h1 className="text-[28px] font-semibold tracking-[-0.035em] text-[#171717]">Финансы</h1>
          <p className="mt-1 text-sm text-[#8b8781]">Выручка салона и выплаты мастерам за выбранный период</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!report || byDay.length === 0}
            className="h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-[#171717] transition hover:border-black disabled:opacity-40"
          >
            Скачать CSV
          </button>
          <button
            type="button"
            onClick={handleExportXls}
            disabled={!report || byDay.length === 0}
            className="h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-[#171717] transition hover:border-black disabled:opacity-40"
          >
            Для 1С (.xls)
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!report}
            className="h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-[#171717] transition hover:border-black disabled:opacity-40"
          >
            Печать
          </button>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 no-print">
        <div className="mb-4 flex flex-wrap items-center gap-2">
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
                (preset === p.key ? 'bg-black text-white' : 'border border-gray-200 bg-white text-[#77736d] hover:border-black hover:text-[#171717]')
              }
            >
              {p.label}
            </button>
          ))}
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-[#77736d]">
            <input type="checkbox" checked={showCompare} onChange={(e) => setShowCompare(e.target.checked)} className="h-4 w-4" />
            Сравнить с предыдущим
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#77736d]">С даты</span>
            <input type="date" value={dateFrom} max={dateTo || undefined}
              onChange={(e) => { setDateFrom(e.target.value); setPreset('custom'); }}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-[#171717] outline-none transition focus:border-black" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#77736d]">По дату</span>
            <input type="date" value={dateTo} min={dateFrom || undefined}
              onChange={(e) => { setDateTo(e.target.value); setPreset('custom'); }}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-[#171717] outline-none transition focus:border-black" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#77736d]">Мастер</span>
            <select value={masterId} onChange={(e) => setMasterId(e.target.value)}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-[#171717] outline-none transition focus:border-black">
              <option value="">Все мастера</option>
              {masters.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
            </select>
          </label>
          <div className="flex items-end">
            <button type="button" onClick={() => void loadReport()} disabled={loading}
              className="h-11 w-full rounded-xl bg-[#171717] text-sm font-medium text-white transition hover:bg-[#292929] disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? 'Загрузка…' : 'Показать'}
            </button>
          </div>
        </div>
      </div>

      {error && (<div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>)}

      {totals && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card label="Выручка салона" value={fmtKzt(totals.salonRevenueKzt)} delta={prevReport ? cmpDelta(totals.salonRevenueKzt, prevReport.totals.salonRevenueKzt) : undefined} />
          <Card label="Выплаты мастерам" value={fmtKzt(totals.masterEarningKzt)} delta={prevReport ? cmpDelta(totals.masterEarningKzt, prevReport.totals.masterEarningKzt) : undefined} />
          <Card label="Общая сумма" value={fmtKzt(totals.totalPriceKzt)} delta={prevReport ? cmpDelta(totals.totalPriceKzt, prevReport.totals.totalPriceKzt) : undefined} />
          <Card label="Визитов" value={String(totals.appointmentsCount)} delta={prevReport ? cmpDelta(totals.appointmentsCount, prevReport.totals.appointmentsCount) : undefined} />
        </div>
      )}

      {totals && totals.compensationMissingCount > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          У {totals.compensationMissingCount} визитов не настроена компенсация мастера — вся сумма ушла в салон. Настройте компенсацию в разделе «Мастера».
        </div>
      )}

      {totals && totals.masterEarningKzt >= LARGE_PAYOUT_THRESHOLD && (
        <div className="mb-5 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <b>Крупная выплата мастерам:</b> {fmtKzt(totals.masterEarningKzt)} за период. Проверьте корректность записей — порог {fmtKzt(LARGE_PAYOUT_THRESHOLD)}.
        </div>
      )}

      {byDay.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-base font-semibold text-[#171717]">Выручка салона по дням</h2>
          <BarChart data={byDay} />
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-3 text-base font-semibold text-[#171717]">По дням</h2>
        {byDay.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-[#8b8781] shadow-sm">За выбранный период записей нет.</div>
        ) : (
          <>
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
                  {pagedDays.map((row) => (
                    <tr
                      key={row.date}
                      className="cursor-pointer transition hover:bg-[#faf9f7]"
                      onClick={() => router.push(`/app/calendar?date=${row.date}`)}
                    >
                      <td className="px-4 py-3 font-medium text-[#171717]">{fmtDateRu(row.date)}</td>
                      <td className="px-4 py-3 text-right text-[#404040]">{row.appointmentsCount}</td>
                      <td className="px-4 py-3 text-right text-[#171717]">{fmtKzt(row.totalPriceKzt)}</td>
                      <td className="px-4 py-3 text-right text-[#404040]">{fmtKzt(row.masterEarningKzt)}</td>
                      <td className="px-4 py-3 text-right font-medium text-[#171717]">{fmtKzt(row.salonRevenueKzt)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 bg-[#faf9f7] text-sm font-semibold text-[#171717]">
                  <tr>
                    <td className="px-4 py-3">Итого</td>
                    <td className="px-4 py-3 text-right">{sumByDay.appointmentsCount}</td>
                    <td className="px-4 py-3 text-right">{fmtKzt(sumByDay.totalPriceKzt)}</td>
                    <td className="px-4 py-3 text-right">{fmtKzt(sumByDay.masterEarningKzt)}</td>
                    <td className="px-4 py-3 text-right">{fmtKzt(sumByDay.salonRevenueKzt)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="space-y-2 md:hidden">
              {pagedDays.map((row) => (
                <button
                  key={row.date}
                  type="button"
                  onClick={() => router.push(`/app/calendar?date=${row.date}`)}
                  className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-black"
                >
                  <div className="flex items-center justify-between">
                    <b className="text-sm text-[#171717]">{fmtDateRu(row.date)}</b>
                    <span className="text-xs text-[#8b8781]">{row.appointmentsCount} визитов</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm"><span className="text-[#8b8781]">Общая</span><span className="text-[#171717]">{fmtKzt(row.totalPriceKzt)}</span></div>
                  <div className="mt-1 flex items-center justify-between text-sm"><span className="text-[#8b8781]">Мастеру</span><span className="text-[#404040]">{fmtKzt(row.masterEarningKzt)}</span></div>
                  <div className="mt-1 flex items-center justify-between text-sm"><span className="text-[#8b8781]">Салону</span><b className="text-[#171717]">{fmtKzt(row.salonRevenueKzt)}</b></div>
                </button>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-center gap-2 no-print">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-[#171717] hover:border-black disabled:opacity-40">← Назад</button>
                <span className="text-sm text-[#8b8781]">Стр. {page} из {totalPages}</span>
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-[#171717] hover:border-black disabled:opacity-40">Вперёд →</button>
              </div>
            )}
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-[#171717]">По мастерам</h2>
        {byMaster.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-[#8b8781] shadow-sm">За выбранный период записей нет.</div>
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
                    <tr key={row.masterId} className="cursor-pointer transition hover:bg-[#faf9f7]"
                      onClick={() => setMasterId(row.masterId)}>
                      <td className="px-4 py-3 font-medium text-[#171717]">{row.masterName}</td>
                      <td className="px-4 py-3 text-right text-[#404040]">{row.appointmentsCount}</td>
                      <td className="px-4 py-3 text-right text-[#171717]">{fmtKzt(row.totalPriceKzt)}</td>
                      <td className="px-4 py-3 text-right font-medium text-[#171717]">{fmtKzt(row.masterEarningKzt)}</td>
                      <td className="px-4 py-3 text-right text-[#404040]">{fmtKzt(row.salonRevenueKzt)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 bg-[#faf9f7] text-sm font-semibold text-[#171717]">
                  <tr>
                    <td className="px-4 py-3">Итого</td>
                    <td className="px-4 py-3 text-right">{sumByMaster.appointmentsCount}</td>
                    <td className="px-4 py-3 text-right">{fmtKzt(sumByMaster.totalPriceKzt)}</td>
                    <td className="px-4 py-3 text-right">{fmtKzt(sumByMaster.masterEarningKzt)}</td>
                    <td className="px-4 py-3 text-right">{fmtKzt(sumByMaster.salonRevenueKzt)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="space-y-2 md:hidden">
              {byMaster.map((row) => (
                <button key={row.masterId} type="button" onClick={() => setMasterId(row.masterId)}
                  className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-black">
                  <div className="flex items-center justify-between">
                    <b className="text-sm text-[#171717]">{row.masterName}</b>
                    <span className="text-xs text-[#8b8781]">{row.appointmentsCount} визитов</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm"><span className="text-[#8b8781]">Общая</span><span className="text-[#171717]">{fmtKzt(row.totalPriceKzt)}</span></div>
                  <div className="mt-1 flex items-center justify-between text-sm"><span className="text-[#8b8781]">Заработал</span><b className="text-[#171717]">{fmtKzt(row.masterEarningKzt)}</b></div>
                  <div className="mt-1 flex items-center justify-between text-sm"><span className="text-[#8b8781]">Салону</span><span className="text-[#404040]">{fmtKzt(row.salonRevenueKzt)}</span></div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Card({ label, value, delta }: { label: string; value: string; delta?: { label: string; cls: string } }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-[#8b8781]">{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <div className="text-lg font-semibold text-[#171717]">{value}</div>
        {delta && <span className={`text-xs font-medium ${delta.cls}`}>{delta.label}</span>}
      </div>
    </div>
  );
}