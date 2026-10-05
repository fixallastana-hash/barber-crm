'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';
import { BookSkeleton } from '@/components/book-skeleton';
import { GroupBookingFlow } from '@/components/group-booking-flow';
import { SingleMultiMasterFlow } from '@/components/single-multi-master-flow';

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

type Branch = { id: string; name: string; address: string; city: string };

type SalonData = {
  tenant: { name: string; city: string; logoUrl?: string; bannerUrl?: string };
  branches: Branch[];
  categories: Category[];
  services: Service[];
  masters: Master[];
};

const ANY_MASTER = '__any__';

const money = (n: number) => n.toLocaleString('ru-RU') + ' ₸';
const rating = (n: number, count: number) =>
  count ? `★ ${n.toFixed(1)} (${count})` : 'Новый специалист';

const dateRu = (s: string) =>
  s
    ? new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' }).format(
        new Date(s + 'T12:00:00Z')
      )
    : '';

/* =========================================================================
   ВХОД / ВЫБОР РЕЖИМА ЗАПИСИ
   ========================================================================= */
function BookingModeSelector({
  onSelect,
  salonName,
  logoUrl,
  branches,
  selectedBranchId,
  onBranchChange,
}: {
  onSelect: (mode: 'single' | 'group' | 'multi') => void;
  salonName: string;
  logoUrl: string;
  branches: Branch[];
  selectedBranchId: string;
  onBranchChange: (id: string) => void;
}) {
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const selectedBranch = branches.find((b) => b.id === selectedBranchId) || branches[0] || null;
  const hasMultipleBranches = branches.length > 1;

  return (
    <main className="min-h-screen bg-surface">
      <div className="mx-auto w-full max-w-md pb-8">
        <header className="mb-6 flex items-start justify-between gap-3 px-4 pt-6">
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              {salonName}
            </h1>
          </div>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={salonName}
              className="h-12 w-12 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-bold text-card">
              {salonName.charAt(0).toUpperCase() || 'B'}
            </div>
          )}
        </header>

        {/* Блок филиала */}
        <div className="px-4 pb-4">
          {selectedBranch && (
            <button
              type="button"
              onClick={() => hasMultipleBranches && setBranchModalOpen(true)}
              disabled={!hasMultipleBranches}
              className="block w-full text-left"
            >
              <div className="flex items-start gap-2">
                <h2 className="text-lg font-bold tracking-tight text-ink">
                  {selectedBranch.name}
                </h2>
                {hasMultipleBranches && (
                  <span className="mt-1 text-xs text-primary font-semibold">
                    (изменить ▾)
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {selectedBranch.address}
                {selectedBranch.city ? `, ${selectedBranch.city}` : ''}
              </p>
            </button>
          )}
        </div>

        {/* Карточки режимов записи */}
        <div className="space-y-3 px-4 pt-3">
          <button
            type="button"
            onClick={() => onSelect('single')}
            className="flex w-full items-start gap-4 rounded-2xl border border-line bg-card p-4 text-left transition hover:border-primary shadow-sm active:scale-[0.98]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface text-primary border border-line text-xl">
              👤
            </div>
            <div className="min-w-0 flex-1">
              <b className="block text-base font-semibold text-ink">Записаться на стрижку</b>
              <span className="mt-0.5 block text-xs text-muted">Индивидуальная запись для себя</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelect('group')}
            className="flex w-full items-start gap-4 rounded-2xl border-2 border-primary bg-primary/5 p-4 text-left transition hover:bg-primary/10 shadow-sm active:scale-[0.98]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white text-xl">
              👨‍👦
            </div>
            <div className="min-w-0 flex-1">
              <b className="block text-base font-semibold text-ink">
                Записать двоих или семью (2–6)
              </b>
              <span className="mt-0.5 block text-xs text-muted">
                Отец + сын или друзья. Один телефон для связи.
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelect('multi')}
            className="flex w-full items-start gap-4 rounded-2xl border border-line bg-card p-4 text-left transition hover:border-primary shadow-sm active:scale-[0.98]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface text-primary border border-line text-xl">
              ✨
            </div>
            <div className="min-w-0 flex-1">
              <b className="block text-base font-semibold text-ink">
                Разные мастера
              </b>
              <span className="mt-0.5 block text-xs text-muted">
                Комплекс у разных специалистов (стрижка + борода / уход)
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Модалка филиала */}
      {branchModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => setBranchModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-surface p-5 pb-8 sm:rounded-3xl sm:pb-5 border border-line shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">Выберите филиал</h3>
              <button
                type="button"
                onClick={() => setBranchModalOpen(false)}
                className="h-8 w-8 rounded-full border border-line flex items-center justify-center text-muted hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              {branches.map((b) => {
                const active = b.id === selectedBranchId;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      onBranchChange(b.id);
                      setBranchModalOpen(false);
                    }}
                    className={
                      'flex w-full items-start gap-3 rounded-2xl border-2 bg-card p-4 text-left transition ' +
                      (active ? 'border-primary shadow-md' : 'border-line hover:border-ink/30')
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <b className="block text-base font-semibold text-ink">{b.name}</b>
                      <span className="mt-0.5 block text-xs text-muted">
                        {b.address}
                        {b.city ? `, ${b.city}` : ''}
                      </span>
                    </div>
                    {active && <span className="mt-1 shrink-0 text-base text-primary font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
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
  consent: true, // Default to true for faster UX
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
  const mode: 'single' | 'group' | 'multi' | null =
    modeParam === 'single' || modeParam === 'group' || modeParam === 'multi' ? modeParam : null;

  const [salon, setSalon] = useState<SalonData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'not_found' | 'gone'>('loading');
  const [success, setSuccess] = useState(false);

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const hydratedRef = useRef(false);

  const [selectedBranchId, setSelectedBranchId] = useState('');

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState<{ fieldId: string; message: string } | null>(null);

  const storageKey = 'book_draft_' + slug;

  // ---------- URL helpers ----------
  const pushURL = useCallback(
    (
      next: { step?: number; mode?: 'single' | 'group' | 'multi' | null },
      opts?: { replace?: boolean }
    ) => {
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
      const url = '/book' + (qs ? '?' + qs : '');
      if (opts?.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
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

  const handleBack = useCallback(() => {
    if (step === 1) {
      pushURL({ mode: null, step: 1 });
      return;
    }
    if (step === 2) { goToStep(1); return; }
    if (step === 3) { goToStep(2); return; }
    if (step === 4) { goToStep(3); return; }
  }, [step, pushURL, goToStep]);

  // ---------- SessionStorage hydration ----------
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
          branches?: Branch[];
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
          branches: result.branches || [],
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

  // Default category
  useEffect(() => {
    if (salon?.categories.length && !draft.categoryId) {
      setDraft((prev) => ({ ...prev, categoryId: salon.categories[0].id }));
    }
  }, [salon, draft.categoryId]);

  // Default date (today) if step 3
  useEffect(() => {
    if (step === 3 && !draft.date) {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      setDraft((prev) => ({ ...prev, date: todayStr }));
    }
  }, [step, draft.date]);

  // ---------- Branch init ----------
  useEffect(() => {
    if (!salon?.branches?.length) return;
    if (selectedBranchId) return;
    let saved = '';
    try {
      saved = localStorage.getItem('widgetBranch_' + slug) || '';
    } catch {
      /* ignore */
    }
    const valid = saved && salon.branches.some((b) => b.id === saved) ? saved : '';
    setSelectedBranchId(valid || salon.branches[0].id);
  }, [salon, slug, selectedBranchId]);

  const handleBranchChange = useCallback(
    (id: string) => {
      setSelectedBranchId(id);
      try {
        localStorage.setItem('widgetBranch_' + slug, id);
      } catch {
        /* ignore */
      }
    },
    [slug]
  );

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
    if (mode !== 'single') return;
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

  const findFirstError = (): { fieldId: string; message: string } | null => {
    if (step === 1) {
      if (draft.serviceIds.length === 0) return { fieldId: 'single-step1', message: 'Выберите хотя бы одну услугу' };
    }
    if (step === 2) {
      if (!draft.masterId) return { fieldId: 'single-master', message: 'Выберите мастера' };
    }
    if (step === 3) {
      if (!draft.date) return { fieldId: 'single-date', message: 'Выберите дату' };
      if (!draft.slot) return { fieldId: 'single-slots', message: 'Выберите время' };
    }
    if (step === 4) {
      if (!draft.name.trim()) return { fieldId: 'single-name', message: 'Введите имя' };
      if (!draft.phone.trim()) return { fieldId: 'single-phone', message: 'Введите телефон' };
      if (!draft.consent) return { fieldId: 'single-consent', message: 'Согласие обязательно' };
    }
    return null;
  };

  const scrollToError = (err: { fieldId: string; message: string }) => {
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
    goToStep(next);
  };

  if (status === 'loading') return <BookSkeleton />;

  if (status === 'gone') {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-8 text-center shadow-xl">
          <b className="block text-lg text-ink font-bold">Салон больше не принимает записи</b>
          <span className="mt-2 block text-sm text-muted">
            Пожалуйста, свяжитесь с салоном напрямую.
          </span>
        </div>
      </main>
    );
  }

  if (status !== 'ok' || !salon) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-8 text-center shadow-xl">
          <b className="block text-lg text-ink font-bold">Салон не найден</b>
          <span className="mt-2 block text-sm text-muted">Проверьте ссылку на запись.</span>
        </div>
      </main>
    );
  }

  if (mode === null) {
    return (
      <BookingModeSelector
        onSelect={(m) => pushURL({ mode: m, step: 1 })}
        salonName={salon.tenant.name}
        logoUrl={salon.tenant.logoUrl || ''}
        branches={salon.branches}
        selectedBranchId={selectedBranchId}
        onBranchChange={handleBranchChange}
      />
    );
  }

  if (mode === 'group') {
    const groupStep: 1 | 2 | 3 = step > 3 ? 3 : (step as 1 | 2 | 3);
    return (
      <GroupBookingFlow
        salon={salon}
        slug={slug}
        step={groupStep}
        onStepChange={(n) => pushURL({ step: n })}
        onStepReplace={(n) => pushURL({ step: n }, { replace: true })}
        onExit={() => pushURL({ mode: null, step: 1 })}
      />
    );
  }

  if (mode === 'multi') {
    const multiStep: 1 | 2 | 3 | 4 = step > 4 ? 4 : (step as 1 | 2 | 3 | 4);
    return (
      <SingleMultiMasterFlow
        salon={salon}
        slug={slug}
        step={multiStep}
        onStepChange={(n) => pushURL({ step: n })}
        onStepReplace={(n) => pushURL({ step: n }, { replace: true })}
        onExit={() => pushURL({ mode: null, step: 1 })}
      />
    );
  }

  /* =========================================================================
     ЭКРАН УСПЕШНОЙ ЗАПИСИ
     ========================================================================= */
  if (success) {
    const chosenDateRu = dateRu(draft.date);
    const chosenTime = draft.slot?.time || '';
    const masterObj = salon.masters.find((m) => m.id === (draft.masterId === ANY_MASTER ? draft.assignedMasterId : draft.masterId));

    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-8 bg-surface">
        <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6 sm:p-8 text-center shadow-sm">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
            ✓
          </div>

          <div className="mt-4">
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Вы записаны!
            </h1>
            <p className="mt-1 text-sm text-muted">
              Подробности отправлены в WhatsApp
            </p>
          </div>

          {/* Карточка деталей */}
          <div className="mt-6 rounded-xl border border-line bg-surface p-4 text-left space-y-2.5 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-line">
              <span className="text-muted">Салон:</span>
              <b className="text-ink font-semibold">{salon.tenant.name}</b>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-line">
              <span className="text-muted">Мастер:</span>
              <b className="text-ink font-semibold">{masterObj?.name || 'Мастер'}</b>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-line">
              <span className="text-muted">Дата и время:</span>
              <b className="text-primary font-bold">{chosenDateRu}, {chosenTime}</b>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Сумма к оплате:</span>
              <b className="text-ink font-bold tabular-nums">
                {money(salon.services.filter((s) => draft.serviceIds.includes(s.id)).reduce((a, b) => a + b.priceKzt, 0))}
              </b>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => {
                setDraft(EMPTY_DRAFT);
                setSuccess(false);
                pushURL({ mode: null, step: 1 });
              }}
              className="w-full h-12 rounded-xl bg-primary text-white font-semibold text-sm transition hover:bg-primary-hover"
            >
              Вернуться на главную
            </button>
          </div>
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
    <main className="min-h-screen bg-surface px-4 py-5 pb-36">
      <div className="mx-auto w-full max-w-md">
        {/* Шапка навигации с кнопкой «← Назад» */}
        <header className="mb-4 flex items-center justify-between gap-3 pb-3 border-b border-line">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-card px-3.5 text-xs font-semibold text-primary transition hover:border-ink hover:text-ink shadow-sm active:scale-[0.96]"
          >
            ← Назад
          </button>
          <h1 className="min-w-0 truncate text-sm font-bold tracking-tight text-ink text-center">
            {salon.tenant.name}
          </h1>
          <div className="w-9" />
        </header>

        {/* Индикатор шагов */}
        <div className="mb-5 flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-card border border-line shadow-sm">
          {steps.map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3 | 4;
            const active = step === n;
            const done = step > n;
            return (
              <div
                key={label}
                onClick={() => done && goToStep(n)}
                className={`flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  done ? 'cursor-pointer hover:bg-surface' : ''
                } ${
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : done
                    ? 'text-primary'
                    : 'text-muted'
                }`}
              >
                <span className="text-[11px]">{done ? '✓' : n}</span>
                <span className="hidden sm:inline text-[11px]">{label}</span>
              </div>
            );
          })}
        </div>

        {fieldError && (
          <div className="sticky top-2 z-30 mb-4 rounded-2xl border border-red-300 bg-red-50 p-3.5 text-xs font-medium text-red-800 shadow-md">
            ⚠ {fieldError.message}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 shadow-sm">
            <b className="block font-semibold">Не получилось</b>
            <span className="mt-0.5 block">{error}</span>
          </div>
        )}

        {/* =========================================================================
           ШАГ 1: ВЫБОР УСЛУГ
           ========================================================================= */}
        {step === 1 && (
          <section id="single-step1">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                  Шаг 1 из 4
                </span>
                <h2 className="mt-0.5 text-xl font-bold tracking-tight text-ink font-serif">
                  Выберите услуги
                </h2>
                <p className="text-xs text-muted">Можно выбрать одну или несколько процедур</p>
              </div>
              {draft.serviceIds.length > 0 && (
                <strong className="text-base font-bold text-primary tabular-nums">
                  {money(totalPrice)}
                </strong>
              )}
            </div>

            {/* Чипы категорий */}
            <div className="mb-3.5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {salon.categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, categoryId: c.id }))}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    draft.categoryId === c.id
                      ? 'bg-primary text-white shadow-md'
                      : 'border border-line bg-card text-muted hover:border-ink/20 hover:text-ink shadow-sm'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Карточки услуг */}
            <div className="space-y-2.5">
              {services.map((s) => {
                const checked = draft.serviceIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition ${
                      checked
                        ? 'border-primary shadow-sm'
                        : 'border-line hover:border-ink/30'
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition ${
                        checked
                          ? 'border-primary bg-primary text-card'
                          : 'border-line bg-card text-transparent'
                      }`}
                    >
                      ✓
                    </span>
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
                <div className="rounded-2xl border border-line bg-card p-6 text-center text-xs text-muted">
                  В этой категории пока нет услуг.
                </div>
              )}
            </div>
          </section>
        )}

        {/* =========================================================================
           ШАГ 2: ВЫБОР МАСТЕРА
           ========================================================================= */}
        {step === 2 && (
          <section id="single-master">
            <div className="mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                Шаг 2 из 4
              </span>
              <h2 className="mt-0.5 text-xl font-bold tracking-tight text-ink font-serif">
                Выберите мастера
              </h2>
              <p className="text-xs text-muted">
                Кто будет выполнять выбранные услуги
              </p>
            </div>

            <div className="space-y-3">
              {eligibleMasters.length > 0 && (
                <div
                  onClick={() => pickMaster(ANY_MASTER)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    draft.masterId === ANY_MASTER
                      ? 'border-primary bg-primary/5'
                      : 'border-line bg-card hover:border-ink/20'
                  }`}
                >
                  <div>
                    <div className="text-sm font-semibold text-ink">Любой свободный мастер</div>
                    <div className="text-xs text-muted">Ближайшее доступное окно</div>
                  </div>
                  <span
                    className={`h-5 w-5 rounded-full border flex items-center justify-center text-xs transition-colors shrink-0 ${
                      draft.masterId === ANY_MASTER
                        ? 'border-primary bg-primary text-white font-bold'
                        : 'border-line bg-surface'
                    }`}
                  >
                    {draft.masterId === ANY_MASTER && '✓'}
                  </span>
                </div>
              )}

              {eligibleMasters.map((m) => {
                const isSelected = draft.masterId === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => pickMaster(m.id)}
                    className={`rounded-xl p-3.5 transition-all cursor-pointer border ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-line bg-card hover:border-ink/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {m.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.photoUrl}
                              alt={m.name}
                              className="h-12 w-12 rounded-xl object-cover"
                            />
                          ) : (
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface border border-line text-base font-bold text-ink">
                              {m.name.slice(0, 1)}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-ink">
                            {m.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted">
                            <span>{rating(m.rating || 0, m.ratingCount || 0)}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`h-5 w-5 rounded-full border flex items-center justify-center text-xs transition-colors shrink-0 ${
                          isSelected
                            ? 'border-primary bg-primary text-white font-bold'
                            : 'border-line bg-surface'
                        }`}
                      >
                        {isSelected && '✓'}
                      </span>
                    </div>
                  </div>
                );
              })}

              {!eligibleMasters.length && (
                <div className="rounded-2xl border border-line bg-card p-6 text-center text-xs text-muted">
                  Нет доступных мастеров для выбранных услуг.
                </div>
              )}
            </div>
          </section>
        )}

        {/* =========================================================================
           ШАГ 3: ВЫБОР ДАТЫ И ВРЕМЕНИ (С ГОРИЗОНТАЛЬНЫМ DATESTRIP)
           ========================================================================= */
        step === 3 && (
          <section id="single-date">
            <div className="mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                Шаг 3 из 4
              </span>
              <h2 className="mt-0.5 text-xl font-bold tracking-tight text-ink font-serif">
                Дата и время визита
              </h2>
              <p className="text-xs text-muted">
                {draft.masterId === ANY_MASTER
                  ? 'Показываем слоты у всех доступных мастеров'
                  : selectedMaster?.name || 'Выберите удобное время'}
              </p>
            </div>

            {/* Выбор даты */}
            <div className="mb-4">
              <label htmlFor="booking-date" className="block text-xs font-semibold text-muted mb-1.5">
                Дата
              </label>
              <input
                id="booking-date"
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={draft.date}
                onChange={(e) => {
                  if (e.target.value) {
                    setDraft((prev) => ({ ...prev, date: e.target.value, slot: null }));
                  }
                }}
                className="h-12 w-full rounded-xl border border-line bg-card px-4 text-sm text-ink outline-none focus:border-primary"
              />
            </div>

            {/* Сетка таймслотов */}
            <div id="single-slots">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Доступное время
                </span>
                <span className="text-[10px] text-muted">Часовой пояс салона</span>
              </div>

              {loadingSlots ? (
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="h-11 rounded-xl bg-card border border-line animate-pulse" />
                  ))}
                </div>
              ) : draft.date ? (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      onClick={() => void pickSlot(s)}
                      className="h-11 rounded-xl border border-line bg-card text-xs font-semibold text-ink tabular-nums transition hover:border-primary hover:bg-primary/5 active:scale-[0.97] shadow-sm"
                    >
                      {s.time}
                    </button>
                  ))}
                  {!slots.length && (
                    <div className="col-span-4 rounded-2xl border border-line bg-card p-6 text-center text-xs text-muted">
                      На эту дату свободного времени нет. Пожалуйста, выберите другой день.
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Подсказка */}
            <div className="mt-5 flex items-center gap-2.5 p-3 rounded-xl border border-line bg-card text-xs text-muted shadow-sm">
              <span>🕒 Напоминание придёт в WhatsApp за 24 часа и за 2 часа до визита.</span>
            </div>
          </section>
        )}

        {/* =========================================================================
           ШАГ 4: ПОДТВЕРЖДЕНИЕ И КОНТАКТЫ
           ========================================================================= */}
        {step === 4 && draft.slot && (
          <section id="single-confirm">
            <div className="mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                Финальный шаг
              </span>
              <h2 className="mt-0.5 text-xl font-bold tracking-tight text-ink">
                Подтверждение записи
              </h2>
              <p className="text-xs text-muted">
                Проверьте параметры визита и укажите контакты
              </p>
            </div>

            {/* Сводная карточка брони */}
            <div className="mb-4 space-y-3 rounded-2xl border-2 border-primary/20 bg-card p-4 shadow-sm text-xs">
              <div className="flex justify-between items-center pb-2.5 border-b border-line">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted block">
                    Услуги
                  </span>
                  <b className="text-sm font-bold text-ink">
                    {selectedServices.map((s) => s.name).join(', ')}
                  </b>
                </div>
                <span className="text-sm font-bold text-primary tabular-nums">
                  {money(totalPrice)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted block">Мастер:</span>
                  <span className="font-semibold text-ink">
                    {draft.masterId === ANY_MASTER
                      ? assignedMaster
                        ? `${assignedMaster.name} (любой)`
                        : 'Любой мастер'
                      : selectedMaster?.name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block">Дата и время:</span>
                  <span className="font-bold text-primary">
                    {dateRu(draft.date)}, {draft.slot.time}
                  </span>
                </div>
              </div>
            </div>

            {/* Форма */}
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-muted block mb-1">
                  Ваше имя *
                </label>
                <input
                  id="single-name"
                  required
                  value={draft.name}
                  onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Как к вам обращаться"
                  className="h-12 w-full rounded-xl border border-line bg-card px-4 text-xs text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-sm"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted block mb-1">
                  Номер телефона (WhatsApp) *
                </label>
                <input
                  id="single-phone"
                  required
                  type="tel"
                  value={draft.phone}
                  onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+7 (___) ___-__-__"
                  className="h-12 w-full rounded-xl border border-line bg-card px-4 text-xs text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 tabular-nums shadow-sm"
                />
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 pt-1">
                <input
                  id="single-consent"
                  required
                  type="checkbox"
                  checked={draft.consent}
                  onChange={(e) => setDraft((prev) => ({ ...prev, consent: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="text-[11px] text-muted leading-tight">
                  Согласен на обработку персональных данных и подтверждение в WhatsApp
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-13 mt-2 rounded-2xl bg-primary text-white font-bold text-sm tracking-wide transition-transform active:scale-[0.98] shadow-lg shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Оформляем запись…' : `Записаться на ${dateRu(draft.date)}`}
              </button>
            </form>
          </section>
        )}
      </div>

      {/* Плавающая нижняя планка для Шага 1 */}
      {step === 1 && draft.serviceIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur-md px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl">
          <div className="mx-auto flex w-full max-w-md items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted block">
                {draft.serviceIds.length} {draft.serviceIds.length === 1 ? 'услуга' : 'услуги'}
              </span>
              <strong className="text-base font-bold text-ink tabular-nums">
                {money(totalPrice)}
              </strong>
            </div>
            <button
              type="button"
              onClick={() => handleContinue(2)}
              className="h-11 px-6 rounded-xl bg-primary text-white font-bold text-xs tracking-wide transition-transform active:scale-[0.98] shadow-md"
            >
              Далее: Мастер →
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
