'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';
import { BookSkeleton } from '@/components/book-skeleton';
import { GroupBookingFlow } from '@/components/group-booking-flow';

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

const ANY_MASTER = '__any__';

const money = (n: number) => n.toLocaleString('ru-RU') + ' ₸';
const rating = (n: number, count: number) =>
  count ? `★ ${n.toFixed(1)} · ${count}` : 'Пока нет отзывов';
const dateRu = (s: string) =>
  s
    ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(
        new Date(s + 'T12:00:00Z')
      )
    : '';

function BookingModeSelector({
  onSelect,
  salonName,
}: {
  onSelect: (mode: 'single' | 'group') => void;
  salonName: string;
}) {
  return (
    <main className="min-h-screen bg-surface px-4 py-6">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">
            Онлайн-запись
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">{salonName}</h1>
          <p className="mt-1 text-sm text-muted">Как вы хотите записаться?</p>
        </header>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => onSelect('single')}
            className="flex w-full items-start gap-4 rounded-2xl border border-line bg-card p-5 text-left transition hover:border-primary"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-2xl text-ink">
              👤
            </div>
            <div className="min-w-0 flex-1">
              <b className="block text-base font-semibold text-ink">Записать одного</b>
              <span className="mt-1 block text-sm text-muted">Обычная запись для себя</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelect('group')}
            className="flex w-full items-start gap-4 rounded-2xl border-2 border-primary bg-primary/5 p-5 text-left transition hover:bg-primary/10"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-2xl text-ink">
              👨‍👩‍👧
            </div>
            <div className="min-w-0 flex-1">
              <b className="block text-base font-semibold text-ink">
                Записать нескольких (2–6)
              </b>
              <span className="mt-1 block text-sm text-muted">
                Семья или друзья. Один телефон на всех.
              </span>
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}

type Draft = {
  categoryId: string;
  serviceIds: string[];
  masterId: string;
  assignedMasterId: string;
  date: string;
  slot: Slot | null;
  name: string;
  phone: string;
  consent: boolean;
};

const EMPTY_DRAFT: Draft = {
  categoryId: '',
  serviceIds: [],
  masterId: '',
  assignedMasterId: '',
  date: '',
  slot: null,
  name: '',
  phone: '',
  consent: false,
};

function parseStep(raw: string | null): 1 | 2 | 3 | 4 {
  const n = Number(raw);
  if (n === 2 || n === 3 || n === 4) return n;
  return 1;
}

function BookingFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const slug = searchParams.get('slug') || '';
  const step = parseStep(searchParams.get('step'));
  const modeParam = searchParams.get('mode');
  const mode: 'single' | 'group' | null =
    modeParam === 'single' || modeParam === 'group' ? modeParam : null;

  const [salon, setSalon] = useState<SalonData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'not_found' | 'gone'>('loading');
  const [success, setSuccess] = useState(false);

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const hydratedRef = useRef(false);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const storageKey = 'book_draft_' + slug;

  // ---------- URL helpers ----------
  const pushURL = useCallback(
    (next: { step?: number; mode?: 'single' | 'group' | null }) => {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      if (next.step !== undefined) {
        if (next.step === 1) params.delete('step');
        else params.set('step', String(next.step));
      }
      if (next.mode !== undefined) {
        if (next.mode === null) params.delete('mode');
        else params.set('mode', next.mode);
      }
      const qs = params.toString();
      router.push('/book' + (qs ? '?' + qs : ''), { scroll: false });
    },
    [router, searchParams]
  );

  const goToStep = useCallback(
    (n: 1 | 2 | 3 | 4) => {
      if (step === n) return;
      pushURL({ step: n });
    },
    [pushURL, step]
  );

  // ---------- Back handler ----------
  const handleBack = useCallback(() => {
    if (step === 1) {
      pushURL({ mode: null, step: 1 });
      return;
    }
    if (step === 2) { goToStep(1); return; }
    if (step === 3) { goToStep(2); return; }
    if (step === 4) { goToStep(3); return; }
  }, [step, pushURL, goToStep]);

  // ---------- sessionStorage hydration ----------
  useEffect(() => {
    if (hydratedRef.current) return;
    if (typeof window === 'undefined' || !slug) return;
    hydratedRef.current = true;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Draft>;
      setDraft((prev) => ({ ...prev, ...parsed }));
    } catch {
      /* ignore */
    }
  }, [slug, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !slug) return;
    if (!hydratedRef.current) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft, slug, storageKey]);

  // ---------- Load salon ----------
  useEffect(() => {
    if (!slug) {
      setStatus('not_found');
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const fn = httpsCallable(getFirebaseFunctions(), 'widgetGetSalon');
        const response = await fn({ slug });
        if (cancelled) return;
        const result = response.data as {
          status: string;
          newSlug?: string;
          tenant?: SalonData['tenant'];
          categories?: Category[];
          services?: Service[];
          masters?: Master[];
        };
        if (result.status === 'redirect' && result.newSlug) {
          router.push('/book?slug=' + encodeURIComponent(result.newSlug));
          return;
        }
        if (result.status === 'not_found' || result.status === 'gone') {
          setStatus(result.status);
          return;
        }
        if (result.status !== 'ok' || !result.tenant) {
          setStatus('not_found');
          return;
        }
        setSalon({
          tenant: result.tenant,
          categories: result.categories || [],
          services: result.services || [],
          masters: result.masters || [],
        });
        setStatus('ok');
      } catch {
        if (!cancelled) setStatus('not_found');
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, router]);

  useEffect(() => {
    if (salon?.categories.length && !draft.categoryId) {
      setDraft((prev) => ({ ...prev, categoryId: salon.categories[0].id }));
    }
  }, [salon, draft.categoryId]);

  const eligibleMasters = useMemo(() => {
    if (!salon) return [];
    return salon.masters.filter((m) =>
      m.serviceIds?.some((id) => draft.serviceIds.includes(id))
    );
  }, [salon, draft.serviceIds]);

  // ---------- Load slots ----------
  const loadSlots = useCallback(async () => {
    if (step !== 3 || !slug || !draft.masterId || !draft.date || !salon) return;
    const duration = draft.serviceIds.reduce(
      (sum, id) => sum + (salon.services.find((s) => s.id === id)?.durationMinutes || 0),
      0
    );
    if (!duration) {
      setSlots([]);
      return;
    }

    setLoadingSlots(true);
    setError('');
    setSlots([]);

    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'widgetGetSlots');

      if (draft.masterId !== ANY_MASTER) {
        const response = await fn({
          slug,
          masterId: draft.masterId,
          date: draft.date,
          durationMinutes: duration,
        });
        const raw = ((response.data as { slots?: Slot[] }).slots) || [];
        setSlots(raw);
        setDraft((prev) => ({ ...prev, assignedMasterId: draft.masterId }));
      } else {
        const results = await Promise.all(
          eligibleMasters.map(async (m) => {
            try {
              const response = await fn({
                slug,
                masterId: m.id,
                date: draft.date,
                durationMinutes: duration,
              });
              return {
                masterId: m.id,
                slots: ((response.data as { slots?: Slot[] }).slots) || [],
              };
            } catch {
              return { masterId: m.id, slots: [] as Slot[] };
            }
          })
        );

        const byStart = new Map<number, Slot>();
        results.forEach((r) => {
          r.slots.forEach((s) => {
            if (!byStart.has(s.start)) byStart.set(s.start, s);
          });
        });
        setSlots(Array.from(byStart.values()).sort((a, b) => a.start - b.start));
        setDraft((prev) => ({ ...prev, assignedMasterId: '' }));
      }
    } catch {
      setSlots([]);
      setError('Не удалось загрузить свободное время. Попробуйте ещё раз.');
    } finally {
      setLoadingSlots(false);
    }
  }, [step, slug, draft.masterId, draft.date, draft.serviceIds, salon, eligibleMasters]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  // ---------- Guard jumps ----------
  useEffect(() => {
    if (status !== 'ok' || !salon) return;
    if (mode === null || mode === 'group') return;
    if (step >= 2 && draft.serviceIds.length === 0) goToStep(1);
    else if (step >= 3 && !draft.masterId) goToStep(2);
    else if (step >= 4 && (!draft.date || !draft.slot)) goToStep(3);
  }, [status, salon, mode, step, draft.serviceIds.length, draft.masterId, draft.date, draft.slot, goToStep]);

  // ---------- Actions ----------
  const toggleService = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(id)
        ? prev.serviceIds.filter((x) => x !== id)
        : [...prev.serviceIds, id],
      masterId: '',
      assignedMasterId: '',
      date: '',
      slot: null,
    }));
  };

  const pickMaster = (id: string) => {
    setDraft((prev) => ({ ...prev, masterId: id, slot: null, assignedMasterId: '' }));
    goToStep(3);
  };

  const pickSlot = async (chosen: Slot) => {
    if (draft.masterId === ANY_MASTER) {
      const duration = draft.serviceIds.reduce(
        (sum, id) =>
          sum + (salon?.services.find((s) => s.id === id)?.durationMinutes || 0),
        0
      );
      const fn = httpsCallable(getFirebaseFunctions(), 'widgetGetSlots');
      let foundId = '';
      for (const m of eligibleMasters) {
        try {
          const response = await fn({
            slug,
            masterId: m.id,
            date: draft.date,
            durationMinutes: duration,
          });
          const list = ((response.data as { slots?: Slot[] }).slots) || [];
          if (list.some((s) => s.start === chosen.start)) {
            foundId = m.id;
            break;
          }
        } catch {
          /* next */
        }
      }
      setDraft((prev) => ({
        ...prev,
        slot: chosen,
        assignedMasterId: foundId || eligibleMasters[0]?.id || '',
      }));
    } else {
      setDraft((prev) => ({ ...prev, slot: chosen }));
    }
    goToStep(4);
  };

  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const max = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
  const maxDate = `${max.getFullYear()}-${String(max.getMonth() + 1).padStart(2, '0')}-${String(max.getDate()).padStart(2, '0')}`;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const finalMasterId = draft.masterId === ANY_MASTER ? draft.assignedMasterId : draft.masterId;
    if (!slug || !draft.slot || !draft.consent || !finalMasterId) return;
    setSubmitting(true);
    setError('');
    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'widgetCreateAppointment');
      await fn({
        slug,
        masterId: finalMasterId,
        serviceIds: draft.serviceIds,
        date: draft.date,
        startMinutes: draft.slot.start,
        clientName: draft.name,
        clientPhone: draft.phone,
        consent: draft.consent,
      });
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
        goToStep(3);
      } else if (code === 'permission-denied') {
        setError('Онлайн-запись недоступна, позвоните в салон.');
      } else setError('Ошибка: ' + (e2.message || 'неизвестная ошибка'));
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Render ----------
  if (status === 'loading') return <BookSkeleton />;

  if (status === 'gone') {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 text-center">
          <b className="block text-lg text-ink">Салон больше не принимает записи</b>
          <span className="mt-2 block text-base text-muted">
            Пожалуйста, свяжитесь с салоном напрямую.
          </span>
        </div>
      </main>
    );
  }

  if (status !== 'ok' || !salon) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 text-center">
          <b className="block text-lg text-ink">Салон не найден</b>
          <span className="mt-2 block text-base text-muted">Проверьте ссылку на запись.</span>
        </div>
      </main>
    );
  }

  if (mode === null) {
    return (
      <BookingModeSelector
        onSelect={(m) => pushURL({ mode: m, step: 1 })}
        salonName={salon.tenant.name}
      />
    );
  }

  if (mode === 'group') {
    return (
      <GroupBookingFlow
        salon={salon}
        slug={slug}
        onExit={() => pushURL({ mode: null, step: 1 })}
      />
    );
  }

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
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
            Запись отправлена
          </h1>
          <p className="mt-3 text-base leading-6 text-muted">
            Отлично! Мы свяжемся с вами для подтверждения записи.
          </p>
        </div>
      </main>
    );
  }

  const selectedMaster = salon.masters.find((m) => m.id === draft.masterId);
  const assignedMaster = salon.masters.find((m) => m.id === draft.assignedMasterId);
  const services = salon.services.filter((s) => s.categoryId === draft.categoryId);
  const selectedServices = salon.services.filter((s) => draft.serviceIds.includes(s.id));
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.priceKzt, 0);
  const steps = ['Услуги', 'Мастер', 'Время', 'Контакты'];

  return (
    <main className="min-h-screen bg-surface px-4 py-6 pb-32">
      <div className="mx-auto w-full max-w-md">
                {/* Компактная шапка: назад слева, название справа */}
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
            const n = (i + 1) as 1 | 2 | 3 | 4;
            const active = step === n;
            const done = step > n;
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
                  {done ? '✓' : n}
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
          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">
                  Шаг 1
                </div>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                  Выберите услуги
                </h2>
                <p className="mt-1 text-sm text-muted">Можно несколько</p>
              </div>
              {draft.serviceIds.length > 0 && (
                <strong className="text-lg font-semibold text-ink">{money(totalPrice)}</strong>
              )}
            </div>

            <div className="mb-3 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {salon.categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, categoryId: c.id }))}
                  className={[
                    'flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition',
                    draft.categoryId === c.id
                      ? 'bg-ink text-white'
                      : 'border border-line bg-white text-muted hover:border-ink hover:text-ink',
                  ].join(' ')}
                >
                  {c.iconUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.iconUrl}
                      alt=""
                      className="h-5 w-5 shrink-0 rounded-full object-cover"
                    />
                  )}
                  {c.name}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {services.map((s) => {
                const checked = draft.serviceIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.id)}
                    className={[
                      'flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition',
                      checked ? 'border-primary shadow-sm' : 'border-line hover:border-ink/30',
                    ].join(' ')}
                  >
                    {s.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.iconUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className={[
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition',
                          checked
                            ? 'border-primary bg-primary text-ink'
                            : 'border-line bg-white text-transparent',
                        ].join(' ')}
                      >
                        ✓
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-base font-semibold text-ink">
                        {s.name}
                      </b>
                      <small className="mt-0.5 block text-sm text-muted">
                        {s.durationMinutes} мин
                      </small>
                    </span>
                    <strong className="shrink-0 text-base font-semibold text-ink">
                      {money(s.priceKzt)}
                    </strong>
                  </button>
                );
              })}
              {!services.length && (
                <div className="rounded-2xl border border-line bg-card p-6 text-center text-base text-muted">
                  В этой категории пока нет услуг.
                </div>
              )}
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">
                Шаг 2
              </div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                Выберите мастера
              </h2>
              <p className="mt-1 text-sm text-muted">
                Кто будет выполнять выбранные услуги
              </p>
            </div>
            <div className="space-y-2">
              {eligibleMasters.length > 0 && (
                <button
                  type="button"
                  onClick={() => pickMaster(ANY_MASTER)}
                  className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-primary/5 p-4 text-left transition hover:bg-primary/10"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-2xl text-ink">
                    ⋯
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-base font-semibold text-ink">Не важно</b>
                    <small className="mt-0.5 block text-sm text-muted">
                      Подберём свободного мастера
                    </small>
                  </span>
                  <i className="shrink-0 text-lg text-muted not-italic">→</i>
                </button>
              )}

              {eligibleMasters.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => pickMaster(m.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-4 text-left transition hover:border-ink/30"
                >
                  {m.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.photoUrl}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface text-lg font-semibold text-muted">
                      {m.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-base font-semibold text-ink">
                      {m.name}
                    </b>
                    <small className="mt-0.5 block text-sm text-muted">
                      {rating(m.rating || 0, m.ratingCount || 0)}
                    </small>
                  </span>
                  <i className="shrink-0 text-lg text-muted not-italic">→</i>
                </button>
              ))}

              {!eligibleMasters.length && (
                <div className="rounded-2xl border border-line bg-card p-6 text-center text-base text-muted">
                  Нет доступных мастеров для выбранных услуг.
                </div>
              )}
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">
                Шаг 3
              </div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                Дата и время
              </h2>
              <p className="mt-1 text-sm text-muted">
                {draft.masterId === ANY_MASTER
                  ? 'Показываем время у всех свободных мастеров'
                  : selectedMaster?.name || 'Выберите удобное время'}
              </p>
            </div>

            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-medium text-muted">Дата записи</span>
              <input
                type="date"
                min={todayString}
                max={maxDate}
                value={draft.date}
                onChange={(e) => {
                  setDraft((prev) => ({ ...prev, date: e.target.value, slot: null }));
                }}
                className="h-14 w-full rounded-xl border border-line bg-card px-4 text-base text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </label>

            {loadingSlots ? (
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                  <div key={i} className="sk h-[52px] rounded-xl" />
                ))}
              </div>
            ) : draft.date ? (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((s) => (
                  <button
                    key={s.start}
                    type="button"
                    onClick={() => void pickSlot(s)}
                    className="rounded-xl border border-line bg-card px-3 py-3.5 text-base font-medium text-ink transition hover:border-primary hover:bg-primary/10"
                  >
                    {s.time}
                  </button>
                ))}
                {!slots.length && (
                  <div className="col-span-3 rounded-2xl border border-line bg-card p-6 text-center text-base text-muted">
                    Свободного времени нет.
                  </div>
                )}
              </div>
            ) : null}
          </section>
        )}

        {step === 4 && draft.slot && (
          <section>
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">
                Шаг 4
              </div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                Ваши контакты
              </h2>
              <p className="mt-1 text-sm text-muted">
                Укажите данные для подтверждения записи
              </p>
            </div>

            <div className="mb-5 space-y-3 rounded-2xl border border-line bg-card p-4 text-base">
              <div className="flex justify-between gap-4">
                <span className="shrink-0 text-sm text-muted">Услуги</span>
                <b className="text-right text-base font-medium text-ink">
                  {selectedServices.map((s) => s.name).join(', ')}
                </b>
              </div>
              <div className="flex justify-between gap-4">
                <span className="shrink-0 text-sm text-muted">Мастер</span>
                <b className="text-right text-base font-medium text-ink">
                  {draft.masterId === ANY_MASTER
                    ? assignedMaster
                      ? `${assignedMaster.name} (любой)`
                      : 'Любой доступный'
                    : selectedMaster?.name}
                </b>
              </div>
              <div className="flex justify-between gap-4">
                <span className="shrink-0 text-sm text-muted">Дата и время</span>
                <b className="text-right text-base font-medium text-ink">
                  {dateRu(draft.date)}, {draft.slot.time}
                </b>
              </div>
              <div className="flex justify-between gap-4 border-t border-line pt-3">
                <span className="shrink-0 text-sm text-muted">Стоимость</span>
                <b className="text-right text-lg font-semibold text-ink">
                  {money(totalPrice)}
                </b>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-muted">Имя</span>
                <input
                  required
                  value={draft.name}
                  onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Как к вам обращаться?"
                  className="h-14 w-full rounded-xl border border-line bg-card px-4 text-base text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-muted">Телефон</span>
                <input
                  required
                  type="tel"
                  value={draft.phone}
                  onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+7 ___ ___ __ __"
                  className="h-14 w-full rounded-xl border border-line bg-card px-4 text-base text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-card p-4">
                <input
                  required
                  type="checkbox"
                  checked={draft.consent}
                  onChange={(e) => setDraft((prev) => ({ ...prev, consent: e.target.checked }))}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#F4C842]"
                />
                <span className="text-sm leading-6 text-muted">
                  Согласен на обработку персональных данных
                </span>
              </label>
              <button
                type="submit"
                disabled={submitting || !draft.consent}
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
              disabled={!draft.serviceIds.length}
              onClick={() => goToStep(2)}
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

export default function BookPage() {
  return (
    <Suspense fallback={<BookSkeleton />}>
      <BookingFlow />
    </Suspense>
  );
}