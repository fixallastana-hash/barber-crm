'use client';

import { Suspense, useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useSearchParams } from 'next/navigation';
import { getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

type Shift = { start: number; end: number; branchId: string };
type DaySchedule = { isWorking: boolean; shifts: Shift[] };
type Schedule = Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', DaySchedule>;
type Master = { name: string; whatsappNumber: string; type: string; primaryBranchId: string; schedule?: Schedule };
type Branch = { id: string; name: string; isActive: boolean };

const days: { key: keyof Schedule; label: string }[] = [
  { key: 'mon', label: 'Понедельник' }, { key: 'tue', label: 'Вторник' },
  { key: 'wed', label: 'Среда' }, { key: 'thu', label: 'Четверг' },
  { key: 'fri', label: 'Пятница' }, { key: 'sat', label: 'Суббота' },
  { key: 'sun', label: 'Воскресенье' },
];
const defaultSchedule: Schedule = {
  mon: { isWorking: false, shifts: [] }, tue: { isWorking: false, shifts: [] },
  wed: { isWorking: false, shifts: [] }, thu: { isWorking: false, shifts: [] },
  fri: { isWorking: false, shifts: [] }, sat: { isWorking: false, shifts: [] },
  sun: { isWorking: false, shifts: [] },
};
function minutesToTime(m: number): string {
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function ScheduleEditor() {
  const searchParams = useSearchParams();
  const masterId = searchParams.get('masterId');
  const { user } = useAuth();
  const [master, setMaster] = useState<Master | null>(null);
  const [schedule, setSchedule] = useState<Schedule>(defaultSchedule);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user?.tenantId || !masterId) { setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const db = getFirebaseDb();
        const [masterSnap, branchSnap] = await Promise.all([
          getDoc(doc(db, 'tenants', user.tenantId!, 'masters', masterId)),
          getDocs(collection(db, 'tenants', user.tenantId!, 'branches')),
        ]);
        if (cancelled) return;
        if (masterSnap.exists()) {
          const data = masterSnap.data() as Master;
          setMaster(data);
          setSchedule({ ...defaultSchedule, ...(data.schedule || {}) });
        } else {
          setMaster(null);
          setError('Мастер не найден');
        }
        setBranches(branchSnap.docs.map((item) => ({
          id: item.id, ...(item.data() as Omit<Branch, 'id'>),
        })).filter((branch) => branch.isActive));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить данные мастера');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [user?.tenantId, masterId]);

  const updateDay = (key: keyof Schedule, update: (day: DaySchedule) => DaySchedule) => {
    setSchedule((current) => ({ ...current, [key]: update(current[key]) }));
  };
  const handleSave = async () => {
    if (!masterId) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const updateMaster = httpsCallable(getFirebaseFunctions(), 'updateMaster');
      await updateMaster({ masterId, schedule });
      setMessage('Расписание сохранено');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить расписание');
    } finally { setSaving(false); }
  };

  if (loading) return <p>Загрузка...</p>;
  if (!masterId) return <p>В URL не указан masterId.</p>;
  if (!master) return <p>{error || 'Мастер не найден'}</p>;
  const primaryBranch = branches.find((branch) => branch.id === master.primaryBranchId);

  return (
    <div className="max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold">Расписание: {master.name}</h1>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p className="mb-4 rounded bg-blue-50 p-3 text-sm text-blue-700">{message}</p>}
      <section className="mb-6 grid gap-4 rounded-lg bg-white p-6 shadow sm:grid-cols-2">
        <p><span className="text-sm text-gray-500">Имя:</span> {master.name}</p>
        <p><span className="text-sm text-gray-500">Телефон:</span> {master.whatsappNumber}</p>
        <p><span className="text-sm text-gray-500">Тип:</span> {master.type === 'renter' ? 'Арендатор' : 'Сотрудник'}</p>
        <p><span className="text-sm text-gray-500">Основной филиал:</span> {primaryBranch?.name || master.primaryBranchId || '—'}</p>
      </section>
      <section className="space-y-4">
        {days.map(({ key, label }) => {
          const day = schedule[key];
          return (
            <div key={key} className="rounded-lg bg-white p-5 shadow">
              <label className="mb-4 flex items-center gap-3">
                <input type="checkbox" checked={day.isWorking}
                  onChange={(event) => updateDay(key, (current) => ({ ...current, isWorking: event.target.checked }))} />
                <span className="font-semibold">{label}</span><span className="text-sm text-gray-500">Работает</span>
              </label>
              {day.isWorking && <div className="space-y-3">
                {day.shifts.map((shift, index) => <div key={index} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_2fr_auto]">
                  <label className="block"><span className="text-xs text-gray-500">Начало</span>
                    <input type="time" value={minutesToTime(shift.start)}
                      onChange={(event) => updateDay(key, (current) => ({ ...current, shifts: current.shifts.map((item, i) => i === index ? { ...item, start: timeToMinutes(event.target.value) } : item) }))}
                      className="mt-1 w-full rounded border px-3 py-2" />
                  </label>
                  <label className="block"><span className="text-xs text-gray-500">Окончание</span>
                    <input type="time" value={minutesToTime(shift.end)}
                      onChange={(event) => updateDay(key, (current) => ({ ...current, shifts: current.shifts.map((item, i) => i === index ? { ...item, end: timeToMinutes(event.target.value) } : item) }))}
                      className="mt-1 w-full rounded border px-3 py-2" />
                  </label>
                  <label className="block"><span className="text-xs text-gray-500">Филиал</span>
                    <select value={shift.branchId}
                      onChange={(event) => updateDay(key, (current) => ({ ...current, shifts: current.shifts.map((item, i) => i === index ? { ...item, branchId: event.target.value } : item) }))}
                      className="mt-1 w-full rounded border px-3 py-2">
                      <option value="">Выберите филиал</option>
                      {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={() => updateDay(key, (current) => ({ ...current, shifts: current.shifts.filter((_, i) => i !== index) }))}
                    className="rounded px-3 py-2 text-sm text-red-600 hover:bg-red-50">Удалить смену</button>
                </div>)}
                <button type="button" onClick={() => updateDay(key, (current) => ({ ...current, shifts: [...current.shifts, { start: 600, end: 1200, branchId: '' }] }))}
                  className="text-sm font-medium text-blue-600 hover:underline">+ Добавить смену</button>
              </div>}
            </div>
          );
        })}
      </section>
      <button type="button" onClick={() => void handleSave()} disabled={saving}
        className="mt-6 rounded bg-blue-600 px-5 py-3 text-white hover:bg-blue-700 disabled:opacity-50">
        {saving ? 'Сохранение...' : 'Сохранить расписание'}
      </button>
    </div>
  );
}

export default function SchedulePage() {
  return <Suspense fallback={<p>Загрузка...</p>}><ScheduleEditor /></Suspense>;
}
