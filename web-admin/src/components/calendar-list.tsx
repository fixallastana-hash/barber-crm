'use client';

import { type Appointment, type Master } from './calendar-grid';

type Props = {
  masters: Master[];
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
};

const statusLabels: Record<Appointment['status'], string> = {
  pending: 'Ожидает',
  confirmed: 'Подтверждена',
  completed: 'Завершена',
  cancelled: 'Отменена',
  noshow: 'Не пришёл',
};

const statusClasses: Record<Appointment['status'], string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  noshow: 'bg-red-50 text-red-700 border-red-200',
};

function minutesToTime(minutes: number): string {
  return (
    String(Math.floor(minutes / 60)).padStart(2, '0') +
    ':' +
    String(minutes % 60).padStart(2, '0')
  );
}

export function CalendarList({
  masters,
  appointments,
  onAppointmentClick,
}: Props) {
  if (appointments.length === 0) {
    return (
      <div className="p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#f1f1ee] text-[#737373]">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4.5" width="18" height="16" rx="2" />
            <path d="M16 2.5v4M8 2.5v4M3 9h18" />
          </svg>
        </div>
        <p className="mt-4 text-sm font-medium text-[#404040]">
          На этот день записей нет
        </p>
        <p className="mt-1 text-sm text-[#9a9690]">
          Нажмите «Новая запись», чтобы добавить.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {appointments.map((appointment) => {
        const master = masters.find((m) => m.id === appointment.masterId);

        return (
          <button
            key={appointment.id}
            type="button"
            onClick={() => onAppointmentClick(appointment)}
            className="flex w-full gap-3 p-3 text-left transition hover:bg-gray-50 active:bg-gray-100"
          >
            <div className="shrink-0 pt-0.5">
              <div className="text-sm font-semibold text-[#171717]">
                {minutesToTime(appointment.startMinutes)}
              </div>
              <div className="text-[11px] text-gray-500">
                {minutesToTime(appointment.endMinutes)}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold text-[#171717]">
                  {appointment.clientName}
                </span>
                <span
                  className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    statusClasses[appointment.status]
                  }`}
                >
                  {statusLabels[appointment.status]}
                </span>
              </div>

              <p className="mt-1 truncate text-xs text-gray-600">
                {appointment.serviceNames.join(', ')}
              </p>

              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
                {master?.color && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: master.color }}
                  />
                )}
                <span className="truncate">
                  {appointment.masterName || master?.name || '—'}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
