'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';

type Service = {
  id: string;
  name: string;
  categoryId: string;
  durationMinutes: number;
  priceKzt: number;
  iconUrl: string;
  iconPositionX: number;
  iconPositionY: number;
  iconScale: number;
};

type Master = {
  id: string;
  name: string;
  photoUrl: string;
  rating: number;
  ratingCount: number;
  serviceIds: string[];
};

type Category = {
  id: string;
  name: string;
  iconUrl: string;
  iconPositionX: number;
  iconPositionY: number;
  iconScale: number;
};

type Slot = { start: number; end: number; time: string };

type SalonData = {
  tenant: { name: string; city: string };
  categories: Category[];
  services: Service[];
  masters: Master[];
};

type Mode = 'same-master' | 'smart';

type Person = {
  clientName: string;
  masterId: string;
  serviceIds: string[];
};

const MAX_PEOPLE = 6;
const MIN_PEOPLE = 2;

const money = (n: number) => n.toLocaleString('ru-RU') + ' ₸';
const dateRu = (s: string) =>
  s ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(s + 'T12:00:00Z')) : '';

type Props = {
  salon: SalonData;
  slug: string;
  step: 1 | 2 | 3;
  onStepChange: (n: 1 | 2 | 3) => void;
  onStepReplace: (n: 1 | 2 | 3) => void;
  onExit: () => void;
};

type Draft = {
  mode: Mode;
  groupMasterId: string;
  people: Person[];
  date: string;
  slot: Slot | null;
  phone: string;
  consent: boolean;
};

const EMPTY_DRAFT: Draft = {
  mode: 'same-master',
  groupMasterId: '',
  people: [
    { clientName: '', masterId: '', serviceIds: [] },
    { clientName: '', masterId: '', serviceIds: [] },
  ],
  date: '',
  slot: null,
  phone: '',
  consent: false,
};

