'use client';

import { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';

type Client = { id: string; name: string; phoneNormalized?: string; isBlocked?: boolean };
type Service = { id: string; name: string; durationMinutes: number; priceKzt: number; isActive: boolean; bufferMinutes?: number };
type Master = { id: string; name: string; isActive: boolean; serviceIds?: string[] };
type Slot = { start: number; end: number; branchId: string; time?: string };

type Person = {
  clientName: string;
  masterId: string;
  serviceIds: string[];
  selectedStart: number | null;
};

const MAX_PEOPLE = 6;
const MIN_PEOPLE = 2;

const PERSON_COLORS = [
  { border: '#60a5fa', badge: 'bg-blue-100 text-blue-800' },
  { border: '#c084fc', badge: 'bg-purple-100 text-purple-800' },
  { border: '#4ade80', badge: 'bg-green-100 text-green-800' },
  { border: '#fb923c', badge: 'bg-orange-100 text-orange-800' },
  { border: '#f472b6', badge: 'bg-pink-100 text-pink-800' },
  { border: '#2dd4bf', badge: 'bg-teal-100 text-teal-800' },
];

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

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1);
  if (digits.length === 11 && digits.startsWith('7')) return '+' + digits;
  if (digits.length === 10) return '+7' + digits;
  return '+' + digits;
}

