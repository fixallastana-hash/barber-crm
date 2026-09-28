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

  if (status === 'loading') return <main className="book-state"><div className="book-state-card">Загрузка…</div></main>;
  if (status === 'gone') return <main className="book-state"><div className="book-state-card"><b>Салон больше не принимает записи</b><span>Пожалуйста, свяжитесь с салоном напрямую.</span></div></main>;
  if (status !== 'ok' || !salon) return <main className="book-state"><div className="book-state-card"><b>Салон не найден</b><span>Проверьте ссылку на запись.</span></div></main>;

  if (success) return (
    <main className="book-state">
      <div className="book-success">
        <div className="book-success-icon">✓</div>
        <div className="book-kicker">BARBER CRM</div>
        <h1>Запись отправлена</h1>
        <p>Спасибо! Мы свяжемся с вами для подтверждения записи.</p>
      </div>
    </main>
  );

  const selectedMaster = salon.masters.find(m => m.id === masterId);
  const services = salon.services.filter(s => s.categoryId === categoryId);
  const masters = salon.masters.filter(m => m.serviceIds?.some(id => serviceIds.includes(id)));
  const selectedServices = salon.services.filter(s => serviceIds.includes(s.id));
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.priceKzt, 0);
  const steps = ['Услуги', 'Мастер', 'Время', 'Контакты'];

  return (
    <main className="book-page">
      <div className="book-shell">
        <header className="book-header">
          <div>
            <div className="book-kicker">{salon.tenant.city}</div>
            <h1>{salon.tenant.name}</h1>
            <p>Онлайн-запись</p>
          </div>
          <div className="book-logo">✦</div>
        </header>

        <div className="book-progress">
          {steps.map((label, i) => (
            <div key={label} className={`book-progress-item ${step === i+1 ? 'active' : ''} ${step > i+1 ? 'done' : ''}`}>
              <span>{i+1}</span><small>{label}</small>
            </div>
          ))}
        </div>

        {error && <div className="book-error"><b>Не получилось</b><span>{error}</span></div>}

        {step === 1 && (
          <section className="book-section">
            <div className="book-section-head">
              <div><span>ШАГ 1</span><h2>Выберите услуги</h2><p>Можно выбрать несколько услуг</p></div>
              {serviceIds.length > 0 && <strong>{money(totalPrice)}</strong>}
            </div>
            <div className="book-chips">
              {salon.categories.map(c => (
                <button key={c.id} type="button" onClick={() => setCategoryId(c.id)} className={categoryId === c.id ? 'selected' : ''}>{c.name}</button>
              ))}
            </div>
            <div className="book-list">
              {services.map(s => {
                const checked = serviceIds.includes(s.id);
                return <button key={s.id} type="button" onClick={() => toggleService(s.id)} className={`book-service ${checked ? 'selected' : ''}`}>
                  <span className={`book-check ${checked ? 'checked' : ''}`}>{checked ? '✓' : ''}</span>
                  <span className="book-service-main"><b>{s.name}</b><small>{s.durationMinutes} мин.</small></span>
                  <strong>{money(s.priceKzt)}</strong>
                </button>;
              })}
              {!services.length && <div className="book-empty-inline">В этой категории пока нет услуг.</div>}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="book-section">
            <button type="button" className="book-back" onClick={() => setStep(1)}>← Назад</button>
            <div className="book-section-head"><div><span>ШАГ 2</span><h2>Выберите мастера</h2><p>Кто будет выполнять выбранные услуги</p></div></div>
            <div className="book-master-list">
              {masters.map(m => <button key={m.id} type="button" className="book-master" onClick={() => { setMasterId(m.id); setStep(3); setError(''); }}>
                {m.photoUrl ? <img src={m.photoUrl} alt="" /> : <span className="book-master-avatar">{m.name.slice(0,1)}</span>}
                <span><b>{m.name}</b><small>{rating(m.rating || 0, m.ratingCount || 0)}</small></span><i>›</i>
              </button>)}
              {!masters.length && <div className="book-empty-inline">Нет доступных мастеров для выбранных услуг.</div>}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="book-section">
            <button type="button" className="book-back" onClick={() => setStep(2)}>← Назад</button>
            <div className="book-section-head"><div><span>ШАГ 3</span><h2>Дата и время</h2><p>{selectedMaster?.name || 'Выберите удобное время'}</p></div></div>
            <label className="book-date"><span>Дата записи</span><input type="date" min={todayString} max={maxDate} value={date} onChange={e => { setDate(e.target.value); setSlots([]); }} /></label>
            {loadingSlots ? <div className="book-loading">Загружаем свободное время…</div> : date && <div className="book-slots">
              {slots.map(s => <button key={s.start} type="button" onClick={() => { setSlot(s); setStep(4); setError(''); }}>{s.time}</button>)}
              {!slots.length && <div className="book-empty-inline">Свободного времени нет.</div>}
            </div>}
          </section>
        )}

        {step === 4 && slot && (
          <section className="book-section">
            <button type="button" className="book-back" onClick={() => setStep(3)}>← Назад</button>
            <div className="book-section-head"><div><span>ШАГ 4</span><h2>Ваши контакты</h2><p>Оставьте данные для подтверждения записи</p></div></div>
            <div className="book-summary">
              <div><span>Услуги</span><b>{selectedServices.map(s => s.name).join(', ')}</b></div>
              <div><span>Мастер</span><b>{selectedMaster?.name}</b></div>
              <div><span>Дата и время</span><b>{dateRu(date)}, {slot.time}</b></div>
              <div><span>Стоимость</span><b>{money(totalPrice)}</b></div>
            </div>
            <form onSubmit={submit} className="book-form">
              <label><span>Имя</span><input required value={name} onChange={e => setName(e.target.value)} placeholder="Как к вам обращаться?" /></label>
              <label><span>Телефон</span><input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 ___ ___ __ __" /></label>
              <label className="book-consent"><input required type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>Согласен на обработку персональных данных</span></label>
              <button className="book-primary" type="submit" disabled={submitting || !consent}>{submitting ? 'Отправляем…' : 'Подтвердить запись'}</button>
            </form>
          </section>
        )}
      </div>

      {step === 1 && <div className="book-bottom"><button type="button" disabled={!serviceIds.length} onClick={() => setStep(2)}>Продолжить <span>→</span></button></div>}
    </main>
  );
}

export default function BookPage() {
  return <Suspense fallback={<main className="book-state"><div className="book-state-card">Загрузка…</div></main>}><BookingFlow /></Suspense>;
}