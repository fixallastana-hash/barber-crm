'use client';

import { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';

type Client = { id: string; name: string; phoneNormalized?: string; isBlocked?: boolean };
type Service = { id: string; name: string; durationMinutes: number; priceKzt: number; isActive: boolean; bufferMinutes?: number };
type Master = { id: string; name: string; isActive: boolean; serviceIds?: string[] };
type Slot = { start: number; end: number; branchId: string; time?: string };

type Mode = 'same-master' | 'smart';

type Person = {
  clientName: string;
  masterId: string;
  serviceIds: string[];
};

const MAX_PEOPLE = 6;
const MIN_PEOPLE = 2;

type Props = {
  tenantId: string;
  clients: Client[];
  services: Service[];
  masters: Master[];
  initialDate?: string;
  onCreated: () => void;
  onClose: () => void;
};

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function AddGroupAppointmentForm({
  tenantId,
  clients,
  services,
  masters,
  initialDate,
  onCreated,
  onClose,
}: Props) {
  const [clientId, setClientId] = useState('');
  const [mode, setMode] = useState<Mode>('same-master');
  const [groupMasterId, setGroupMasterId] = useState('');
  const [people, setPeople] = useState<Person[]>(() => [
    { clientName: '', masterId: '', serviceIds: [] },
    { clientName: '', masterId: '', serviceIds: [] },
  ]);
  const [date, setDate] = useState(initialDate || '');
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  const updatePerson = (idx: number, patch: Partial<Person>) => {
    setPeople((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const addPerson = () => {
    if (people.length >= MAX_PEOPLE) return;
    setPeople((prev) => [...prev, { clientName: '', masterId: '', serviceIds: [] }]);
  };

  const removePerson = (idx: number) => {
    if (people.length <= MIN_PEOPLE) return;
    setPeople((prev) => prev.filter((_, i) => i !== idx));
  };

  const togglePersonService = (idx: number, serviceId: string) => {
    setPeople((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        const has = p.serviceIds.includes(serviceId);
        return {
          ...p,
          serviceIds: has ? p.serviceIds.filter((x) => x !== serviceId) : [...p.serviceIds, serviceId],
        };
      })
    );
  };

  const sameMasterCandidates = useMemo(() => {
    if (mode !== 'same-master') return [];
    return masters.filter((m) => {
      for (const p of people) {
        for (const sid of p.serviceIds) {
          if (!m.serviceIds?.includes(sid)) return false;
        }
      }
      return true;
    });
  }, [mode, masters, people]);

  const uniqueMasters = useMemo(() => {
    if (mode === 'same-master') return groupMasterId ? [groupMasterId] : [];
    const set = new Set<string>();
    for (const p of people) if (p.masterId) set.add(p.masterId);
    return [...set];
  }, [mode, groupMasterId, people]);

  const isFormValid = useMemo(() => {
    if (!clientId) return false;
    if (mode === 'same-master' && !groupMasterId) return false;
    for (const p of people) {
      if (!p.clientName.trim()) return false;
      if (!p.serviceIds.length) return false;
      if (mode === 'smart' && !p.masterId) return false;
    }
    return true;
  }, [clientId, mode, groupMasterId, people]);

  const groupTotalPrice = useMemo(() => {
    let sum = 0;
    for (const p of people)
      for (const sid of p.serviceIds) {
        const s = services.find((x) => x.id === sid);
        if (s) sum += s.priceKzt;
      }
    return sum;
  }, [people, services]);

  const groupTotalDuration = useMemo(() => {
    let sum = 0;
    for (const p of people)
      for (const sid of p.serviceIds) {
        const s = services.find((x) => x.id === sid);
        if (s) sum += s.durationMinutes + (s.bufferMinutes || 0);
      }
    return sum;
  }, [people, services]);

  const loadSlots = async () => {
    if (!date || !isFormValid || !uniqueMasters.length) {
      setAvailableSlots([]);
      return;
    }

    setLoadingSlots(true);
    setAvailableSlots([]);
    setError('');

    try {
      const getAvailableSlots = httpsCallable(getFirebaseFunctions(), 'getAvailableSlots');

      const results = await Promise.all(
        uniqueMasters.map(async (mId) => {
          let duration = 0;
          for (const p of people) {
            const pid = mode === 'same-master' ? groupMasterId : p.masterId;
            if (pid !== mId) continue;
            for (const sid of p.serviceIds) {
              const s = services.find((x) => x.id === sid);
              if (s) duration += s.durationMinutes + (s.bufferMinutes || 0);
            }
          }
          if (!duration) return { masterId: mId, slots: [] as Slot[] };
          try {
            const res = await getAvailableSlots({ masterId: mId, date, durationMinutes: duration });
            return { masterId: mId, slots: ((res.data as { slots?: Slot[] }).slots) || [] };
          } catch {
            return { masterId: mId, slots: [] as Slot[] };
          }
        })
      );

      const sets = results.map((r) => new Set(r.slots.map((s) => s.start)));
      const commonStarts = sets.length ? [...sets[0]].filter((s) => sets.every((x) => x.has(s))) : [];

      const allByStart = new Map<number, Slot>();
      for (const r of results) for (const s of r.slots) allByStart.set(s.start, s);

      const commonSlots = commonStarts
        .sort((a, b) => a - b)
        .map((s) => allByStart.get(s))
        .filter((s): s is Slot => !!s);

      setAvailableSlots(commonSlots);
    } catch {
      setAvailableSlots([]);
      setError('Не удалось загрузить свободное время');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSelectSlot = async (slot: Slot) => {
    if (!clientId) return;
    setSaving(true);
    setError('');
    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'createGroupAppointment');
      await fn({
        clientId,
        date,
        startMinutes: slot.start,
        mode,
        ...(mode === 'same-master' ? { masterId: groupMasterId } : {}),
        people: people.map((p) => ({
          clientName: p.clientName.trim(),
          serviceIds: p.serviceIds,
          ...(mode === 'smart' ? { masterId: p.masterId } : {}),
        })),
        source: 'admin',
      });
      onCreated();
      onClose();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      const code = (e.code || '').replace(/^functions\//, '');
      if (code === 'aborted' || e.message?.includes('slot_taken')) {
        setError('Это время только что заняли. Выберите другое.');
      } else if (code === 'permission-denied') {
        setError('Клиент заблокирован.');
      } else {
        setError('Ошибка: ' + (e.message || 'неизвестная ошибка'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Клиент (владелец записи)</span>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="w-full rounded border px-3 py-2"
        >
          <option value="">Выберите клиента</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.phoneNormalized ? ' · ' + c.phoneNormalized : ''}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="mb-2 block text-sm font-medium text-gray-700">Режим</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('same-master')}
            className={
              'rounded border px-3 py-2 text-sm font-medium ' +
              (mode === 'same-master'
                ? 'border-black bg-black text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-black')
            }
          >
            Один мастер
          </button>
          <button
            type="button"
            onClick={() => setMode('smart')}
            className={
              'rounded border px-3 py-2 text-sm font-medium ' +
              (mode === 'smart'
                ? 'border-black bg-black text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-black')
            }
          >
            Свой мастер каждому
          </button>
        </div>
      </div>

      {mode === 'same-master' && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Мастер для всей группы</span>
          {sameMasterCandidates.length === 0 ? (
            <p className="text-sm text-gray-500">
              Нет мастеров, которые делают все выбранные услуги.
            </p>
          ) : (
            <select
              value={groupMasterId}
              onChange={(e) => setGroupMasterId(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">Выберите мастера</option>
              {sameMasterCandidates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </label>
      )}

      <div className="space-y-3">
        {people.map((person, idx) => (
          <PersonCard
            key={idx}
            idx={idx}
            person={person}
            services={services}
            masters={masters}
            mode={mode}
            onUpdate={updatePerson}
            onToggleService={togglePersonService}
            onRemove={people.length > MIN_PEOPLE ? () => removePerson(idx) : undefined}
          />
        ))}

        {people.length < MAX_PEOPLE && (
          <button
            type="button"
            onClick={addPerson}
            className="w-full rounded border-2 border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:border-black hover:text-black"
          >
            + Добавить человека
          </button>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Дата</span>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setAvailableSlots([]);
          }}
          className="w-full rounded border px-3 py-2"
        />
      </label>

      <button
        type="button"
        onClick={() => void loadSlots()}
        disabled={!isFormValid || !date || loadingSlots}
        className="w-full rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200 disabled:opacity-50"
      >
        {loadingSlots ? 'Поиск свободного времени…' : 'Найти свободное время'}
      </button>

      <section>
        <h3 className="mb-2 text-sm font-medium text-gray-700">Свободное время</h3>
        {!isFormValid ? (
          <p className="text-sm text-gray-500">Заполните всех людей и услуги.</p>
        ) : !date ? (
          <p className="text-sm text-gray-500">Выберите дату.</p>
        ) : loadingSlots ? (
          <p className="text-sm text-gray-500">Поиск…</p>
        ) : availableSlots.length === 0 ? (
          <p className="text-sm text-gray-500">Свободного времени нет.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableSlots.map((slot, index) => (
              <button
                key={slot.start + '-' + slot.branchId + '-' + index}
                type="button"
                onClick={() => void handleSelectSlot(slot)}
                disabled={saving}
                className="rounded border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              >
                {slot.time || minutesToTime(slot.start)}
              </button>
            ))}
          </div>
        )}
        {saving && <p className="mt-2 text-sm text-gray-500">Создание группы…</p>}
      </section>

      <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Человек</span>
          <b>{people.length}</b>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-gray-600">Сумма</span>
          <b>{groupTotalPrice.toLocaleString('ru-RU')} ₸</b>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-gray-600">Общая длительность</span>
          <b>{groupTotalDuration} мин</b>
        </div>
      </div>
    </div>
  );
}

type PersonCardProps = {
  idx: number;
  person: Person;
  services: Service[];
  masters: Master[];
  mode: Mode;
  onUpdate: (idx: number, patch: Partial<Person>) => void;
  onToggleService: (idx: number, serviceId: string) => void;
  onRemove?: () => void;
};

function PersonCard({ idx, person, services, masters, mode, onUpdate, onToggleService, onRemove }: PersonCardProps) {
  const eligibleMasters = useMemo(() => {
    if (!person.serviceIds.length) return masters;
    return masters.filter((m) => m.serviceIds?.some((id) => person.serviceIds.includes(id)));
  }, [masters, person.serviceIds]);

  return (
    <div className="rounded border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <b className="text-sm font-semibold">Человек {idx + 1}</b>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
          >
            Удалить
          </button>
        )}
      </div>

      <div className="space-y-2">
        <input
          type="text"
          value={person.clientName}
          onChange={(e) => onUpdate(idx, { clientName: e.target.value })}
          placeholder="Имя"
          className="w-full rounded border px-3 py-2 text-sm"
        />

        {mode === 'smart' && (
          <select
            value={person.masterId}
            onChange={(e) => onUpdate(idx, { masterId: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          >
            <option value="">Выберите мастера</option>
            {eligibleMasters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}

        <div className="grid gap-1.5 sm:grid-cols-2">
          {services.map((s) => {
            const checked = person.serviceIds.includes(s.id);
            return (
              <label
                key={s.id}
                className={
                  'flex items-center gap-2 rounded border p-2 text-xs cursor-pointer ' +
                  (checked ? 'border-black bg-gray-50' : 'border-gray-200')
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleService(idx, s.id)}
                />
                <span className="truncate">
                  {s.name} · {s.durationMinutes} мин
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}