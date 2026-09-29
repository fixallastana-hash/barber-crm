'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { AddAppointmentModal } from '@/components/add-appointment-modal';
import { AppointmentDetailModal } from '@/components/appointment-detail-modal';
import {
  CalendarGrid,
  type Appointment,
  type Master,
} from '@/components/calendar-grid';
import { CalendarList } from '@/components/calendar-list';
import { getFirebaseDb } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

function todayAsDateInput(): string {
  const now = new Date();

  return (
    now.getFullYear() +
    '-' +
    String(now.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(now.getDate()).padStart(2, '0')
  );
}

function formatDate(value: string): string {
  if (!value) return '';

  const date = new Date(`${value}T00:00:00`);

  return date.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
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
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);

  useEffect(() => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }

    const db = getFirebaseDb();

    const unsubMasters = onSnapshot(
      collection(db, 'tenants', user.tenantId, 'masters'),
      (snap) => {
        setMasters(
          snap.docs
            .map((item) => ({
              id: item.id,
              ...(item.data() as Omit<Master, 'id'>),
            }))
            .filter((master) => master.isActive),
        );

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

  const goToday = () => {
    setSelectedDate(todayAsDateInput());
  };

  return (
    <div className="min-w-0">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#aaa6a0]">
            Расписание
          </div>

          <h1 className="text-[28px] font-semibold tracking-[-0.035em] text-[#171717]">
            Календарь
          </h1>

          <p className="mt-1 text-sm text-[#8b8781]">
            {formatDate(selectedDate)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => openCreateModal()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#171717] px-5 text-sm font-medium text-white shadow-sm transition hover:bg-[#292929] active:scale-[0.99]"
        >
          <span className="text-lg leading-none">+</span>
          Новая запись
        </button>
      </div>

      {/* Controls */}
      <div className="mb-5 rounded-2xl border border-[#e8e6e2] bg-white p-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToday}
              className="h-10 rounded-xl border border-[#e5e2de] bg-[#faf9f7] px-4 text-sm font-medium text-[#494641] transition hover:bg-[#f2f0ed]"
            >
              Сегодня
            </button>

            <div className="hidden h-6 w-px bg-[#e7e4df] sm:block" />

            <div className="text-sm text-[#77736d]">
              {appointments.length === 0
                ? 'Нет записей'
                : `${appointments.length} ${
                    appointments.length === 1
                      ? 'запись'
                      : appointments.length < 5
                        ? 'записи'
                        : 'записей'
                  }`}
            </div>
          </div>

          <label className="flex min-w-0 items-center gap-3">
            <span className="hidden text-xs font-medium text-[#99958f] sm:block">
              Дата
            </span>

            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-10 w-full min-w-0 rounded-xl border border-[#e5e2de] bg-[#faf9f7] px-3 text-sm text-[#292725] outline-none transition focus:border-[#b8b3ac] focus:bg-white sm:w-[170px]"
            />
          </label>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Calendar — сетка на десктопе, список на мобильном */}
      <div className="min-w-0 overflow-hidden rounded-2xl border border-[#e8e6e2] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center">
            <div className="text-sm text-[#99958f]">
              Загрузка календаря...
            </div>
          </div>
        ) : (
          <>
            {/* Desktop / tablet — сетка со скроллом */}
            <div className="hidden overflow-x-auto md:block">
              <CalendarGrid
                masters={masters}
                appointments={appointments}
                onAppointmentClick={setSelectedAppointment}
                onEmptySlotClick={(masterId) =>
                  openCreateModal(masterId, selectedDate)
                }
              />
            </div>

            {/* Mobile — вертикальный список */}
            <div className="md:hidden">
              <CalendarList
                masters={masters}
                appointments={appointments}
                onAppointmentClick={setSelectedAppointment}
              />
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {user?.tenantId && (
        <AddAppointmentModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
          }}
          tenantId={user.tenantId}
          initialMasterId={initialMasterId}
          initialDate={initialDate}
        />
      )}

      <AppointmentDetailModal
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        onUpdated={() => {
          setSelectedAppointment(null);
        }}
      />
    </div>
  );
}
