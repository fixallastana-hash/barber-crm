'use client';

import { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';

type Client = { id: string; name: string; phoneNormalized?: string; isBlocked?: boolean };
type Service = { id: string; name: string; durationMinutes: number; priceKzt: number; isActive: boolean; bufferMinutes?: number };
type Master = { id: string; name: string; isActive: boolean; serviceIds?: string[] };
type Slot = { start: number; end: number; branchId: string; time?: string };

type Person = {
  masterId: string;
  serviceIds: string[];
  selectedStart: number | null;
};

type ClientBlock = {
  id: string;
  phone: string;
  name: string;
  people: Person[];
};

const MAX_CLIENTS = 4;
const MAX_PEOPLE_PER_CLIENT = 6;
const MAX_DISCOUNT = 50;

const PERSON_COLORS = [
  { border: '#60a5fa', badge: 'bg-blue-100 text-blue-800' },
  { border: '#c084fc', badge: 'bg-purple-100 text-purple-800' },
  { border: '#4ade80', badge: 'bg-green-100 text-green-800' },
  { border: '#fb923c', badge: 'bg-orange-100 text-orange-800' },
  { border: '#f472b6', badge: 'bg-pink-100 text-pink-800' },
  { border: '#2dd4bf', badge: 'bg-teal-100 text-teal-800' },
];

type FieldError = { fieldId: string; message: string };

type Props = {
  tenantId: string;
  clients: Client[];
  services: Service[];
  masters: Master[];
  initialDate?: string;
  initialMasterId?: string;
  initialStartMinutes?: number;
  onCreated: () => void;
  onClose: () => void;
};

function uid() { return Math.random().toString(36).slice(2, 10); }
function minutesToTime(m: number) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function normalizePhone(input: string): string {
  const d = input.replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 11 && d.startsWith('8')) return '+7' + d.slice(1);
  if (d.length === 11 && d.startsWith('7')) return '+' + d;
  if (d.length === 10) return '+7' + d;
  return '+' + d;
}
function phoneDigits(input: string) { return input.replace(/\D/g, ''); }

