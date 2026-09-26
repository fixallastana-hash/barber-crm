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

function formatPrice(kzt: number): string {
  return (kzt / 100).toLocaleString('ru-RU') + ' ₸';
}

function formatRating(rating: number, count: number): string {
  if (count === 0) return 'Нет отзывов';
  return '⭐ ' + rating.toFixed(1) + ' (' + count + ')';
}

function formatDate(date: string): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(
    new Date(date + 'T12:00:00Z'),
  );
}

function BookingFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = searchParams.get('slug') || '';
  const [salon, setSalon] = useState<SalonData | null>(null);
  const [salonStatus, setSalonStatus] = useState<'loading' | 'ok' | 'not_found' | 'gone'>('loading');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedMasterId, setSelectedMasterId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formConsent, setFormConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!slug) {
      setSalonStatus('not_found');
      return;
    }
    let cancelled = false;
    setSalonStatus('loading');
    const loadSalon = async () => {
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
          setSalonStatus(result.status);
          return;
        }
        if (result.status !== 'ok' || !result.tenant) {
          setSalonStatus('not_found');
          return;
        }
        setSalon({
          tenant: result.tenant,
          categories: result.categories || [],
          services: result.services || [],
          masters: result.masters || [],
        });
        setSalonStatus('ok');
      } catch {
        if (!cancelled) setSalonStatus('not_found');
      }
    };
    void loadSalon();
    return () => {
      cancelled = true;
    };
  }, [slug, router]);

  useEffect(() => {
    if (salon?.categories.length && !selectedCategoryId) {
      setSelectedCategoryId(salon.categories[0].id);
    }
  }, [salon, selectedCategoryId]);

  const loadSlots = useCallback(async () => {
    if (step !== 3 || !slug || !selectedMasterId || !selectedDate || !salon) return;
    const totalDuration = selectedServiceIds.reduce((sum, id) => {
      const service = salon.services.find((item) => item.id === id);
      return sum + (service?.durationMinutes || 0);
    }, 0);
    if (!totalDuration) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    setSelectedSlot(null);
    setErrorMsg('');
    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'widgetGetSlots');
      const response = await fn({ slug, masterId: selectedMasterId, date: selectedDate, durationMinutes: totalDuration });
      setSlots(((response.data as { slots?: Slot[] }).slots) || []);
    } catch {
      setSlots([]);
      setErrorMsg('Не удалось загрузить свободное время. Попробуйте ещё раз.');
    } finally {
      setLoadingSlots(false);
    }
  }, [step, slug, selectedMasterId, selectedDate, selectedServiceIds, salon]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds((current) => current.includes(serviceId)
      ? current.filter((id) => id !== serviceId)
      : [...current, serviceId]);
  };

  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const maxDateValue = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
  const maxDate = `${maxDateValue.getFullYear()}-${String(maxDateValue.getMonth() + 1).padStart(2, '0')}-${String(maxDateValue.getDate()).padStart(2, '0')}`;

  const submitAppointment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!slug || !selectedSlot || !formConsent) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'widgetCreateAppointment');
      await fn({
        slug,
        masterId: selectedMasterId,
        serviceIds: selectedServiceIds,
        date: selectedDate,
        startMinutes: selectedSlot.start,
        clientName: formName,
        clientPhone: formPhone,
        consent: formConsent,
      });
      setSuccess(true);
    } catch (error) {
      const err = error as { code?: string; message?: string };
      const code = (err.code || '').replace(/^functions\//, '');
      if (code === 'aborted' || err.message?.includes('slot_taken')) {
        setErrorMsg('Это время только что заняли, выберите другое');
        setStep(3);
      } else if (code === 'permission-denied') {
        setErrorMsg('Онлайн-запись недоступна, позвоните в салон');
      } else {
        setErrorMsg('Ошибка: ' + (err.message || 'неизвестная'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (salonStatus === 'loading') {
    return <main className="mx-auto max-w-md px-4 py-6 text-center text-gray-600">Загрузка...</main>;
  }
  if (salonStatus === 'gone') {
    return <main className="mx-auto max-w-md px-4 py-6 text-center text-gray-700">Салон больше не принимает записи</main>;
  }
  if (salonStatus !== 'ok' || !salon) {
    return <main className="mx-auto max-w-md px-4 py-6 text-center text-gray-700">Салон не найден</main>;
  }
  if (success) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4 py-6 text-center">
        <div className="rounded-lg bg-white p-8 shadow">
          <div className="mb-3 text-4xl" aria-hidden="true">✓</div>
          <h1 className="text-2xl font-bold text-gray-900">Спасибо!</h1>
          <p className="mt-2 text-gray-600">Мы свяжемся с вами для подтверждения</p>
        </div>
      </main>
    );
  }

  const selectedMaster = salon.masters.find((master) => master.id === selectedMasterId);
  const visibleServices = salon.services.filter((service) => service.categoryId === selectedCategoryId);
  const availableMasters = salon.masters.filter((master) =>
    master.serviceIds?.some((id) => selectedServiceIds.includes(id)),
  );

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="mx-auto max-w-md px-4 py-6">
        <header className="mb-6">
          <p className="text-sm text-gray-500">{salon.tenant.city}</p>
          <h1 className="text-2xl font-bold text-gray-900">{salon.tenant.name}</h1>
          <p className="mt-2 text-sm font-medium text-gray-500">Шаг {step} из 4</p>
        </header>

        {errorMsg && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMsg}</p>}

        {step === 1 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Выберите услуги</h2>
            <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
              {salon.categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(category.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${selectedCategoryId === category.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 shadow'}`}
                >
                  {category.name}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {visibleServices.map((service) => {
                const checked = selectedServiceIds.includes(service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    aria-pressed={checked}
                    onClick={() => toggleService(service.id)}
                    className={`flex w-full items-center gap-3 rounded-lg bg-white p-4 text-left shadow ${checked ? 'ring-2 ring-gray-900' : ''}`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300'}`} aria-hidden="true">{checked ? '✓' : ''}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-gray-900">{service.name}</span>
                      <span className="mt-1 block text-sm text-gray-500">{service.durationMinutes} мин.</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-gray-900">{formatPrice(service.priceKzt)}</span>
                  </button>
                );
              })}
              {visibleServices.length === 0 && <p className="rounded-lg bg-white p-4 text-sm text-gray-500 shadow">В этой категории пока нет услуг</p>}
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <button type="button" onClick={() => setStep(1)} className="mb-4 py-2 text-sm font-medium text-gray-700">← Назад</button>
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Выберите мастера</h2>
            <div className="space-y-3">
              {availableMasters.map((master) => (
                <button
                  key={master.id}
                  type="button"
                  onClick={() => { setSelectedMasterId(master.id); setStep(3); setErrorMsg(''); }}
                  className="flex w-full items-center gap-4 rounded-lg bg-white p-4 text-left shadow"
                >
                  {master.photoUrl
                    ? <img src={master.photoUrl} alt="" className="h-[60px] w-[60px] rounded-full object-cover" />
                    : <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-gray-200 text-xl text-gray-500" aria-hidden="true">{master.name.slice(0, 1)}</span>}
                  <span>
                    <span className="block font-semibold text-gray-900">{master.name}</span>
                    <span className="mt-1 block text-sm text-gray-500">{formatRating(master.rating || 0, master.ratingCount || 0)}</span>
                  </span>
                </button>
              ))}
              {availableMasters.length === 0 && <p className="rounded-lg bg-white p-4 text-gray-600 shadow">Нет доступных мастеров для выбранных услуг</p>}
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <button type="button" onClick={() => setStep(2)} className="mb-4 py-2 text-sm font-medium text-gray-700">← Назад</button>
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Выберите дату и время</h2>
            <label className="mb-4 block text-sm font-medium text-gray-700">
              Дата
              <input
                type="date"
                min={todayString}
                max={maxDate}
                value={selectedDate}
                onChange={(event) => { setSelectedDate(event.target.value); setSlots([]); }}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900"
              />
            </label>
            {loadingSlots ? <p className="py-4 text-center text-sm text-gray-500">Загружаем время...</p> : selectedDate && (
              <div className="grid grid-cols-4 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.start}
                    type="button"
                    onClick={() => { setSelectedSlot(slot); setStep(4); setErrorMsg(''); }}
                    className="rounded-lg bg-white py-3 text-sm font-medium text-gray-900 shadow hover:bg-gray-100"
                  >
                    {slot.time}
                  </button>
                ))}
                {slots.length === 0 && <p className="col-span-4 rounded-lg bg-white p-4 text-center text-sm text-gray-500 shadow">Свободного времени нет</p>}
              </div>
            )}
          </section>
        )}

        {step === 4 && selectedSlot && (
          <section>
            <button type="button" onClick={() => setStep(3)} className="mb-4 py-2 text-sm font-medium text-gray-700">← Назад</button>
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Ваши контакты</h2>
            <div className="mb-5 rounded-lg bg-white p-4 text-sm text-gray-600 shadow">
              <p><span className="font-medium text-gray-900">Услуги:</span> {salon.services.filter((service) => selectedServiceIds.includes(service.id)).map((service) => service.name).join(', ')}</p>
              <p className="mt-1"><span className="font-medium text-gray-900">Мастер:</span> {selectedMaster?.name}</p>
              <p className="mt-1"><span className="font-medium text-gray-900">Дата и время:</span> {formatDate(selectedDate)}, {selectedSlot.time}</p>
            </div>
            <form onSubmit={submitAppointment} className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Имя
                <input required value={formName} onChange={(event) => setFormName(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Телефон
                <input required type="tel" value={formPhone} onChange={(event) => setFormPhone(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900" />
              </label>
              <label className="flex items-start gap-3 rounded-lg bg-white p-4 text-sm text-gray-700 shadow">
                <input required type="checkbox" checked={formConsent} onChange={(event) => setFormConsent(event.target.checked)} className="mt-0.5 h-5 w-5 rounded border-gray-300" />
                <span>Согласен на обработку персональных данных</span>
              </label>
              <button type="submit" disabled={submitting || !formConsent} className="w-full rounded-lg bg-gray-900 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? 'Отправляем...' : 'Записаться'}
              </button>
            </form>
          </section>
        )}
      </div>

      {step === 1 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-md">
            <button type="button" disabled={!selectedServiceIds.length} onClick={() => setStep(2)} className="w-full rounded-lg bg-gray-900 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Далее</button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-4 py-6 text-center text-gray-600">Загрузка...</main>}>
      <BookingFlow />
    </Suspense>
  );
}