export function GroupBookingFlow({ salon, slug, step, onStepChange, onStepReplace, onExit }: Props) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);
  const storageKey = 'group_draft_' + slug;

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { mode, groupMasterId, people, date, slot, phone, consent } = draft;

  // ---------- sessionStorage hydration ----------
  useEffect(() => {
    if (typeof window === 'undefined' || !slug) {
      setHydrated(true);
      return;
    }
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Draft>;
        setDraft(prev => ({
          ...prev,
          ...parsed,
          people:
            Array.isArray(parsed.people) &&
            parsed.people.length >= MIN_PEOPLE &&
            parsed.people.length <= MAX_PEOPLE
              ? parsed.people
              : prev.people,
          slot: parsed.slot ?? null,
        }));
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [slug, storageKey]);

  // persist
  useEffect(() => {
    if (!hydrated) return;
    if (typeof window === 'undefined' || !slug) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft, hydrated, slug, storageKey]);

  // ---------- derived ----------
  const sameMasterCandidates = useMemo(() => {
    if (mode !== 'same-master') return [];
    return salon.masters.filter(m => {
      for (const p of people) {
        for (const sid of p.serviceIds) {
          if (!m.serviceIds?.includes(sid)) return false;
        }
      }
      return true;
    });
  }, [mode, salon.masters, people]);

  const uniqueMasters = useMemo(() => {
    if (mode === 'same-master') return groupMasterId ? [groupMasterId] : [];
    const set = new Set<string>();
    for (const p of people) if (p.masterId) set.add(p.masterId);
    return [...set];
  }, [mode, groupMasterId, people]);

  const isStep1Valid = useMemo(() => {
    if (mode === 'same-master' && !groupMasterId) return false;
    for (const p of people) {
      if (!p.clientName.trim()) return false;
      if (!p.serviceIds.length) return false;
      if (mode === 'smart' && !p.masterId) return false;
    }
    return true;
  }, [mode, groupMasterId, people]);

  const groupTotalPrice = useMemo(() => {
    let sum = 0;
    for (const p of people)
      for (const sid of p.serviceIds) {
        const s = salon.services.find(x => x.id === sid);
        if (s) sum += s.priceKzt;
      }
    return sum;
  }, [people, salon.services]);

  // ---------- state helpers ----------
  const invalidateSlot = <T extends Partial<Draft>>(patch: T): T & { slot: null } => ({
    ...patch,
    slot: null,
  });

  const setMode = (m: Mode) => setDraft(p => ({ ...p, mode: m, slot: null }));
  const setGroupMasterId = (id: string) => setDraft(p => ({ ...p, groupMasterId: id, slot: null }));
  const setDate = (d: string) => setDraft(p => ({ ...p, date: d, slot: null }));
  const setPhone = (ph: string) => setDraft(p => ({ ...p, phone: ph }));
  const setConsent = (c: boolean) => setDraft(p => ({ ...p, consent: c }));
  const setSlot = (s: Slot | null) => setDraft(p => ({ ...p, slot: s }));

  const updatePerson = (idx: number, patch: Partial<Person>) => {
    setDraft(p => ({
      ...p,
      people: p.people.map((x, i) => (i === idx ? { ...x, ...patch } : x)),
      slot: null,
    }));
  };

  const addPerson = () => {
    setDraft(p => {
      if (p.people.length >= MAX_PEOPLE) return p;
      return {
        ...p,
        people: [...p.people, { clientName: '', masterId: '', serviceIds: [] }],
        slot: null,
      };
    });
  };

  const removePerson = (idx: number) => {
    setDraft(p => {
      if (p.people.length <= MIN_PEOPLE) return p;
      return { ...p, people: p.people.filter((_, i) => i !== idx), slot: null };
    });
  };

  const togglePersonService = (idx: number, serviceId: string) => {
    setDraft(p => ({
      ...p,
      people: p.people.map((x, i) => {
        if (i !== idx) return x;
        const has = x.serviceIds.includes(serviceId);
        return {
          ...x,
          serviceIds: has ? x.serviceIds.filter(y => y !== serviceId) : [...x.serviceIds, serviceId],
        };
      }),
      slot: null,
    }));
  };

  // ---------- load slots ----------
  const loadSlots = useCallback(async () => {
    if (step !== 2 || !date) return;
    if (!isStep1Valid) return;
    if (!uniqueMasters.length) return;

    setLoadingSlots(true);
    setError('');
    setSlots([]);

    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'widgetGetSlots');

      const results = await Promise.all(
        uniqueMasters.map(async mId => {
          let duration = 0;
          for (const p of people) {
            const pid = mode === 'same-master' ? groupMasterId : p.masterId;
            if (pid !== mId) continue;
            for (const sid of p.serviceIds) {
              const s = salon.services.find(x => x.id === sid);
              if (s) duration += s.durationMinutes;
            }
          }
          if (!duration) return { masterId: mId, slots: [] as Slot[] };
          try {
            const res = await fn({ slug, masterId: mId, date, durationMinutes: duration });
            return { masterId: mId, slots: ((res.data as { slots?: Slot[] }).slots) || [] };
          } catch {
            return { masterId: mId, slots: [] as Slot[] };
          }
        })
      );

      const sets = results.map(r => new Set(r.slots.map(s => s.start)));
      const commonStarts =
        sets.length ? [...sets[0]].filter(s => sets.every(x => x.has(s))) : [];

      const allByStart = new Map<number, Slot>();
      for (const r of results) for (const s of r.slots) allByStart.set(s.start, s);

      const commonSlots = commonStarts
        .sort((a, b) => a - b)
        .map(s => allByStart.get(s))
        .filter((s): s is Slot => !!s);

      setSlots(commonSlots);
    } catch {
      setSlots([]);
      setError('Не удалось загрузить свободное время. Попробуйте ещё раз.');
    } finally {
      setLoadingSlots(false);
    }
  }, [step, date, isStep1Valid, uniqueMasters, people, mode, groupMasterId, salon.services, slug]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  // ---------- guard: нельзя быть на шаге без данных ----------
  useEffect(() => {
    if (!hydrated) return;
    if (step >= 2 && !isStep1Valid) onStepReplace(1);
    else if (step >= 3 && !slot) onStepReplace(2);
  }, [hydrated, step, isStep1Valid, slot, onStepReplace]);

  // ---------- actions ----------
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!slot || !consent || !phone.trim()) return;
    setSubmitting(true);
    setError('');

    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'widgetCreateGroupAppointment');
      const payload = {
        slug,
        date,
        startMinutes: slot.start,
        mode,
        ...(mode === 'same-master' ? { masterId: groupMasterId } : {}),
        people: people.map(p => ({
          clientName: p.clientName.trim(),
          serviceIds: p.serviceIds,
          ...(mode === 'smart' ? { masterId: p.masterId } : {}),
        })),
        clientPhone: phone.trim(),
        consent: true,
      };
      await fn(payload);
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
      setSuccess(true);
    } catch (err) {
      const e2 = err as { code?: string; message?: string };
      const code = (e2.code || '').replace(/^functions\//, '');
      if (code === 'aborted' || e2.message?.includes('slot_taken')) {
        setError('Это время только что заняли. Выберите другое.');
        onStepChange(2);
      } else if (code === 'permission-denied') {
        setError('Онлайн-запись недоступна, позвоните в салон.');
      } else {
        setError('Ошибка: ' + (e2.message || 'неизвестная ошибка'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const max = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
  const maxDate = `${max.getFullYear()}-${String(max.getMonth() + 1).padStart(2, '0')}-${String(max.getDate()).padStart(2, '0')}`;

  const steps = ['Люди', 'Время', 'Контакты'];

  const handleBack = () => {
    if (step === 1) {
      onExit();
      return;
    }
    if (step === 2) {
      onStepChange(1);
      return;
    }
    if (step === 3) {
      onStepChange(2);
      return;
    }
  };

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl text-ink">
            ✓
          </div>
          <div className="mt-5 text-xs font-semibold uppercase tracking-[0.15em] text-muted">
            BARBER CRM
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Группа записана</h1>
          <p className="mt-3 text-base leading-6 text-muted">
            {people.length} визитов созданы. Мы свяжемся с вами для подтверждения.
          </p>
          <button
            type="button"
            onClick={onExit}
            className="mt-6 h-12 w-full rounded-xl border border-line bg-white text-base font-medium text-ink transition hover:border-ink"
          >
            Готово
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-6 pb-32">
      <div className="mx-auto w-full max-w-md">
        {/* Компактная шапка — как в одиночном flow */}
        <header className="mb-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-4 text-sm font-medium text-muted transition hover:border-ink hover:text-ink"
          >
            ← Назад
          </button>
          <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight text-ink">
            {salon.tenant.name}
          </h1>
        </header>

        <div className="mb-6 flex items-center gap-1.5">
          {steps.map((label, i) => {
            const num = i + 1;
            const active = step === num;
            const done = step > num;
            return (
              <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition',
                    active
                      ? 'bg-primary text-ink'
                      : done
                        ? 'bg-ink text-white'
                        : 'border border-line bg-white text-muted',
                  ].join(' ')}
                >
                  {done ? '✓' : num}
                </div>
                <small className={`text-xs font-medium ${active ? 'text-ink' : 'text-muted'}`}>
                  {label}
                </small>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            <b className="block font-semibold">Не получилось</b>
            <span className="mt-0.5 block">{error}</span>
          </div>
        )}

        {step === 1 && (
          <section className="space-y-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">
                Шаг 1
              </div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Кто идёт</h2>
              <p className="mt-1 text-sm text-muted">
                От 2 до 6 человек. Один телефон на всю группу.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-card p-4">
              <span className="mb-3 block text-sm font-medium text-muted">Как записать группу</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('same-master')}
                  className={
                    'rounded-xl border px-3 py-3 text-sm font-medium transition ' +
                    (mode === 'same-master'
                      ? 'border-ink bg-ink text-white'
                      : 'border-line bg-white text-muted hover:border-ink hover:text-ink')
                  }
                >
                  Один мастер
                </button>
                <button
                  type="button"
                  onClick={() => setMode('smart')}
                  className={
                    'rounded-xl border px-3 py-3 text-sm font-medium transition ' +
                    (mode === 'smart'
                      ? 'border-ink bg-ink text-white'
                      : 'border-line bg-white text-muted hover:border-ink hover:text-ink')
                  }
                >
                  Свой мастер каждому
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">
                {mode === 'same-master'
                  ? 'Все идут к одному мастеру друг за другом.'
                  : 'Каждый выбирает мастера. Стартуем одновременно, если возможно.'}
              </p>
            </div>

            {mode === 'same-master' && (
              <div className="rounded-2xl border border-line bg-card p-4">
                <span className="mb-2 block text-sm font-medium text-muted">Мастер</span>
                {sameMasterCandidates.length === 0 ? (
                  <p className="text-sm text-muted">
                    Нет мастеров, которые делают все выбранные услуги. Переключитесь на «свой
                    мастер каждому» или измените услуги.
                  </p>
                ) : (
                  <select
                    value={groupMasterId}
                    onChange={e => setGroupMasterId(e.target.value)}
                    className="h-12 w-full rounded-xl border border-line bg-card px-4 text-base text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">— выберите мастера —</option>
                    {sameMasterCandidates.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {people.map((person, idx) => (
              <PersonCard
                key={idx}
                idx={idx}
                person={person}
                salon={salon}
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
                className="h-12 w-full rounded-xl border-2 border-dashed border-primary bg-primary/5 text-base font-medium text-ink transition hover:bg-primary/10"
              >
                + Добавить человека
              </button>
            )}

            <div className="rounded-xl border border-line bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Человек в группе</span>
                <b className="text-base font-semibold text-ink">{people.length}</b>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                <span className="text-sm text-muted">Сумма</span>
                <b className="text-lg font-semibold text-ink">{money(groupTotalPrice)}</b>
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">
                Шаг 2
              </div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Дата и время</h2>
              <p className="mt-1 text-sm text-muted">
                {mode === 'same-master'
                  ? 'Подберём окно, в котором мастер примет всю группу подряд.'
                  : 'Покажем время, когда все выбранные мастера свободны одновременно.'}
              </p>
            </div>

            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-medium text-muted">Дата записи</span>
              <input
                type="date"
                min={todayString}
                max={maxDate}
                value={date}
                onChange={e => setDate(e.target.value)}
                className="h-14 w-full rounded-xl border border-line bg-card px-4 text-base text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </label>

            {loadingSlots ? (
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="sk h-[52px] rounded-xl" />
                ))}
              </div>
            ) : !date ? (
              <div className="rounded-2xl border border-line bg-card p-6 text-center text-base text-muted">
                Выберите дату
              </div>
            ) : !slots.length ? (
              <div className="rounded-2xl border border-line bg-card p-6 text-center text-base text-muted">
                Нет общего свободного времени. Попробуйте другую дату.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map(s => (
                  <button
                    key={s.start}
                    type="button"
                    onClick={() => {
                      setSlot(s);
                      onStepChange(3);
                    }}
                    className="rounded-xl border border-line bg-card px-3 py-3.5 text-base font-medium text-ink transition hover:border-primary hover:bg-primary/10"
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {step === 3 && slot && (
          <section>
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">
                Шаг 3
              </div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Контакты</h2>
              <p className="mt-1 text-sm text-muted">Один телефон на всю группу</p>
            </div>

            <div className="mb-5 space-y-2 rounded-2xl border border-line bg-card p-4 text-base">
              <div className="flex justify-between gap-4">
                <span className="shrink-0 text-sm text-muted">Человек</span>
                <b className="text-right text-base font-medium text-ink">{people.length}</b>
              </div>
              <div className="flex justify-between gap-4">
                <span className="shrink-0 text-sm text-muted">Дата и время</span>
                <b className="text-right text-base font-medium text-ink">
                  {dateRu(date)}, {slot.time}
                </b>
              </div>
              <div className="flex justify-between gap-4 border-t border-line pt-3">
                <span className="shrink-0 text-sm text-muted">Сумма</span>
                <b className="text-right text-lg font-semibold text-ink">{money(groupTotalPrice)}</b>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-muted">Телефон</span>
                <input
                  required
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+7 ___ ___ __ __"
                  className="h-14 w-full rounded-xl border border-line bg-card px-4 text-base text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-card p-4">
                <input
                  required
                  type="checkbox"
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#F4C842]"
                />
                <span className="text-sm leading-6 text-muted">
                  Согласен на обработку персональных данных
                </span>
              </label>
              <button
                type="submit"
                disabled={submitting || !consent}
                className="h-14 w-full rounded-xl bg-primary text-base font-semibold text-ink transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Отправляем…' : 'Подтвердить запись'}
              </button>
            </form>
          </section>
        )}
      </div>

      {step === 1 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto w-full max-w-md">
            <button
              type="button"
              disabled={!isStep1Valid}
              onClick={() => onStepChange(2)}
              className="h-14 w-full rounded-xl bg-primary text-base font-semibold text-ink transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Продолжить →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

type PersonCardProps = {
  idx: number;
  person: Person;
  salon: SalonData;
  mode: Mode;
  onUpdate: (idx: number, patch: Partial<Person>) => void;
  onToggleService: (idx: number, serviceId: string) => void;
  onRemove?: () => void;
};

function PersonCard({ idx, person, salon, mode, onUpdate, onToggleService, onRemove }: PersonCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [categoryId, setCategoryId] = useState(salon.categories[0]?.id || '');

  const eligibleMasters = useMemo(() => {
    if (!person.serviceIds.length) return salon.masters;
    return salon.masters.filter(m => m.serviceIds?.some(id => person.serviceIds.includes(id)));
  }, [salon.masters, person.serviceIds]);

  const services = salon.services.filter(s => s.categoryId === categoryId);

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <b className="text-sm font-semibold text-ink">Человек {idx + 1}</b>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded(x => !x)}
            className="rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-surface"
          >
            {expanded ? 'Свернуть' : 'Развернуть'}
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-lg px-2 py-1 text-xs text-red-600 transition hover:bg-red-50"
            >
              Удалить
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Имя</span>
            <input
              type="text"
              value={person.clientName}
              onChange={e => onUpdate(idx, { clientName: e.target.value })}
              placeholder="Как обращаться?"
              className="h-12 w-full rounded-xl border border-line bg-card px-3 text-base text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </label>

          {mode === 'smart' && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted">Мастер</span>
              <select
                value={person.masterId}
                onChange={e => onUpdate(idx, { masterId: e.target.value })}
                className="h-12 w-full rounded-xl border border-line bg-card px-3 text-base text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— выберите мастера —</option>
                {eligibleMasters.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted">Услуги</span>

            {salon.categories.length > 1 && (
              <div className="mb-2 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {salon.categories.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    className={
                      'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ' +
                      (categoryId === c.id
                        ? 'bg-ink text-white'
                        : 'border border-line bg-white text-muted hover:border-ink hover:text-ink')
                    }
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              {services.map(s => {
                const checked = person.serviceIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onToggleService(idx, s.id)}
                    className={
                      'flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition ' +
                      (checked ? 'border-primary' : 'border-line hover:border-ink/30')
                    }
                  >
                    <span
                      className={
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs font-bold transition ' +
                        (checked
                          ? 'border-primary bg-primary text-ink'
                          : 'border-line bg-white text-transparent')
                      }
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-sm font-semibold text-ink">{s.name}</b>
                      <small className="mt-0.5 block text-xs text-muted">
                        {s.durationMinutes} мин
                      </small>
                    </span>
                    <strong className="shrink-0 text-sm font-semibold text-ink">
                      {money(s.priceKzt)}
                    </strong>
                  </button>
                );
              })}
              {!services.length && (
                <div className="rounded-xl border border-line bg-card p-4 text-center text-sm text-muted">
                  В этой категории пока нет услуг.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}