export function AddGroupAppointmentForm({ clients, services, masters, initialDate, initialMasterId, initialStartMinutes, onCreated, onClose }: Props) {
  const [clientBlocks, setClientBlocks] = useState<ClientBlock[]>(() => [
    { id: uid(), phone: '', name: '', people: [{ masterId: initialMasterId || '', serviceIds: [], selectedStart: null }] },
  ]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [date, setDate] = useState(initialDate || '');
  const [slotsByKey, setSlotsByKey] = useState<Record<string, Slot[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState<FieldError | null>(null);

  useEffect(() => { if (initialDate) setDate(initialDate); }, [initialDate]);

  const durationOf = useMemo(
    () => (serviceIds: string[]): number =>
      serviceIds.reduce((sum, sid) => {
        const s = services.find((x) => x.id === sid);
        return sum + (s ? s.durationMinutes + (s.bufferMinutes || 0) : 0);
      }, 0),
    [services],
  );

  const matchedClientByPhone = (phone: string): Client | null => {
    const d = phoneDigits(phone);
    if (d.length < 10) return null;
    return clients.find((c) => (c.phoneNormalized || '').replace(/\D/g, '') === d) || null;
  };

  const allPeople = useMemo(
    () => clientBlocks.flatMap((c, ci) => c.people.map((p, pi) => ({ ci, pi, key: c.id + '-' + pi, ...p }))),
    [clientBlocks],
  );

  const minStartByKey = useMemo(() => {
    const result: Record<string, number | undefined> = {};
    for (let i = 0; i < allPeople.length; i++) {
      const cur = allPeople[i];
      if (!cur.masterId) { result[cur.key] = undefined; continue; }
      let minStart: number | undefined = undefined;
      for (let j = 0; j < i; j++) {
        const prev = allPeople[j];
        if (prev.selectedStart === null) continue;
        const sameMaster = prev.masterId === cur.masterId;
        const sameClient = prev.ci === cur.ci;
        if (!sameMaster && !sameClient) continue;
        const prevEnd = prev.selectedStart + durationOf(prev.serviceIds);
        if (minStart === undefined || prevEnd > minStart) minStart = prevEnd;
      }
      result[cur.key] = minStart;
    }
    return result;
  }, [allPeople, durationOf]);

  const updateClient = (ci: number, patch: Partial<Pick<ClientBlock, 'phone' | 'name'>>) => {
    setFieldError(null);
    setClientBlocks((prev) => prev.map((c, i) => (i === ci ? { ...c, ...patch } : c)));
  };

  const updatePerson = (ci: number, pi: number, patch: Partial<Person>) => {
    setFieldError(null);
    if (patch.masterId !== undefined || patch.serviceIds !== undefined) {
      setSlotsByKey((prev) => ({ ...prev, [clientBlocks[ci].id + '-' + pi]: [] }));
    }
    setClientBlocks((prev) =>
      prev.map((c, i) => {
        if (i !== ci) return c;
        let next = c.people.map((p, j) => (j === pi ? { ...p, ...patch } : p));
        if (patch.selectedStart !== undefined && patch.selectedStart !== null) {
          const changed = next[pi];
          const newEnd = patch.selectedStart + durationOf(changed.serviceIds);
          next = next.map((p, j) => {
            if (j <= pi) return p;
            if (p.masterId !== changed.masterId) return p;
            if (p.selectedStart === null) return p;
            if (p.selectedStart < newEnd) return { ...p, selectedStart: null };
            return p;
          });
        }
        return { ...c, people: next };
      }),
    );
  };

  const toggleService = (ci: number, pi: number, serviceId: string) => {
    setFieldError(null);
    const block = clientBlocks[ci];
    const p = block.people[pi];
    const has = p.serviceIds.includes(serviceId);
    const next = has ? p.serviceIds.filter((x) => x !== serviceId) : [...p.serviceIds, serviceId];
    updatePerson(ci, pi, { serviceIds: next, selectedStart: null });
  };

  const addPersonToClient = (ci: number) => {
    setClientBlocks((prev) => prev.map((c, i) => {
      if (i !== ci) return c;
      if (c.people.length >= MAX_PEOPLE_PER_CLIENT) return c;
      return { ...c, people: [...c.people, { masterId: '', serviceIds: [], selectedStart: null }] };
    }));
  };

  const removePerson = (ci: number, pi: number) => {
    const block = clientBlocks[ci];
    if (block.people.length <= 1) return;
    setClientBlocks((prev) => prev.map((c, i) => i === ci ? { ...c, people: c.people.filter((_, j) => j !== pi) } : c));
    setSlotsByKey({});
  };

  const addClient = () => {
    if (clientBlocks.length >= MAX_CLIENTS) return;
    const prevPhone = clientBlocks[clientBlocks.length - 1]?.phone || '';
    setClientBlocks((prev) => [
      ...prev,
      { id: uid(), phone: prevPhone, name: '', people: [{ masterId: '', serviceIds: [], selectedStart: null }] },
    ]);
  };

  const removeClient = (ci: number) => {
    if (clientBlocks.length <= 1) return;
    setClientBlocks((prev) => prev.filter((_, i) => i !== ci));
    setSlotsByKey({});
  };

  const isBaseValid = useMemo(() => {
    if (!date) return false;
    for (const c of clientBlocks) {
      if (!phoneDigits(c.phone).length) return false;
      for (const p of c.people) {
        if (!p.masterId) return false;
        if (!p.serviceIds.length) return false;
      }
    }
    return true;
  }, [date, clientBlocks]);

  const slotsKey = clientBlocks.map((c) => c.id + ':' + c.people.map((p) => p.masterId + '|' + p.serviceIds.join(',')).join(';')).join('||');

  useEffect(() => {
    if (!isBaseValid) { setSlotsByKey({}); return; }
    let cancelled = false;
    const run = async () => {
      setLoadingSlots(true);
      setError('');
      try {
        const getAvailableSlots = httpsCallable(getFirebaseFunctions(), 'getAvailableSlots');
        const tasks = clientBlocks.flatMap((c) =>
          c.people.map(async (p, pi) => {
            const key = c.id + '-' + pi;
            const duration = durationOf(p.serviceIds);
            if (!duration) return { key, slots: [] as Slot[] };
            try {
              const res = await getAvailableSlots({ masterId: p.masterId, date, durationMinutes: duration });
              return { key, slots: ((res.data as { slots?: Slot[] }).slots) || [] };
            } catch { return { key, slots: [] as Slot[] }; }
          }),
        );
        const results = await Promise.all(tasks);
        if (cancelled) return;
        const next: Record<string, Slot[]> = {};
        for (const r of results) next[r.key] = r.slots;
        setSlotsByKey(next);
      } catch {
        if (!cancelled) setError('Не удалось загрузить свободное время');
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    };
    void run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, isBaseValid, slotsKey]);

  const groupTotalPrice = useMemo(() => {
    let sum = 0;
    for (const c of clientBlocks) for (const p of c.people) for (const sid of p.serviceIds) {
      const s = services.find((x) => x.id === sid);
      if (s) sum += s.priceKzt;
    }
    return sum;
  }, [clientBlocks, services]);

  const finalPrice = useMemo(() => Math.round(groupTotalPrice * (1 - discountPercent / 100)), [groupTotalPrice, discountPercent]);

  const findFirstError = (): FieldError | null => {
    if (!date) return { fieldId: 'group-date', message: 'Выберите дату' };
    for (let ci = 0; ci < clientBlocks.length; ci++) {
      const c = clientBlocks[ci];
      if (!phoneDigits(c.phone).length) {
        return { fieldId: 'client-' + ci + '-phone', message: 'Клиент ' + (ci + 1) + ': введите телефон' };
      }
      if (phoneDigits(c.phone).length < 10) {
        return { fieldId: 'client-' + ci + '-phone', message: 'Клиент ' + (ci + 1) + ': введите номер полностью' };
      }
      for (let pi = 0; pi < c.people.length; pi++) {
        const p = c.people[pi];
        const prefix = 'client-' + ci + '-person-' + pi;
        if (!p.masterId) return { fieldId: prefix + '-master', message: 'Клиент ' + (ci + 1) + ', мастер ' + (pi + 1) + ': выберите мастера' };
        if (!p.serviceIds.length) return { fieldId: prefix + '-services', message: 'Клиент ' + (ci + 1) + ', мастер ' + (pi + 1) + ': выберите услугу' };
        if (p.selectedStart === null) return { fieldId: prefix + '-time', message: 'Клиент ' + (ci + 1) + ', мастер ' + (pi + 1) + ': выберите время' };
      }
    }
    return null;
  };

  const scrollToError = (err: FieldError) => {
    setFieldError(err);
    setTimeout(() => {
      const el = document.getElementById(err.fieldId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (typeof (el as HTMLInputElement).focus === 'function') (el as HTMLInputElement).focus({ preventScroll: true });
      }
    }, 50);
    setTimeout(() => setFieldError(null), 6000);
  };

  const submit = async () => {
    const err = findFirstError();
    if (err) { scrollToError(err); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        date,
        discountPercent,
        source: 'admin',
        clients: clientBlocks.map((c) => {
          const matched = matchedClientByPhone(c.phone);
          return {
            ...(matched ? { clientId: matched.id } : {
              clientName: c.name.trim() || 'Клиент ' + phoneDigits(c.phone).slice(-4),
              clientPhone: normalizePhone(c.phone),
            }),
            people: c.people.map((p) => ({
              masterId: p.masterId,
              serviceIds: p.serviceIds,
              startMinutes: p.selectedStart as number,
            })),
          };
        }),
      };
      const fn = httpsCallable(getFirebaseFunctions(), 'createGroupAppointment');
      await fn(payload);
      onCreated();
      onClose();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      const code = (e.code || '').replace(/^functions\//, '');
      if (code === 'aborted' || e.message?.includes('slot_taken')) setError('Один из слотов только что заняли. Выберите время заново.');
      else if (code === 'permission-denied') setError('Клиент заблокирован.');
      else setError('Ошибка: ' + (e.message || 'неизвестная ошибка'));
    } finally { setSaving(false); }
  };

  const ring = (id: string) => fieldError?.fieldId === id ? ' ring-2 ring-red-500 ring-offset-1' : '';

  return (
    <div className="space-y-5">
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {fieldError && (
        <div className="sticky top-0 z-30 rounded border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800 shadow-sm">
          ⚠ {fieldError.message}
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Дата</span>
        <input id="group-date" type="date" value={date}
          onChange={(e) => { setDate(e.target.value); setFieldError(null); setClientBlocks((prev) => prev.map((c) => ({ ...c, people: c.people.map((p) => ({ ...p, selectedStart: null })) }))); }}
          className={'w-full rounded border px-3 py-2' + ring('group-date')} />
      </label>

      {clientBlocks.map((client, ci) => (
        <div key={client.id} className="rounded-lg border-2 border-gray-300 bg-gray-50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center rounded bg-gray-800 px-2 py-0.5 text-xs font-semibold text-white">
              Клиент {ci + 1}
            </span>
            {clientBlocks.length > 1 && (
              <button type="button" onClick={() => removeClient(ci)}
                className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">Удалить клиента</button>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Телефон</span>
              <input id={'client-' + ci + '-phone'} type="tel" value={client.phone}
                onChange={(e) => updateClient(ci, { phone: e.target.value })}
                placeholder="+7 ___ ___ __ __"
                className={'w-full rounded border border-gray-300 px-3 py-2 text-sm' + ring('client-' + ci + '-phone')} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Имя</span>
              <input type="text" value={client.name}
                onChange={(e) => updateClient(ci, { name: e.target.value })}
                placeholder="Имя клиента"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
          </div>

          {(() => {
            const matched = matchedClientByPhone(client.phone);
            if (!matched) return null;
            return (
              <div className="flex items-start gap-2 rounded border border-green-200 bg-green-50 p-2.5">
                <span className="mt-0.5 text-green-600">✓</span>
                <div className="min-w-0 flex-1 text-sm">
                  <b className="block truncate text-green-800">{matched.name}</b>
                  <span className="block truncate text-xs text-green-700">{matched.phoneNormalized}</span>
                </div>
              </div>
            );
          })()}

          <div className="space-y-3">
            {client.people.map((person, pi) => (
              <PersonCard
                key={ci + '-' + pi}
                ci={ci}
                pi={pi}
                person={person}
                services={services}
                masters={masters}
                slots={slotsByKey[client.id + '-' + pi] || []}
                minStart={minStartByKey[client.id + '-' + pi]}
                loadingSlots={loadingSlots}
                errorField={fieldError?.fieldId}
                canRemove={client.people.length > 1}
                onUpdate={updatePerson}
                onToggleService={toggleService}
                onRemove={removePerson}
              />
            ))}
          </div>

          {client.people.length < MAX_PEOPLE_PER_CLIENT && (
            <button type="button" onClick={() => addPersonToClient(ci)}
              className="w-full rounded border-2 border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-black hover:text-black">
              + Добавить мастера
            </button>
          )}
        </div>
      ))}

      {clientBlocks.length < MAX_CLIENTS && (
        <button type="button" onClick={addClient}
          className="w-full rounded border-2 border-dashed border-blue-400 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100">
          + Добавить клиента
        </button>
      )}

      <div className="rounded border border-gray-200 bg-gray-50 p-3">
        <span className="mb-2 block text-sm font-medium text-gray-700">Скидка</span>
        <div className="flex flex-wrap items-center gap-2">
          {[5, 10, 20, 50].map((d) => (
            <button key={d} type="button" onClick={() => setDiscountPercent(d)}
              className={'h-9 rounded-full px-3 text-xs font-medium transition ' + (discountPercent === d ? 'bg-black text-white' : 'border border-gray-200 bg-white text-gray-700 hover:border-black')}>
              {d}%
            </button>
          ))}
          <input type="number" min={0} max={MAX_DISCOUNT} value={discountPercent || ''}
            onChange={(e) => { const v = Math.min(MAX_DISCOUNT, Math.max(0, Math.round(Number(e.target.value) || 0))); setDiscountPercent(v); }}
            placeholder="0"
            className="h-9 w-20 rounded border border-gray-300 px-2 text-right text-sm" />
          <span className="text-sm text-gray-500">%</span>
        </div>
      </div>

      {isBaseValid && (
        <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
          <div className="flex justify-between"><span className="text-gray-600">Клиентов</span><b>{clientBlocks.length}</b></div>
          <div className="mt-1 flex justify-between"><span className="text-gray-600">Всего мастеров</span><b>{allPeople.length}</b></div>
          <div className="mt-1 flex justify-between"><span className="text-gray-600">Сумма</span><b>{groupTotalPrice.toLocaleString('ru-RU')} ₸</b></div>
          {discountPercent > 0 && (
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-base">
              <span className="font-medium text-gray-800">Итого со скидкой {discountPercent}%</span>
              <b className="text-green-700">{finalPrice.toLocaleString('ru-RU')} ₸</b>
            </div>
          )}
        </div>
      )}

      <button type="button" onClick={() => void submit()} disabled={saving}
        className="w-full rounded bg-black px-4 py-3 text-base font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
        {saving ? 'Создание…' : 'Создать ' + allPeople.length + ' запис' + (allPeople.length === 1 ? 'ь' : allPeople.length < 5 ? 'и' : 'ей') + (discountPercent > 0 ? ' −' + discountPercent + '%' : '')}
      </button>
    </div>
  );
}

type PersonCardProps = {
  ci: number;
  pi: number;
  person: Person;
  services: Service[];
  masters: Master[];
  slots: Slot[];
  minStart?: number;
  loadingSlots?: boolean;
  errorField?: string;
  canRemove: boolean;
  onUpdate: (ci: number, pi: number, patch: Partial<Person>) => void;
  onToggleService: (ci: number, pi: number, serviceId: string) => void;
  onRemove: (ci: number, pi: number) => void;
};

function PersonCard({ ci, pi, person, services, masters, slots, minStart, loadingSlots, errorField, canRemove, onUpdate, onToggleService, onRemove }: PersonCardProps) {
  const [expanded, setExpanded] = useState(true);
  const color = PERSON_COLORS[(ci * 3 + pi) % PERSON_COLORS.length];

  const eligibleMasters = useMemo(() => {
    if (!person.serviceIds.length) return masters;
    return masters.filter((m) => m.serviceIds?.some((id) => person.serviceIds.includes(id)));
  }, [masters, person.serviceIds]);

  const hasSlots = slots.length > 0;
  const showSlotGrid = person.masterId && person.serviceIds.length > 0;
  const prefix = 'client-' + ci + '-person-' + pi;
  const ring = (id: string) => errorField === id ? ' ring-2 ring-red-500 ring-offset-1' : '';

  return (
    <div className="rounded border-2 bg-white p-3" style={{ borderColor: color.border }}>
      <div className="mb-2 flex items-center justify-between">
        <span className={'inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ' + color.badge}>
          Мастер {pi + 1}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setExpanded((x) => !x)}
            className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100">
            {expanded ? 'Свернуть' : 'Развернуть'}
          </button>
          {canRemove && (
            <button type="button" onClick={() => onRemove(ci, pi)}
              className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">
              Удалить
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="space-y-2">
          <select id={prefix + '-master'} value={person.masterId}
            onChange={(e) => onUpdate(ci, pi, { masterId: e.target.value })}
            className={'w-full rounded border px-3 py-2 text-sm' + ring(prefix + '-master')}>
            <option value="">Выберите мастера</option>
            {eligibleMasters.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <div id={prefix + '-services'} className={'grid gap-1.5 rounded sm:grid-cols-2' + ring(prefix + '-services')}>
            {services.map((s) => {
              const checked = person.serviceIds.includes(s.id);
              return (
                <label key={s.id} className={'flex items-center gap-2 rounded border p-2 text-xs cursor-pointer ' + (checked ? 'border-black bg-gray-50' : 'border-gray-200')}>
                  <input type="checkbox" checked={checked} onChange={() => onToggleService(ci, pi, s.id)} />
                  <span className="truncate">{s.name} · {s.durationMinutes} мин</span>
                </label>
              );
            })}
          </div>

          {showSlotGrid && (
            <div id={prefix + '-time'} className={'mt-2 rounded border-t border-gray-100 pt-2' + ring(prefix + '-time')}>
              {loadingSlots ? (
                <p className="text-xs text-gray-400">Загружаем свободное время…</p>
              ) : !hasSlots ? (
                <p className="text-xs text-gray-400">Нет свободного времени</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {slots.map((s) => {
                    const active = person.selectedStart === s.start;
                    const disabled = minStart !== undefined && s.start < minStart;
                    if (disabled) {
                      return <span key={s.start} className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-300 opacity-40 select-none">{s.time || minutesToTime(s.start)}</span>;
                    }
                    return (
                      <button key={s.start} type="button"
                        onClick={() => onUpdate(ci, pi, { selectedStart: active ? null : s.start })}
                        className={'rounded border px-3 py-1.5 text-xs font-medium transition ' + (active ? 'border-black bg-black text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-black')}>
                        {s.time || minutesToTime(s.start)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
