'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';
import { BookSkeleton } from '@/components/book-skeleton';
import { GroupBookingFlow } from '@/components/group-booking-flow';
import { SingleMultiMasterFlow } from '@/components/single-multi-master-flow';
import { DateStrip } from '@/components/date-strip';
import { formatKzPhone } from '@/lib/format-phone';

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
   ИКОНКИ SVG
   ========================================================================= */
const IconScissors = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="6" cy="6" r="3" /><path d="M8.12 8.12 12 12" /><path d="M20 4 8.12 15.88" />
    <circle cx="6" cy="18" r="3" /><path d="M14.8 14.8 20 20" />
  </svg>
);

const IconClock = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconShieldCheck = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const IconSparkles = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </svg>
);

const IconSunMoon = ({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) => (
  <button
    type="button"
    onClick={onToggle}
    title={isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
    className="h-9 w-9 rounded-full border border-line bg-card flex items-center justify-center text-xs text-muted hover:text-ink transition-colors shadow-sm"
  >
    {isDark ? '☀️' : '🌙'}
  </button>
);

/* =========================================================================
   ВХОД / ВЫБОР РЕЖИМА ЗАПИСИ
   ========================================================================= */
function BookingModeSelector({
  onSelect,
  salonName,
  logoUrl,
  bannerUrl,
  branches,
  selectedBranchId,
  onBranchChange,
  isDark,
  onToggleTheme,
}: {
  onSelect: (mode: 'single' | 'group' | 'multi') => void;
  salonName: string;
  logoUrl: string;
  bannerUrl: string;
  branches: Branch[];
  selectedBranchId: string;
  onBranchChange: (id: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}) {
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const selectedBranch = branches.find((b) => b.id === selectedBranchId) || branches[0] || null;
  const hasMultipleBranches = branches.length > 1;

  return (
    <main className="min-h-screen bg-surface">
      <div className="mx-auto w-full max-w-md pb-8">
        {/* Атмосферный Hero с фото-фоном */}
        <header
          className="relative px-5 pt-8 pb-12 overflow-hidden"
          style={
            bannerUrl
              ? {
                  backgroundImage: `url(${bannerUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : { backgroundColor: '#16171B' }
          }
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/30" aria-hidden="true" />

          {/* Верхняя панель: статус и переключатель темы */}
          <div className="relative z-10 flex items-center justify-between mb-6">
            <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-semibold tracking-wider text-primary uppercase">
              Premium Gentlemen Salon
            </span>
            <IconSunMoon isDark={isDark} onToggle={onToggleTheme} />
          </div>

          <div className="relative z-10 flex items-center gap-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={salonName}
                className="h-18 w-18 shrink-0 rounded-2xl border-2 border-primary object-cover shadow-xl"
              />
            ) : (
              <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-2xl border-2 border-primary bg-[#16171B] text-2xl font-bold text-primary shadow-xl">
                {salonName.charAt(0).toUpperCase() || 'B'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-primary block mb-0.5">
                Клубный сервис
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white leading-tight font-serif drop-shadow-md">
                {salonName}
              </h1>
            </div>
          </div>
        </header>

        {/* Блок филиала */}
        <div className="-mt-5 rounded-t-3xl bg-surface px-5 pb-4 pt-5 border-t border-line">
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

  // Поддержка переключения тем (Light Warm Linen / Dark Luxury)
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('widget_theme');
      if (savedTheme === 'dark') {
        setIsDark(true);
        document.documentElement.classList.add('theme-dark');
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('theme-dark');
        try { localStorage.setItem('widget_theme', 'dark'); } catch { /* ignore */ }
      } else {
        document.documentElement.classList.remove('theme-dark');
        try { localStorage.setItem('widget_theme', 'light'); } catch { /* ignore */ }
      }
      return next;
    });
  };

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
        bannerUrl={salon.tenant.bannerUrl || ''}
        branches={salon.branches}
        selectedBranchId={selectedBranchId}
        onBranchChange={handleBranchChange}
        isDark={isDark}
        onToggleTheme={toggleTheme}
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

    // Ссылка на добавление в Google Calendar
    const calendarTitle = encodeURIComponent(`Запись в ${salon.tenant.name}`);
    const calendarDetails = encodeURIComponent(`Услуги: ${salon.services.filter((s) => draft.serviceIds.includes(s.id)).map((s) => s.name).join(', ')}\nМастер: ${masterObj?.name || ''}`);
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calendarTitle}&details=${calendarDetails}`;

    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-8 bg-surface">
        <div className="w-full max-w-md rounded-3xl border border-line bg-card p-6 sm:p-8 text-center shadow-2xl">
          {/* Анимированная галочка */}
          <div className="mx-auto h-20 w-20 rounded-full border-2 border-primary bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold shadow-[0_0_30px_rgba(197,168,128,0.25)] animate-bounce duration-1000">
            ✓
          </div>

          <div className="mt-6">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary block mb-1">
              Запись подтверждена • Онлайн
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-ink font-serif">
              Ждём вас в клубе!
            </h1>
            <p className="mt-1.5 text-xs text-muted max-w-xs mx-auto">
              Подробности визита и напоминание отправлены вам в WhatsApp
            </p>
          </div>

          {/* Карточка деталей */}
          <div className="mt-6 rounded-2xl border border-line bg-surface p-4 text-left space-y-3 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-line">
              <span className="text-muted">Салон:</span>
              <b className="text-ink font-semibold">{salon.tenant.name}</b>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-line">
              <span className="text-muted">Мастер:</span>
              <b className="text-ink font-semibold">{masterObj?.name || 'Мастер клуба'}</b>
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

          {/* Кнопки действий */}
          <div className="mt-6 space-y-3">
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-card text-xs font-semibold text-ink hover:bg-surface transition-colors shadow-sm"
            >
              📅 Добавить в Google Calendar
            </a>

            <button
              type="button"
              onClick={() => {
                setDraft(EMPTY_DRAFT);
                setSuccess(false);
                pushURL({ mode: null, step: 1 });
              }}
              className="w-full h-12 rounded-2xl bg-primary text-white font-bold text-xs tracking-wide transition-transform active:scale-[0.98] shadow-md"
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
          <h1 className="min-w-0 truncate text-sm font-bold tracking-tight text-ink font-serif text-center">
            {salon.tenant.name}
          </h1>
          <IconSunMoon isDark={isDark} onToggle={toggleTheme} />
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
                  <div
                    key={s.id}
                    onClick={() => toggleService(s.id)}
                    className={`rounded-2xl p-3.5 transition-all duration-200 cursor-pointer border ${
                      checked
                        ? 'border-2 border-primary bg-card shadow-md'
                        : 'border-line bg-card hover:border-ink/20 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            checked
                              ? 'bg-primary text-white'
                              : 'bg-surface text-primary border border-line'
                          }`}
                        >
                          <IconScissors className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[13px] font-bold text-ink leading-snug">
                            {s.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-muted">
                            <IconClock className="w-3 h-3" />
                            <span>{s.durationMinutes} мин</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-primary tabular-nums block">
                          {money(s.priceKzt)}
                        </span>
                        <span
                          className={`inline-block mt-2 h-5 w-5 rounded-full border flex items-center justify-center text-[10px] ${
                            checked
                              ? 'border-primary bg-primary text-white font-bold'
                              : 'border-line bg-surface'
                          }`}
                        >
                          {checked && '✓'}
                        </span>
                      </div>
                    </div>
                  </div>
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
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    draft.masterId === ANY_MASTER
                      ? 'border-2 border-primary bg-card shadow-md'
                      : 'border-line bg-card hover:border-ink/20 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-surface border border-line flex items-center justify-center text-primary">
                      <IconSparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-ink">Любой свободный мастер</div>
                      <div className="text-[10px] text-muted">Ближайшее доступное окно</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-primary">Быстрее всего →</span>
                </div>
              )}

              {eligibleMasters.map((m) => {
                const isSelected = draft.masterId === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => pickMaster(m.id)}
                    className={`rounded-2xl p-4 transition-all cursor-pointer border ${
                      isSelected
                        ? 'border-2 border-primary bg-card shadow-md'
                        : 'border-line bg-card hover:border-ink/20 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className="relative">
                          {m.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.photoUrl}
                              alt={m.name}
                              className="h-14 w-14 rounded-2xl object-cover border-2 border-primary shadow-sm"
                            />
                          ) : (
                            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface border-2 border-primary text-base font-bold text-primary">
                              {m.name.slice(0, 1)}
                            </span>
                          )}
                          <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-card" />
                        </div>
                        <div>
                          <div className="text-[14px] font-bold text-ink tracking-tight">
                            {m.name}
                          </div>
                          <div className="text-xs text-muted">Топ-барбер клуба</div>
                          <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-primary">
                            <span>{rating(m.rating || 0, m.ratingCount || 0)}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`h-6 w-6 rounded-full border flex items-center justify-center text-xs transition-colors shrink-0 ${
                          isSelected
                            ? 'border-primary bg-primary text-white font-bold'
                            : 'border-line bg-surface'
                        }`}
                      >
                        {isSelected && '✓'}
                      </span>
                    </div>

                    {/* Статус-бейджи */}
                    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-line">
                      <span className="text-[9px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        Топ-барбер
                      </span>
                      <span className="text-[9px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        Стерильный инструмент
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

            {/* Горизонтальный DateStrip на 14 дней */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Выберите день
                </span>
                <label className="text-[11px] text-primary font-semibold cursor-pointer hover:underline flex items-center gap-1">
                  <span>Другая дата ▾</span>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={draft.date}
                    onChange={(e) => {
                      if (e.target.value) {
                        setDraft((prev) => ({ ...prev, date: e.target.value, slot: null }));
                      }
                    }}
                    className="sr-only"
                  />
                </label>
              </div>
              <DateStrip
                selectedDate={draft.date}
                onSelectDate={(newDate) => {
                  setDraft((prev) => ({ ...prev, date: newDate, slot: null }));
                }}
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
              <IconClock className="w-4 h-4 text-primary shrink-0" />
              <span>Напоминание придёт в WhatsApp за 24 часа и за 2 часа до визита.</span>
            </div>
          </section>
        )}

        {/* =========================================================================
           ШАГ 4: ПОДТВЕРЖДЕНИЕ И КОНТАКТЫ (БЕЗ ПОЖЕЛАНИЙ)
           ========================================================================= */
        step === 4 && draft.slot && (
          <section id="single-confirm">
            <div className="mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                Финальный шаг
              </span>
              <h2 className="mt-0.5 text-xl font-bold tracking-tight text-ink font-serif">
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

            {/* Форма: Только Имя и Телефон */}
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
                  onChange={(e) => setDraft((prev) => ({ ...prev, phone: formatKzPhone(e.target.value) }))}
                  placeholder="+7 (___) ___-__-__"
                  className="h-12 w-full rounded-xl border border-line bg-card px-4 text-xs text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 tabular-nums shadow-sm"
                />
              </div>

              {/* Trust Badge */}
              <div className="flex items-center gap-3 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-muted shadow-sm">
                <IconShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  Оплата в салоне картой или наличными после стрижки. Бесплатная отмена за 2 часа.
                </span>
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
