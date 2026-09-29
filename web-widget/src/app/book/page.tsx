'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';

type Service = { id: string; name: string; categoryId: string; durationMinutes: number; priceKzt: number };
type Master = { id: string; name: string; photoUrl: string; rating: number; ratingCount: number; serviceIds: string[] };
type Category = { id: string; name: string };
type Slot = { start: number; end: number; time: string };
type SalonData = { tenant: { name: string; city: string }; categories: Category[]; services: Service[]; masters: Master[] };

const money = (n: number) => n.toLocaleString('ru-RU') + ' ₸';
const rating = (n: number, count: number) => count ? `★ ${n.toFixed(1)} · ${count}` : 'Пока нет отзывов';
const dateRu = (s: string) => s ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(s + 'T12:00:00Z')) : '';

function BookingFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = searchParams.get('slug') || '';

  const [salon, setSalon] = useState<SalonData | null>(null);
  const [status, setStatus] = useState<'loading'|'ok'|'not_found'|'gone'>('loading');
  const [step, setStep] = useState<1|2|3|4>(1);
  const [categoryId, setCategoryId] = useState('');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [masterId, setMasterId] = useState('');
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!slug) { setStatus('not_found'); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const fn = httpsCallable(getFirebaseFunctions(), 'widgetGetSalon');
        const response = await fn({ slug });
        if (cancelled) return;
        const result = response.data as {
          status: string; newSlug?: string; tenant?: SalonData['tenant'];
          categories?: Category[]; services?: Service[]; masters?: Master[];
        };
        if (result.status === 'redirect' && result.newSlug) {
          router.push('/book?slug=' + encodeURIComponent(result.newSlug)); return;
        }
        if (result.status === 'not_found' || result.status === 'gone') {
          setStatus(result.status); return;
        }
        if (result.status !== 'ok' || !result.tenant) { setStatus('not_found'); return; }
        setSalon({
          tenant: result.tenant,
          categories: result.categories || [],
          services: result.services || [],
          masters: result.masters || [],
        });
        setStatus('ok');
      } catch { if (!cancelled) setStatus('not_found'); }
    };
    void load();
    return () => { cancelled = true; };
  }, [slug, router]);

  useEffect(() => {
    if (salon?.categories.length && !categoryId) setCategoryId(salon.categories[0].id);
  }, [salon, categoryId]);

  const loadSlots = useCallback(async () => {
    if (step !== 3 || !slug || !masterId || !date || !salon) return;
    const duration = serviceIds.reduce((sum, id) => sum + (salon.services.find(s => s.id === id)?.durationMinutes || 0), 0);
    if (!duration) { setSlots([]); return; }
    setLoadingSlots(true); setSlot(null); setError('');
    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'widgetGetSlots');
      const response = await fn({ slug, masterId, date, durationMinutes: duration });
      setSlots(((response.data as { slots?: Slot[] }).slots) || []);
    } catch {
      setSlots([]);
      setError('Не удалось загрузить свободное время. Попробуйте ещё раз.');
    } finally { setLoadingSlots(false); }
  }, [step, slug, masterId, date, serviceIds, salon]);

  useEffect(() => { void loadSlots(); }, [loadSlots]);

  const toggleService = (id: string) =>
    setServiceIds(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);

  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const max = new Date(today.getFullYear(), today.getMonth(), today.getDate()+30);
  const maxDate = `${max.getFullYear()}-${String(max.getMonth()+1).padStart(2,'0')}-${String(max.getDate()).padStart(2,'0')}`;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!slug || !slot || !consent) return;
    setSubmitting(true); setError('');
    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'widgetCreateAppointment');
      await fn({ slug, masterId, serviceIds, date, startMinutes: slot.start, clientName: name, clientPhone: phone, consent });
      setSuccess(true);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      const code = (e.code || '').replace(/^functions\//, '');
      if (code === 'aborted' || e.message?.includes('slot_taken')) {
        setError('Это время только что заняли. Выберите другое.');
        setStep(3);
      } else if (code === 'permission-denied') {
        setError('Онлайн-запись недоступна, позвоните в салон.');
      } else setError('Ошибка: ' + (e.message || 'неизвестная ошибка'));
    } finally { setSubmitting(false); }
  };

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-2xl border border-line bg-card px-6 py-4 text-sm text-muted">
          Загрузка…
        </div>
      </main>
    );
  }

  if (status === 'gone') {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 text-center">
          <b className="block text-base text-ink">Салон больше не принимает записи</b>
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
        <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 text-center">
          <b className="block text-base text-ink">Салон не найден</b>
          <span className="mt-2 block text-sm text-muted">
            Проверьте ссылку на запись.
          </span>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-ink">
            ✓
          </div>
          <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            BARBER CRM
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
            Запись отправлена
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Отлично! Мы свяжемся с вами для подтверждения записи.
          </p>
        </div>
      </main>
    );
  }

  const selectedMaster = salon.masters.find(m => m.id === masterId);
  const services = salon.services.filter(s => s.categoryId === categoryId);
  const masters = salon.masters.filter(m => m.serviceIds?.some(id => serviceIds.includes(id)));
  const selectedServices = salon.services.filter(s => serviceIds.includes(s.id));
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.priceKzt, 0);
  const steps = ['Услуги', 'Мастер', 'Время', 'Контакты'];

  return (
    <main className="min-h-screen bg-surface px-4 py-6 pb-28">
      <div className="mx-auto w-full max-w-md">
        {/* Header */}
        <header className="mb-6 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              {salon.tenant.city || 'Онлайн-запись'}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
              {salon.tenant.name}
            </h1>
            <p className="mt-1 text-xs text-muted">Онлайн-запись</p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-ink">
            ✂
          </div>
        </header>

        {/* Progress */}
        <div className="mb-6 flex items-center gap-1.5">
          {steps.map((label, i) => {
            const active = step === i + 1;
            const done = step > i + 1;
            return (
              <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className={[
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition',
                    active ? 'bg-primary text-ink' : done ? 'bg-ink text-white' : 'bg-white text-muted border border-line',
                  ].join(' ')}
                >
                  {done ? '✓' : i + 1}
                </div>
                <small className={`text-[10px] font-medium ${active ? 'text-ink' : 'text-muted'}`}>
                  {label}
                </small>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            <b className="block font-semibold">Не получилось</b>
            <span className="mt-0.5 block">{error}</span>
          </div>
        )}

        {/* STEP 1 — SERVICES */}
        {step === 1 && (
          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                  Шаг 1
                </div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
                  Выберите услуги
                </h2>
                <p className="mt-1 text-xs text-muted">Можно несколько</p>
              </div>
              {serviceIds.length > 0 && (
                <strong className="text-base font-semibold text-ink">{money(totalPrice)}</strong>
              )}
            </div>

            <div className="mb-3 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {salon.categories.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={[
                    'shrink-0 rounded-full px-4 py-2 text-xs font-medium transition',
                    categoryId === c.id
                      ? 'bg-ink text-white'
                      : 'border border-line bg-white text-muted hover:border-ink hover:text-ink',
                  ].join(' ')}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {services.map(s => {
                const checked = serviceIds.includes(s.id);
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
                    <span
                      className={[
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition',
                        checked ? 'border-primary bg-primary text-ink' : 'border-line bg-white text-transparent',
                      ].join(' ')}
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
                <div className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-muted">
                  В этой категории пока нет услуг.
                </div>
              )}
            </div>
          </section>
        )}

        {/* STEP 2 — MASTERS */}
        {step === 2 && (
          <section>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mb-4 text-xs font-medium text-muted transition hover:text-ink"
            >
              ← Назад
            </button>
            <div className="mb-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                Шаг 2
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
                Выберите мастера
              </h2>
              <p className="mt-1 text-xs text-muted">
                Кто будет выполнять выбранные услуги
              </p>
            </div>
            <div className="space-y-2">
              {masters.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setMasterId(m.id); setStep(3); setError(''); }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-4 text-left transition hover:border-ink/30"
                >
                  {m.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.photoUrl}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-base font-semibold text-muted">
                      {m.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm font-semibold text-ink">{m.name}</b>
                    <small className="mt-0.5 block text-xs text-muted">
                      {rating(m.rating || 0, m.ratingCount || 0)}
                    </small>
                  </span>
                  <i className="shrink-0 text-muted not-italic">→</i>
                </button>
              ))}
              {!masters.length && (
                <div className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-muted">
                  Мет достурных мастеров для выбранных услуг.
                </div>
              )}
            </div>
          </section>
        )}

        {/* STEP 3 — DATE & TIME */}
        {step === 3 && (
          <section>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="mb-4 text-xs font-medium text-muted transition hover:text-ink"
            >
              ← Назад
            </button>
            <div className="mb-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                Шаг 3
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
                Дата и время
              </h2>
              <p className="mt-1 text-xs text-muted">
                {selectedMaster?.name || 'Выберите удобное время'}
              </p>
            </div>

            <label className="mb-4 block">
              <span className="mb-2 block text-xs font-medium text-muted">Дата записи</span>
              <input
                type="date"
                min={todayString}
                max={maxDate}
                value={date}
                onChange={e => { setDate(e.target.value); setSlots([]); }}
                className="h-12 w-full rounded-xl border border-line bg-card px-4 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </label>

            {loadingSlots ? (
              <div className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-muted">
                Загружаем свободное время…
              </div>
            ) : date ? (
              <div className="grid grid-cols-3 gap-2">
                {slots.map(s => (
                  <button
                    key={s.start}
                    type="button"
                    onClick={() => { setSlot(s); setStep(4); setError(''); }}
                    className="rounded-xl border border-line bg-card px-3 py-3 text-sm font-medium text-ink transition hover:border-primary hover:bg-primary/10"
                  >
                    {s.time}
                  </button>
                ))}
                {!slots.length && (
                  <div className="col-span-3 rounded-2xl border border-line bg-card p-6 text-center text-sm text-muted">
                    Свободного времени нет.
                  </div>
                )}
              </div>
            ) : null}
          </section>
        )}

        {/* STEP 4 — CONTACTS */}
        {step === 4 && slot && (
          <section>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="mb-4 text-xs font-medium text-muted transition hover:text-ink"
            >
              ← Назад
            </button>
            <div className="mb-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                Шаг 4
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
                Ваши контакты
              </h2>
              <p className="mt-1 text-xs text-muted">
                Укажите данные для подтверждения записи
              </p>
            </div>

            <div className="mb-5 space-y-2 rounded-2xl border border-line bg-card p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="shrink-0 text-xs text-muted">Услуги</span>
                <b className="text-right font-medium text-ink">
                  {selectedServices.map(s => s.name).join(', ')}
                </b>
              </div>
              <div className="flex justify-between gap-4">
                <span className="shrink-0 text-xs text-muted">Мастер</span>
                <b className="text-right font-medium text-ink">{selectedMaster?.name}</b>
              </div>
              <div className="flex justify-between gap-4">
                <span className="shrink-0 text-xs text-muted">Дата и время</span>
                <b className="text-right font-medium text-ink">{dateRu(date)}, {slot.time}</b>
              </div>
              <div className="flex justify-between gap-4 border-t border-line pt-2">
                <span className="shrink-0 text-xs text-muted">Стоимость</span>
                <b className="text-right font-semibold text-ink">{money(totalPrice)}</b>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-muted">Имя</span>
                <input
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Как к вам обращаться?"
                  className="h-12 w-full rounded-xl border border-line bg-card px-4 text-sm text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-muted">Телефон</span>
                <input
                  required
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+7 ___ ___ __ __"
                  className="h-12 w-full rounded-xl border border-line bg-card px-4 text-sm text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-card p-4">
                <input
                  required
                  type="checkbox"
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#F4C842]"
                />
                <span className="text-xs leading-5 text-muted">
                  Согласен на обработку персональных данных
                </span>
              </label>
              <button
                type="submit"
                disabled={submitting || !consent}
                className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-ink transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Отправляем…' : 'Подтвердить запись'}
              </button>
            </form>
          </section>
        )}
      </div>

      {/* Sticky bottom CTA on step 1 */}
      {step === 1 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto w-full max-w-md">
            <button
              type="button"
              disabled={!serviceIds.length}
              onClick={() => setStep(2)}
              className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-ink transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
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
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-4">
          <div className="rounded-2xl border border-line bg-card px-6 py-4 text-sm text-muted">
            Загрузка…
          </div>
        </main>
      }
    >
      <BookingFlow />
    </Suspense>
  );
}