function phoneDigits(input: string): string {
  return input.replace(/\D/g, '');
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
  const [clientPhone, setClientPhone] = useState('');
  const [clientName, setClientName] = useState('');
  const [people, setPeople] = useState<Person[]>(() => [
    { clientName: '', masterId: '', serviceIds: [], selectedStart: null },
    { clientName: '', masterId: '', serviceIds: [], selectedStart: null },
  ]);
  const [date, setDate] = useState(initialDate || '');
  const [slotsByPerson, setSlotsByPerson] = useState<Record<number, Slot[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [slotsLoaded, setSlotsLoaded] = useState(false);

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  const phoneNorm = useMemo(() => normalizePhone(clientPhone), [clientPhone]);
  const phoneCount = useMemo(() => phoneDigits(clientPhone).length, [clientPhone]);
  const phoneValid = phoneCount >= 10 && phoneCount <= 15;

  const matchedClient = useMemo<Client | null>(() => {
    if (!phoneValid) return null;
    const target = phoneNorm.replace(/\D/g, '');
    return clients.find((c) => (c.phoneNormalized || '').replace(/\D/g, '') === target) || null;
  }, [clients, phoneNorm, phoneValid]);

  const isNewClient = phoneValid && !matchedClient;

  const durationOf = useMemo(
    () => (serviceIds: string[]): number =>
      serviceIds.reduce((sum, sid) => {
        const s = services.find((x) => x.id === sid);
        return sum + (s ? s.durationMinutes + (s.bufferMinutes || 0) : 0);
      }, 0),
    [services]
  );

  const minStartByPerson = useMemo(() => {
    const result: (number | undefined)[] = [];
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      if (!p.masterId) {
        result.push(undefined);
        continue;
      }
      let minStart: number | undefined = undefined;
      for (let j = 0; j < i; j++) {
        const prev = people[j];
        if (prev.masterId !== p.masterId) continue;
        if (prev.selectedStart === null) continue;
        const prevEnd = prev.selectedStart + durationOf(prev.serviceIds);
        if (minStart === undefined || prevEnd > minStart) minStart = prevEnd;
      }
      result.push(minStart);
    }
    return result;
  }, [people, durationOf]);

  const updatePerson = (idx: number, patch: Partial<Person>) => {
    if (patch.masterId !== undefined || patch.serviceIds !== undefined) {
      setSlotsByPerson((prev) => ({ ...prev, [idx]: [] }));
      setSlotsLoaded(false);
    }
    setPeople((prev) => {
      let next = prev.map((p, i) => (i === idx ? { ...p, ...patch } : p));
      if (patch.selectedStart !== undefined && patch.selectedStart !== null) {
        const changed = next[idx];
        const newEnd = patch.selectedStart + durationOf(changed.serviceIds);
        next = next.map((p, i) => {
          if (i <= idx) return p;
          if (p.masterId !== changed.masterId) return p;
          if (p.selectedStart === null) return p;
          if (p.selectedStart < newEnd) return { ...p, selectedStart: null };
          return p;
        });
      }
      return next;
    });
  };

  const addPerson = () => {
    if (people.length >= MAX_PEOPLE) return;
    setPeople((prev) => [...prev, { clientName: '', masterId: '', serviceIds: [], selectedStart: null }]);
  };

  const removePerson = (idx: number) => {
    if (people.length <= MIN_PEOPLE) return;
    setPeople((prev) => prev.filter((_, i) => i !== idx));
    setSlotsByPerson({});
    setSlotsLoaded(false);
  };

  const togglePersonService = (idx: number, serviceId: string) => {
    setPeople((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        const has = p.serviceIds.includes(serviceId);
        const nextServices = has ? p.serviceIds.filter((x) => x !== serviceId) : [...p.serviceIds, serviceId];
        return { ...p, serviceIds: nextServices, selectedStart: null };
      })
    );
    setSlotsByPerson((prev) => ({ ...prev, [idx]: [] }));
    setSlotsLoaded(false);
  };

  const isBaseValid = useMemo(() => {
    if (!phoneValid) return false;
    for (const p of people) {
      if (!p.masterId) return false;
      if (!p.serviceIds.length) return false;
    }
    return true;
  }, [phoneValid, people]);

  const isReadyToSubmit = useMemo(() => {
    if (!isBaseValid) return false;
    if (!slotsLoaded) return false;
    for (const p of people) {
      if (p.selectedStart === null) return false;
    }
    return true;
  }, [isBaseValid, slotsLoaded, people]);

  const groupTotalPrice = useMemo(() => {
    let sum = 0;
    for (const p of people)
      for (const sid of p.serviceIds) {
        const s = services.find((x) => x.id === sid);
        if (s) sum += s.priceKzt;
      }
    return sum;
  }, [people, services]);

  const loadAllSlots = async () => {
    if (!date || !isBaseValid) {
      setError('Заполните телефон, мастеров и услуги для всех людей');
      return;
    }

    setLoadingSlots(true);
    setSlotsByPerson({});
    setSlotsLoaded(false);
    setError('');

    try {
      const getAvailableSlots = httpsCallable(getFirebaseFunctions(), 'getAvailableSlots');

      const results = await Promise.all(
        people.map(async (p, idx) => {
          const duration = durationOf(p.serviceIds);
          if (!duration) return { idx, slots: [] as Slot[] };
          try {
            const res = await getAvailableSlots({ masterId: p.masterId, date, durationMinutes: duration });
            return { idx, slots: ((res.data as { slots?: Slot[] }).slots) || [] };
          } catch {
            return { idx, slots: [] as Slot[] };
          }
        })
      );

      const next: Record<number, Slot[]> = {};
      for (const r of results) next[r.idx] = r.slots;
      setSlotsByPerson(next);
      setSlotsLoaded(true);
    } catch {
      setSlotsByPerson({});
      setError('Не удалось загрузить свободное время');
    } finally {
      setLoadingSlots(false);
    }
  };

  const submit = async () => {
    if (!isReadyToSubmit) return;
    setSaving(true);
    setError('');
    try {
      const ownerFallback =
        matchedClient?.name ||
        clientName.trim() ||
        `Клиент ${phoneNorm.slice(-4)}`;

      const fn = httpsCallable(getFirebaseFunctions(), 'createGroupAppointment');
      await fn({
        ...(matchedClient ? { clientId: matchedClient.id } : {}),
        ...(isNewClient ? { clientName: ownerFallback, clientPhone: phoneNorm } : {}),
        date,
        people: people.map((p, idx) => ({
          clientName: p.clientName.trim() || (idx === 0 ? ownerFallback : `Гость ${idx + 1}`),
          masterId: p.masterId,
          serviceIds: p.serviceIds,
          startMinutes: p.selectedStart as number,
        })),
        source: 'admin',
      });
      onCreated();
      onClose();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      const code = (e.code || '').replace(/^functions\//, '');
      if (code === 'aborted' || e.message?.includes('slot_taken')) {
        setError('Один из слотов только что заняли. Обновите время и выберите заново.');
        setSlotsLoaded(false);
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

      <div className="rounded border border-gray-200 bg-gray-50 p-3">
        <span className="mb-2 block text-sm font-medium text-gray-700">
          Телефон клиента
        </span>
        <input
          type="tel"
          value={clientPhone}
          onChange={(e) => setClientPhone(e.target.value)}
          placeholder="+7 ___ ___ __ __"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />

        {phoneValid && matchedClient && (
          <div className="mt-2 flex items-start gap-2 rounded border border-green-200 bg-green-50 p-2.5">
            <span className="mt-0.5 text-green-600">✓</span>
            <div className="min-w-0 flex-1 text-sm">
              <b className="block truncate text-green-800">{matchedClient.name}</b>
              <span className="block truncate text-xs text-green-700">{matchedClient.phoneNormalized}</span>
            </div>
          </div>
        )}

        {phoneValid && !matchedClient && (
          <div className="mt-2">
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Имя нового клиента (не обязательно)"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        {!phoneValid && clientPhone && (
          <p className="mt-1.5 text-xs text-gray-500">Введите номер полностью (10–15 цифр)</p>
        )}
      </div>

      <div className="space-y-3">
        {people.map((person, idx) => (
          <PersonCard
            key={idx}
            idx={idx}
            person={person}
            services={services}
            masters={masters}
            slots={slotsByPerson[idx] || []}
            minStart={minStartByPerson[idx]}
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
            setSlotsByPerson({});
            setSlotsLoaded(false);
            setPeople((prev) => prev.map((p) => ({ ...p, selectedStart: null })));
          }}
          className="w-full rounded border px-3 py-2"
        />
      </label>

      <button
        type="button"
        onClick={() => void loadAllSlots()}
        disabled={!isBaseValid || !date || loadingSlots}
        className="w-full rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200 disabled:opacity-50"
      >
        {loadingSlots ? 'Поиск…' : slotsLoaded ? 'Обновить свободное время' : 'Найти свободное время'}
      </button>

      {isBaseValid && slotsLoaded && (
        <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Человек</span>
            <b>{people.length}</b>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-gray-600">Выбрано времени</span>
            <b>
              {people.filter((p) => p.selectedStart !== null).length} из {people.length}
            </b>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-gray-600">Сумма</span>
            <b>{groupTotalPrice.toLocaleString('ru-RU')} ₸</b>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={!isReadyToSubmit || saving}
        className="w-full rounded bg-black px-4 py-3 text-base font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? 'Создание…' : `Создать группу (${people.length})`}
      </button>
    </div>
  );
}

type PersonCardProps = {
  idx: number;
  person: Person;
  services: Service[];
  masters: Master[];
  slots: Slot[];
  minStart?: number;
  onUpdate: (idx: number, patch: Partial<Person>) => void;
  onToggleService: (idx: number, serviceId: string) => void;
  onRemove?: () => void;
};

function PersonCard({ idx, person, services, masters, slots, minStart, onUpdate, onToggleService, onRemove }: PersonCardProps) {
  const [expanded, setExpanded] = useState(true);
  const color = PERSON_COLORS[idx % PERSON_COLORS.length];

  const eligibleMasters = useMemo(() => {
    if (!person.serviceIds.length) return masters;
    return masters.filter((m) => m.serviceIds?.some((id) => person.serviceIds.includes(id)));
  }, [masters, person.serviceIds]);

  const hasSlots = slots.length > 0;
  const showSlotGrid = person.masterId && person.serviceIds.length > 0;

  return (
    <div className="rounded border-2 bg-white p-3" style={{ borderColor: color.border }}>
      <div className="mb-2 flex items-center justify-between">
        <span className={'inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ' + color.badge}>
          Человек {idx + 1}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded((x) => !x)}
            className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
          >
            {expanded ? 'Свернуть' : 'Развернуть'}
          </button>
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
      </div>

      {expanded && (
        <div className="space-y-2">
          <input
            type="text"
            value={person.clientName}
            onChange={(e) => onUpdate(idx, { clientName: e.target.value })}
            placeholder="Имя (не обязательно)"
            className="w-full rounded border px-3 py-2 text-sm"
          />

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
                  <input type="checkbox" checked={checked} onChange={() => onToggleService(idx, s.id)} />
                  <span className="truncate">
                    {s.name} · {s.durationMinutes} мин
                  </span>
                </label>
              );
            })}
          </div>

          {showSlotGrid && hasSlots && (
            <div className="mt-2 border-t border-gray-100 pt-2">
              <div className="flex flex-wrap gap-1.5">
                {slots.map((s) => {
                  const active = person.selectedStart === s.start;
                  const disabled = minStart !== undefined && s.start < minStart;
                  if (disabled) {
                    return (
                      <span
                        key={s.start}
                        className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-300 opacity-40 select-none"
                      >
                        {s.time || minutesToTime(s.start)}
                      </span>
                    );
                  }
                  return (
                    <button
                      key={s.start}
                      type="button"
                      onClick={() => onUpdate(idx, { selectedStart: active ? null : s.start })}
                      className={
                        'rounded border px-3 py-1.5 text-xs font-medium transition ' +
                        (active
                          ? 'border-black bg-black text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-black')
                      }
                    >
                      {s.time || minutesToTime(s.start)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}