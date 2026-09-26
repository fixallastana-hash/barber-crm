'use client';

export type Appointment = {
  id: string;
  masterId: string;
  masterName: string;
  clientId: string;
  clientName: string;
  clientPhone?: string;
  serviceNames: string[];
  date: string;
  startMinutes: number;
  endMinutes: number;
  totalPriceKzt: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'noshow';
};

export type Master = {
  id: string;
  name: string;
  isActive: boolean;
  color?: string;
};

type Props = {
  masters: Master[];
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  onEmptySlotClick: (masterId: string, startMinutes: number) => void;
};

const START_MINUTES = 480;
const END_MINUTES = 1320;
const SLOT_STEP = 30;
const ROW_HEIGHT = 60;
const GRID_HEIGHT = ((END_MINUTES - START_MINUTES) / SLOT_STEP) * ROW_HEIGHT;

const statusClasses: Record<Appointment['status'], string> = {
  pending: 'bg-yellow-100 border-yellow-400',
  confirmed: 'bg-blue-100 border-blue-400',
  completed: 'bg-green-100 border-green-400',
  cancelled: 'bg-gray-100 border-gray-400',
  noshow: 'bg-red-100 border-red-400',
};

function minutesToTime(minutes: number): string {
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}

export function CalendarGrid({ masters, appointments, onAppointmentClick, onEmptySlotClick }: Props) {
  const rows = Array.from({ length: (END_MINUTES - START_MINUTES) / SLOT_STEP }, (_, index) => START_MINUTES + index * SLOT_STEP);

  return (
    <div className="overflow-auto rounded-lg border border-gray-200 bg-white shadow">
      <div className="min-w-[900px]">
        <div className="sticky top-0 z-20 flex border-b border-gray-300 bg-white">
          <div className="w-20 shrink-0 border-r border-gray-200 p-3 text-xs font-medium text-gray-500">Время</div>
          {masters.map((master) => (
            <div key={master.id} className="flex min-w-[160px] flex-1 items-center gap-2 border-r border-gray-200 px-3 py-3 text-sm font-semibold">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: master.color || '#4A90D9' }} />
              <span className="truncate">{master.name}</span>
            </div>
          ))}
        </div>

        {masters.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">Нет активных мастеров.</p>
        ) : (
          <div className="flex">
            <div className="w-20 shrink-0">
              {rows.map((start) => (
                <div key={start} style={{ height: ROW_HEIGHT }} className="border-b border-r border-gray-200 px-2 pt-1 text-xs text-gray-500">
                  {minutesToTime(start)}
                </div>
              ))}
            </div>
            {masters.map((master) => {
              const masterAppointments = appointments.filter((appointment) => appointment.masterId === master.id);
              return (
                <div key={master.id} className="relative min-w-[160px] flex-1 border-r border-gray-200" style={{ height: GRID_HEIGHT }}>
                  {rows.map((start) => (
                    <button key={start} type="button" aria-label={master.name + ' ' + minutesToTime(start)}
                      onClick={() => onEmptySlotClick(master.id, start)}
                      className="absolute left-0 right-0 border-b border-gray-200 bg-white text-left hover:bg-gray-50"
                      style={{ top: ((start - START_MINUTES) / SLOT_STEP) * ROW_HEIGHT, height: ROW_HEIGHT }} />
                  ))}
                  {masterAppointments.map((appointment) => {
                    const visibleStart = Math.max(appointment.startMinutes, START_MINUTES);
                    const visibleEnd = Math.min(appointment.endMinutes, END_MINUTES);
                    if (visibleEnd <= visibleStart) return null;
                    const top = ((visibleStart - START_MINUTES) / SLOT_STEP) * ROW_HEIGHT;
                    const height = Math.max(ROW_HEIGHT, ((visibleEnd - visibleStart) / SLOT_STEP) * ROW_HEIGHT);
                    return (
                      <button key={appointment.id} type="button" onClick={() => onAppointmentClick(appointment)}
                        className={'absolute left-1 right-1 z-10 overflow-hidden rounded border p-1 text-left text-xs shadow-sm hover:brightness-95 ' + statusClasses[appointment.status]}
                        style={{ top, height }}>
                        <span className="block truncate font-semibold">{appointment.clientName}</span>
                        <span className="block truncate">{appointment.serviceNames.join(', ')}</span>
                        <span className="block truncate text-gray-600">
                          {minutesToTime(appointment.startMinutes)}–{minutesToTime(appointment.endMinutes)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
