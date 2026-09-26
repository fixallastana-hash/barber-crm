'use client';

import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';
import type { Appointment } from '@/components/calendar-grid';

type Props = {
  appointment: Appointment | null;
  onClose: () => void;
  onUpdated: () => void;
};

type AppointmentStatus = Appointment['status'];

const statusLabels: Record<AppointmentStatus, string> = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждена',
  completed: 'Завершена',
  cancelled: 'Отменена',
  noshow: 'Клиент не пришёл',
};

function minutesToTime(minutes: number): string {
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}

export function AppointmentDetailModal({ appointment, onClose, onUpdated }: Props) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  if (!appointment) return null;

  const updateStatus = async (status: AppointmentStatus) => {
    setUpdating(true);
    setError('');
    try {
      const updateAppointmentStatus = httpsCallable(getFirebaseFunctions(), 'updateAppointmentStatus');
      await updateAppointmentStatus({ appointmentId: appointment.id, status });
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить запись');
    } finally {
      setUpdating(false);
    }
  };

  const actions: { label: string; status: AppointmentStatus; className: string }[] =
    appointment.status === 'confirmed'
      ? [
          { label: 'Завершить визит', status: 'completed', className: 'bg-green-600 hover:bg-green-700' },
          { label: 'Клиент не пришёл', status: 'noshow', className: 'bg-orange-600 hover:bg-orange-700' },
          { label: 'Отменить', status: 'cancelled', className: 'bg-red-600 hover:bg-red-700' },
        ]
      : appointment.status === 'pending'
        ? [
            { label: 'Подтвердить', status: 'confirmed', className: 'bg-blue-600 hover:bg-blue-700' },
            { label: 'Отменить', status: 'cancelled', className: 'bg-red-600 hover:bg-red-700' },
          ]
        : appointment.status === 'noshow'
          ? [{ label: 'Клиент пришёл (завершить)', status: 'completed', className: 'bg-green-600 hover:bg-green-700' }]
          : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="appointment-detail-title"
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="appointment-detail-title" className="text-xl font-bold">Запись</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть"
            className="rounded p-2 text-gray-500 hover:bg-gray-100">✕</button>
        </div>

        <div className="space-y-3 text-sm">
          <p><span className="text-gray-500">Время:</span> {minutesToTime(appointment.startMinutes)} – {minutesToTime(appointment.endMinutes)}</p>
          <p><span className="text-gray-500">Клиент:</span> {appointment.clientName}</p>
          {appointment.clientPhone && (
            <p className="flex items-center gap-3">
              <span>{appointment.clientPhone}</span>
              <a href={'tel:' + appointment.clientPhone} className="font-medium text-blue-600 hover:underline">Позвонить</a>
            </p>
          )}
          <p><span className="text-gray-500">Мастер:</span> {appointment.masterName}</p>
          <p><span className="text-gray-500">Услуги:</span> {appointment.serviceNames.join(', ')}</p>
          <p><span className="text-gray-500">Цена:</span> {Number(appointment.totalPriceKzt || 0).toLocaleString('ru-RU')} ₸</p>
          <p><span className="text-gray-500">Статус:</span> {statusLabels[appointment.status]}</p>
        </div>

        {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {actions.length === 0 && (
            <button type="button" onClick={onClose} className="rounded bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300">Закрыть</button>
          )}
          {appointment.status === 'noshow' && (
            <button type="button" onClick={onClose} className="rounded bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300">Закрыть</button>
          )}
          {actions.map((action) => (
            <button key={action.status} type="button" disabled={updating}
              onClick={() => void updateStatus(action.status)}
              className={'rounded px-4 py-2 text-sm text-white disabled:opacity-50 ' + action.className}>
              {updating ? 'Сохранение...' : action.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
