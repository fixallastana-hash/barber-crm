'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { AddAppointmentModal } from '@/components/add-appointment-modal';
import { AppointmentDetailModal } from '@/components/appointment-detail-modal';
import { CalendarGrid, type Appointment, type Master } from '@/components/calendar-grid';
import { getFirebaseDb } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

function todayAsDateInput(): string {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(todayAsDateInput);
  const [masters, setMasters] = useState<Master[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [initialMasterId, setInitialMasterId] = useState<string | undefined>();
  const [initialDate, setInitialDate] = useState<string | undefined>();
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }
    const db = getFirebaseDb();

    const unsubMasters = onSnapshot(
      collection(db, 'tenants', user.tenantId, 'masters'),
      (snap) => {
        setMasters(snap.docs
          .map((item) => ({ id: item.id, ...(item.data() as Omit<Master, 'id'>) }))
          .filter((master) => master.isActive));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubMasters();
  }, [user?.tenantId]);

  useEffect(() => {
    if (!user?.tenantId || !selectedDate) {
      return;
    }
    const db = getFirebaseDb();

    const unsubAppointments = onSnapshot(
      query(
        collection(db, 'tenants', user.tenantId, 'appointments'),
        where('date', '==', selectedDate),
      ),
      (snap) => {
        const rows = snap.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<Appointment, 'id'>),
        }));
        rows.sort((a, b) => a.startMinutes - b.startMinutes);
        setAppointments(rows);
      },
      (err) => setError(err.message),
    );

    return () => unsubAppointments();
  }, [user?.tenantId, selectedDate]);

  const openCreateModal = (masterId?: string, date?: string) => {
    setInitialMasterId(masterId);
    setInitialDate(date);
    setShowCreateModal(true);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Календарь</h1>
        <button type="button" onClick={() => openCreateModal()}
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
      {loading ? <p>Загрузка календаря...</p> : (
        <CalendarGrid
          masters={masters}
          appointments={appointments}
          onAppointmentClick={setSelectedAppointment}
          onEmptySlotClick={(masterId) => openCreateModal(masterId, selectedDate)}
        />
      )}

      {user?.tenantId && (
        <AddAppointmentModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); }}
          tenantId={user.tenantId}
          initialMasterId={initialMasterId}
          initialDate={initialDate}
        />
      )}
      <AppointmentDetailModal
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        onUpdated={() => { setSelectedAppointment(null); }}
      />
    </div>
  );
}
