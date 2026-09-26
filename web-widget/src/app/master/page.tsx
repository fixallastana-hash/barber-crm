'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';

type Appointment = {
  id: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  clientName: string;
  serviceNames: string[];
  status: string;
};

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
}

function formatDateRu(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return date.getDate() + ' ' + months[date.getMonth()] + ', ' + days[date.getDay()];
}

function MasterScheduleInner() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState('');
  const [masterName, setMasterName] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      localStorage.setItem('masterToken', urlToken);
      setToken(urlToken);
    } else {
      const savedToken = localStorage.getItem('masterToken');
      if (savedToken) setToken(savedToken);
    }
  }, [searchParams]);

  const loadSchedule = useCallback(async (masterToken: string) => {
    if (!masterToken) return;
    setLoading(true);
    setError('');
    try {
      const today = new Date();
      const dateFrom = today.toISOString().slice(0, 10);
      const future = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const dateTo = future.toISOString().slice(0, 10);
      const getMasterSchedule = httpsCallable(getFirebaseFunctions(), 'getMasterSchedule');
      const result = await getMasterSchedule({ token: masterToken, dateFrom, dateTo });
      const data = result.data as { masterName: string; appointments: Appointment[] };
      setMasterName(data.masterName);
      setAppointments(data.appointments);
    } catch (err) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : 'неизвестная ошибка'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) void loadSchedule(token);
  }, [token, loadSchedule]);

  const handleManualToken = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem('masterToken', token);
    void loadSchedule(token);
  };

  const grouped = appointments.reduce<Record<string, Appointment[]>>((result, appointment) => {
    if (!result[appointment.date]) result[appointment.date] = [];
    result[appointment.date].push(appointment);
    return result;
  }, {});

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <form onSubmit={handleManualToken} className="w-full max-w-md rounded-lg bg-white p-6 shadow">
          <h1 className="mb-4 text-center text-xl font-bold">Вход для мастера</h1>
          <p className="mb-4 text-center text-sm text-gray-600">
            Вставьте ссылку или токен, полученный от администратора
          </p>
          <input type="text" value={token} onChange={(event) => setToken(event.target.value)}
            placeholder="Токен" required className="mb-4 w-full rounded border px-3 py-2" />
          <button type="submit" className="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700">
            Войти
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto max-w-md">
        <h1 className="mb-1 text-xl font-bold">Календарь мастера</h1>
        {masterName && <p className="mb-4 text-gray-600">{masterName}</p>}

        <button type="button" onClick={() => void loadSchedule(token)} disabled={loading}
          className="mb-4 w-full rounded bg-blue-600 py-2 text-white disabled:opacity-50">
          {loading ? 'Загрузка...' : 'Обновить'}
        </button>

        {error && <p className="mb-4 text-red-600">{error}</p>}

        {Object.keys(grouped).length === 0 && !loading && (
          <div className="rounded-lg bg-white p-6 text-center text-gray-500 shadow">
            На ближайшие 7 дней записей нет
          </div>
        )}

        {Object.entries(grouped).map(([date, items]) => (
          <section key={date} className="mb-6">
            <h2 className="mb-2 text-sm font-medium text-gray-500">{formatDateRu(date)}</h2>
            <div className="space-y-2">
              {items.map((appointment) => (
                <article key={appointment.id} className="rounded-lg bg-white p-4 shadow">
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="font-medium">
                      {minutesToTime(appointment.startMinutes)} – {minutesToTime(appointment.endMinutes)}
                    </span>
                    <span className={'rounded px-2 py-0.5 text-xs ' +
                      (appointment.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                       appointment.status === 'completed' ? 'bg-green-100 text-green-700' :
                       appointment.status === 'noshow' ? 'bg-red-100 text-red-700' :
                       'bg-gray-100 text-gray-700')}>
                      {appointment.status === 'confirmed' ? 'подтверждена' :
                       appointment.status === 'completed' ? 'завершена' :
                       appointment.status === 'noshow' ? 'не пришёл' : appointment.status}
                    </span>
                  </div>
                  <p className="text-gray-900">{appointment.clientName}</p>
                  <p className="text-sm text-gray-500">{appointment.serviceNames.join(' + ')}</p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

export default function MasterPage() {
  return (
    <Suspense fallback={<div className="p-8">Загрузка...</div>}>
      <MasterScheduleInner />
    </Suspense>
  );
}
