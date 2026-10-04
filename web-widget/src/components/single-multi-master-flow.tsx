'use client';

import { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';

type Service = {
  id: string;
  name: string;
  categoryId: string;
  durationMinutes: number;
  priceKzt: number;
  iconUrl: string;
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
};

type Slot = { start: number; end: number; time: string };

type SalonData = {
  tenant: { name: string; city: string };
  categories: Category[];
  services: Service[];
  masters: Master[];
};

type Props = {
  salon: SalonData;
  slug: string;
  step: 1 | 2 | 3 | 4;
  onStepChange: (n: 1 | 2 | 3 | 4) => void;
  onStepReplace: (n: 1 | 2 | 3 | 4) => void;
  onExit: () => void;
};

type Assignment = {
  serviceId: string;
  masterId: string;
  startMinutes: number | null;
};

type Draft = {
  serviceIds: string[];
  assignments: Record<string, Assignment>;
  date: string;
  phone: string;
  name: string;
  consent: boolean;
};

type FieldError = { fieldId: string; message: string };

const money = (n: number) => n.toLocaleString('ru-RU') + ' ₸';
const dateRu = (s: string) =>
  s ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(s + 'T12:00:00Z')) : '';

function minutesToTime(m: number) {
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

export function SingleMultiMasterFlow({ salon, slug, step, onStepChange, onExit }: Props) {
  const [draft, setDraft] = useState<Draft>(() => ({
    serviceIds: [],
    assignments: {},
    date: '',
    phone: '',
    name: '',
    consent: false,
  }));

  const [categoryId, setCategoryId] = useState('');
  const [slotsByService, setSlotsByService] = useState<Record<string, Slot[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [success, setSuccess] = useState(false);

  const storageKey = 'multi_master_' + slug;

  useEffect(() => {
    if (salon.categories.length && !categoryId) {
      setCategoryId(salon.categories[0].id);
    }
  }, [salon.categories, categoryId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Draft>;
        setDraft((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {}
  }, [draft, storageKey]);

  const selectedServices = useMemo(
    () => salon.services.filter((s) => draft.serviceIds.includes(s.id)),
    [salon.services, draft.serviceIds]
  );

  const groupByMaster = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const sid of draft.serviceIds) {
      const mid = draft.assignments[sid]?.masterId;
      if (!mid) continue;
      const arr = map.get(mid) || [];
      arr.push(sid);
      map.set(mid, arr);
    }
    return map;
  }, [draft.serviceIds, draft.assignments]);

  const mastersById = useMemo(() => {
    const m = new Map<string, Master>();
    for (const x of salon.masters) m.set(x.id, x);
    return m;
  }, [salon.masters]);

  const totalPrice = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.priceKzt, 0),
    [selectedServices]
  );

  const durationOfServices = (serviceIds: string[]) =>
    serviceIds.reduce((sum, sid) => {
      const s = salon.services.find((x) => x.id === sid);
      return sum + (s?.durationMinutes || 0);
    }, 0);

  // Автозагрузка слотов для каждого мастера
  useEffect(() => {
    if (step !== 3 || !draft.date) {
      setSlotsByService({});
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoadingSlots(true);
      setError('');
      try {
        const fn = httpsCallable(getFirebaseFunctions(), 'widgetGetSlots');
        const tasks = Array.from(groupByMaster.entries()).map(async ([masterId, serviceIds]) => {
          const duration = durationOfServices(serviceIds);
          if (!duration) return { masterId, slots: [] as Slot[] };
          try {
            const res = await fn({ slug, masterId, date: draft.date, durationMinutes: duration });
            return { masterId, slots: ((res.data as { slots?: Slot[] }).slots) || [] };
          } catch {
            return { masterId, slots: [] as Slot[] };
          }
        });
        const results = await Promise.all(tasks);
        if (cancelled) return;
        const next: Record<string, Slot[]> = {};
        for (const r of results) {
          for (const sid of groupByMaster.get(r.masterId) || []) {
            next[sid] = r.slots;
          }
        }
        setSlotsByService(next);
      } catch {
        if (!cancelled) setError('Не удалось загрузить свободное время');
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    };

    void run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, draft.date, JSON.stringify(Object.entries(groupByMaster).map(([k, v]) => k + ':' + v.join(',')))]);

  const toggleService = (sid: string) => {
    setFieldError(null);
    setDraft((prev) => {
      const has = prev.serviceIds.includes(sid);
      const nextIds = has ? prev.serviceIds.filter((x) => x !== sid) : [...prev.serviceIds, sid];
      const nextAssign = { ...prev.assignments };
      if (has) delete nextAssign[sid];
      else nextAssign[sid] = { serviceId: sid, masterId: '', startMinutes: null };
      return { ...prev, serviceIds: nextIds, assignments: nextAssign };
    });
  };

  const setMaster = (sid: string, masterId: string) => {
    setFieldError(null);
    setDraft((prev) => ({
      ...prev,
      assignments: {
        ...prev.assignments,
        [sid]: { ...prev.assignments[sid], serviceId: sid, masterId, startMinutes: null },
      },
    }));
  };

  const setSlot = (sid: string, startMinutes: number) => {
    setFieldError(null);
    setDraft((prev) => ({
      ...prev,
      assignments: {
        ...prev.assignments,
        [sid]: { ...prev.assignments[sid], serviceId: sid, startMinutes },
      },
    }));
  };

  const anyConflict = useMemo(() => {
    const intervals: Array<{ start: number; end: number }> = [];
    for (const sid of draft.serviceIds) {
      const a = draft.assignments[sid];
      if (!a || a.startMinutes === null) continue;
      const dur = salon.services.find((s) => s.id === sid)?.durationMinutes || 0;
      intervals.push({ start: a.startMinutes, end: a.startMinutes + dur });
    }
    for (let i = 0; i < intervals.length; i++) {
      for (let j = i + 1; j < intervals.length; j++) {
        if (!(intervals[i].end <= intervals[j].start || intervals[i].start >= intervals[j].end)) return true;
      }
    }
    return false;
  }, [draft.serviceIds, draft.assignments, salon.services]);

  const findFirstError = (): FieldError | null => {
    if (step === 1) {
      if (draft.serviceIds.length === 0) return { fieldId: 'multi-step1', message: 'Выберите хотя бы одну услугу' };
    }
    if (step === 2) {
      for (const sid of draft.serviceIds) {
        if (!draft.assignments[sid]?.masterId) {
          const s = salon.services.find((x) => x.id === sid);
          return { fieldId: 'multi-master-' + sid, message: 'Выберите мастера для «' + (s?.name || 'услуги') + '»' };
        }
      }
    }
    if (step === 3) {
      if (!draft.date) return { fieldId: 'multi-date', message: 'Выберите дату' };
      for (const sid of draft.serviceIds) {
        if (draft.assignments[sid]?.startMinutes === null) {
          const s = salon.services.find((x) => x.id === sid);
          return { fieldId: 'multi-slot-' + sid, message: 'Выберите время для «' + (s?.name || 'услуги') + '»' };
        }
      }
      if (anyConflict) return { fieldId: 'multi-slots', message: 'Время пересекается — выберите другое' };
    }
    if (step === 4) {
      if (!draft.name.trim()) return { fieldId: 'multi-name', message: 'Введите имя' };
      if (!draft.phone.trim()) return { fieldId: 'multi-phone', message: 'Введите телефон' };
      if (!draft.consent) return { fieldId: 'multi-consent', message: 'Согласие обязательно' };
    }
    return null;
  };

  const scrollToError = (err: FieldError) => {
    setFieldError(err);
    setTimeout(() => {
      const el = document.getElementById(err.fieldId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (typeof (el as HTMLInputElement).focus === 'function') {
          (el as HTMLInputElement).focus({ preventScroll: true });
        }
      }
    }, 50);
    setTimeout(() => setFieldError(null), 6000);
  };

  const handleContinue = (next: 1 | 2 | 3 | 4) => {
    const err = findFirstError();
    if (err) { scrollToError(err); return; }
    onStepChange(next);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err = findFirstError();
    if (err) { scrollToError(err); return; }

    setSubmitting(true);
    setError('');
    try {
      const people = Array.from(groupByMaster.entries()).map(([masterId, serviceIds]) => {
        const starts = serviceIds.map((sid) => draft.assignments[sid].startMinutes as number);
        return {
          clientName: draft.name.trim(),
          masterId,
          serviceIds,
          startMinutes: Math.min(...starts),
        };
      });

      const fn = httpsCallable(getFirebaseFunctions(), 'widgetCreateGroupAppointment');
      await fn({
        slug,
        date: draft.date,
        startMinutes: 0,
        mode: 'smart',
        people,
        clientPhone: draft.phone.trim(),
        consent: true,
      });
      try { sessionStorage.removeItem(storageKey); } catch {}
      setSuccess(true);
    } catch (err) {
      const e2 = err as { code?: string; message?: string };
      const code = (e2.code || '').replace(/^functions\//, '');
      if (code === 'aborted' || e2.message?.includes('slot_taken')) {
        setError('Один из слотов только что заняли. Выберите время заново.');
        onStepChange(3);
      } else if (code === 'resource-exhausted') {
        setError('Слишком много попыток записи. Попробуйте через час или позвоните в салон.');
        onStepChange(3);
      } else if (code === 'permission-denied') {
        setError('Онлайн-запись недоступна, позвоните в салон.');
      } else setError('Ошибка: ' + (e2.message || 'неизвестная'));
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date();
  const todayString = today.toISOString().slice(0, 10);
  const maxDate = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);

  const ring = (id: string) =>
    fieldError?.fieldId === id ? ' ring-2 ring-red-500 ring-offset-1' : '';

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl text-ink">✓</div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink">Запись отправлена</h1>
          <p className="mt-3 text-base leading-6 text-muted">Отлично! Мы свяжемся с вами для подтверждения.</p>
          <button type="button" onClick={onExit} className="mt-6 h-12 w-full rounded-xl border border-line bg-white text-base font-medium text-ink transition hover:border-ink">Готово</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-6 pb-32">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-6 flex items-center justify-between gap-3">
          <button type="button" onClick={() => {
            if (step === 1) onExit();
            else onStepChange((step - 1) as 1 | 2 | 3 | 4);
          }} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-4 text-sm font-medium text-muted transition hover:border-ink hover:text-ink">← Назад</button>
          <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight text-ink">{salon.tenant.name}</h1>
        </header>

        <div className="mb-6 flex items-center gap-1.5">
          {['Услуги', 'Мастера', 'Время', 'Контакты'].map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3 | 4;
            const active = step === n;
            const done = step > n;
            return (
              <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
                <div className={['flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition', active ? 'bg-primary text-ink' : done ? 'bg-ink text-white' : 'border border-line bg-white text-muted'].join(' ')}>{done ? '✓' : n}</div>
                <small className={`text-xs font-medium ${active ? 'text-ink' : 'text-muted'}`}>{label}</small>
              </div>
            );
          })}
        </div>

        {fieldError && (
          <div className="sticky top-2 z-30 mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800 shadow-sm">
            ⚠ {fieldError.message}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            <b className="block font-semibold">Не получилось</b>
            <span className="mt-0.5 block">{error}</span>
          </div>
        )}

        {step === 1 && (
          <section id="multi-step1" className={'rounded-2xl' + ring('multi-step1')}>
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">Шаг 1</div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Выберите услуги</h2>
              <p className="mt-1 text-sm text-muted">Можно несколько. Дальше выберете мастера под каждую.</p>
            </div>

            <div className="mb-3 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {salon.categories.map((c) => (
                <button key={c.id} type="button" onClick={() => setCategoryId(c.id)}
                  className={['flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition', categoryId === c.id ? 'bg-ink text-white' : 'border border-line bg-white text-muted hover:border-ink hover:text-ink'].join(' ')}>
                  {c.iconUrl && <img src={c.iconUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />}
                  {c.name}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {salon.services.filter((s) => s.categoryId === categoryId).map((s) => {
                const checked = draft.serviceIds.includes(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => toggleService(s.id)}
                    className={['flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition', checked ? 'border-primary shadow-sm' : 'border-line hover:border-ink/30'].join(' ')}>
                    <span className={['flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition', checked ? 'border-primary bg-primary text-ink' : 'border-line bg-white text-transparent'].join(' ')}>✓</span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-base font-semibold text-ink">{s.name}</b>
                      <small className="mt-0.5 block text-sm text-muted">{s.durationMinutes} мин</small>
                    </span>
                    <strong className="shrink-0 text-base font-semibold text-ink">{money(s.priceKzt)}</strong>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">Шаг 2</div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Кто вас обслужит</h2>
              <p className="mt-1 text-sm text-muted">Выберите мастера для каждой услуги.</p>
            </div>

            <div className="space-y-3">
              {selectedServices.map((s) => {
                const eligible = salon.masters.filter((m) => m.serviceIds?.includes(s.id));
                const selected = draft.assignments[s.id]?.masterId || '';
                return (
                  <div key={s.id} id={'multi-master-' + s.id} className={'rounded-2xl border border-line bg-card p-4' + ring('multi-master-' + s.id)}>
                    <b className="block text-base font-semibold text-ink">{s.name}</b>
                    <small className="mt-0.5 block text-sm text-muted">{s.durationMinutes} мин · {money(s.priceKzt)}</small>
                    <select value={selected} onChange={(e) => setMaster(s.id, e.target.value)}
                      className="mt-3 h-12 w-full rounded-xl border border-line bg-surface px-4 text-base text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30">
                      <option value="">— выберите мастера —</option>
                      {eligible.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">Шаг 3</div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Выберите время</h2>
              <p className="mt-1 text-sm text-muted">Услуги у разных мастеров — время выбираете отдельно.</p>
            </div>

            <label className="mb-5 block">
              <span className="mb-2 block text-sm font-medium text-muted">Дата записи</span>
              <input id="multi-date" type="date" min={todayString} max={maxDate} value={draft.date}
                onChange={(e) => {
                  setFieldError(null);
                  setDraft((prev) => {
                    const nextAssign = { ...prev.assignments };
                    for (const sid of Object.keys(nextAssign)) {
                      nextAssign[sid] = { ...nextAssign[sid], startMinutes: null };
                    }
                    return { ...prev, date: e.target.value, assignments: nextAssign };
                  });
                }}
                className={'h-14 w-full rounded-xl border border-line bg-card px-4 text-base text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30' + ring('multi-date')} />
            </label>

            {!draft.date ? (
              <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-muted">Выберите дату</p>
            ) : loadingSlots ? (
              <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-muted">Загружаем свободное время…</p>
            ) : (
              <div id="multi-slots" className={'space-y-4' + ring('multi-slots')}>
                {selectedServices.map((s) => {
                  const a = draft.assignments[s.id];
                  const m = a ? mastersById.get(a.masterId) : null;
                  const slots = slotsByService[s.id] || [];
                  const isErr = fieldError?.fieldId === 'multi-slot-' + s.id;
                  return (
                    <div key={s.id} id={'multi-slot-' + s.id} className={'rounded-2xl border border-line bg-card p-4' + (isErr ? ' ring-2 ring-red-500 ring-offset-1' : '')}>
                      <b className="block text-base font-semibold text-ink">{s.name}</b>
                      <small className="mt-0.5 block text-sm text-muted">у {m?.name || '—'}</small>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {slots.length === 0 ? (
                          <span className="text-sm text-muted">Нет свободного времени</span>
                        ) : (
                          slots.map((slot) => {
                            const active = a?.startMinutes === slot.start;
                            return (
                              <button key={slot.start} type="button" onClick={() => setSlot(s.id, slot.start)}
                                className={['rounded-lg border px-4 py-2 text-sm font-medium transition', active ? 'border-primary bg-primary text-ink' : 'border-line bg-surface text-ink hover:border-primary'].join(' ')}>
                                {slot.time}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {step === 4 && (
          <section>
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">Шаг 4</div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Ваши контакты</h2>
            </div>

            <div className="mb-5 space-y-3 rounded-2xl border border-line bg-card p-4 text-base">
              {selectedServices.map((s) => {
                const a = draft.assignments[s.id];
                const m = a ? mastersById.get(a.masterId) : null;
                const t = a?.startMinutes !== null && a?.startMinutes !== undefined ? minutesToTime(a.startMinutes) : '—';
                return (
                  <div key={s.id} className="flex justify-between gap-4 border-b border-line pb-2 last:border-0">
                    <div className="min-w-0">
                      <b className="block truncate text-sm font-medium text-ink">{s.name}</b>
                      <small className="block text-xs text-muted">{m?.name || '—'} · {t}</small>
                    </div>
                    <span className="shrink-0 text-sm text-ink">{money(s.priceKzt)}</span>
                  </div>
                );
              })}
              <div className="flex justify-between gap-4 pt-2">
                <span className="shrink-0 text-sm text-muted">Дата</span>
                <b className="text-right text-base font-medium text-ink">{dateRu(draft.date)}</b>
              </div>
              <div className="flex justify-between gap-4 border-t border-line pt-3">
                <span className="shrink-0 text-sm text-muted">Итого</span>
                <b className="text-right text-lg font-semibold text-ink">{money(totalPrice)}</b>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-muted">Имя</span>
                <input id="multi-name" value={draft.name} onChange={(e) => { setFieldError(null); setDraft((p) => ({ ...p, name: e.target.value })); }}
                  placeholder="Как к вам обращаться?"
                  className={'h-14 w-full rounded-xl border border-line bg-card px-4 text-base text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30' + ring('multi-name')} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-muted">Телефон</span>
                <input id="multi-phone" type="tel" value={draft.phone} onChange={(e) => { setFieldError(null); setDraft((p) => ({ ...p, phone: e.target.value })); }}
                  placeholder="+7 ___ ___ __ __"
                  className={'h-14 w-full rounded-xl border border-line bg-card px-4 text-base text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30' + ring('multi-phone')} />
              </label>
              <label id="multi-consent" className={'flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-card p-4' + ring('multi-consent')}>
                <input type="checkbox" checked={draft.consent} onChange={(e) => { setFieldError(null); setDraft((p) => ({ ...p, consent: e.target.checked })); }}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#F4C842]" />
                <span className="text-sm leading-6 text-muted">Согласен на обработку персональных данных</span>
              </label>
              <button type="submit"
                className="h-14 w-full rounded-xl bg-primary text-base font-semibold text-ink transition hover:bg-primary-hover">
                {submitting ? 'Отправляем…' : 'Записаться'}
              </button>
            </form>
          </section>
        )}
      </div>

      {step === 1 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto w-full max-w-md">
            <button type="button" onClick={() => handleContinue(2)}
              className="h-14 w-full rounded-xl bg-primary text-base font-semibold text-ink transition hover:bg-primary-hover">
              Продолжить →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto w-full max-w-md">
            <button type="button" onClick={() => handleContinue(3)}
              className="h-14 w-full rounded-xl bg-primary text-base font-semibold text-ink transition hover:bg-primary-hover">
              Продолжить →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto w-full max-w-md">
            <button type="button" onClick={() => handleContinue(4)}
              className="h-14 w-full rounded-xl bg-primary text-base font-semibold text-ink transition hover:bg-primary-hover">
              Продолжить →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
