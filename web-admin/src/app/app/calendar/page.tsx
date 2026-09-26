'use client';

import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { AddAppointmentModal } from '@/components/add-appointment-modal';
import { getFirebaseDb } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

type Appointment = {
  id: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  clientName: string;
  masterName: string;
  serviceNames: string[];
  totalPriceKzt: number;
  status: string;
};

function todayAsDateInput(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return String(hours).padStart(2, '0') + ':' + String(remainder).padStart(2, '0');
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(todayAsDateInput);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');

  const loadAppointments = useCallback(async () => {
    if (!user?.tenantId || !selectedDate) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const appointmentsQuery = query(
        collection(getFirebaseDb(), 'tenants', user.tenantId, 'appointments'),
        where('date', '==', selectedDate),
      );
      const snap = await getDocs(appointmentsQuery);
      const rows = snap.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<Appointment, 'id'>),
      }));
      rows.sort((a, b) => a.startMinutes - b.startMinutes);
      setAppointments(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить записи');
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, selectedDate]);

  useEffect(() => { void loadAppointments(); }, [loadAppointments]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Календарь</h1>
        <button type="button" onClick={() => setShowModal(true)}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          + Новая запись
        </button>
      </div>

      <label className="mb-6 block max-w-xs">
        <span className="mb-1 block text-sm text-gray-700">Дата</span>
        <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}
          className="w-full rounded border bg-white px-3 py-2" />
      </label>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? <p>Загрузка записей...</p> : appointments.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow">
          На этот день записей нет
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appointment) => (
            <article key={appointment.id} className="rounded-lg bg-white p-5 shadow">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {minutesToTime(appointment.startMinutes)} - {minutesToTime(appointment.endMinutes)}
                  </h2>
                  <p className="mt-1 text-gray-800">{appointment.clientName}</p>
                  <p className="text-sm text-gray-600">Мастер: {appointment.masterName}</p>
                  <p className="mt-2 text-sm text-gray-600">{appointment.serviceNames?.join(', ') || '—'}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{Number(appointment.totalPriceKzt || 0).toLocaleString('ru-RU')} ₸</p>
                  <p className="mt-1 text-sm text-gray-500">Статус: {appointment.status}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {user?.tenantId && (
        <AddAppointmentModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onCreated={() => { void loadAppointments(); }}
          tenantId={user.tenantId}
        />
      )}
    </div>
  );
}
