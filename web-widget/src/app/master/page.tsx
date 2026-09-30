'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';
import { MasterSkeleton } from '@/components/master-skeleton';

type Appointment = { id: string; date: string; startMinutes: number; endMinutes: number; clientName: string; serviceNames: string[]; status: string };
type ScheduleResponse = { masterName: string; masterPhotoUrl: string; masterRating: number; masterRatingCount: number; appointments: Appointment[] };

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        let width = image.width, height = image.height;
        const maxSize = 800;
        if (width > maxSize) { height = height * maxSize / width; width = maxSize; }
        canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) { reject(new Error('Не удалось обработать изображение')); return; }
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', .85).split(',')[1]);
      };
      image.onerror = () => reject(new Error('Не удалось прочитать изображение'));
      image.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

function minutesToTime(minutes: number) { return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`; }
function formatDateRu(dateStr: string) { const d = new Date(dateStr + 'T12:00:00'); const days = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота']; const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']; return `${d.getDate()} ${months[d.getMonth()]}, ${days[d.getDay()]}`; }
function dayParts(dateStr: string) { const d = new Date(dateStr + 'T12:00:00'); return { day: String(d.getDate()).padStart(2,'0'), weekday: ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][d.getDay()] }; }
function statusLabel(s: string) { return s === 'confirmed' ? 'Подтверждена' : s === 'completed' ? 'Завершена' : s === 'noshow' ? 'Не пришёл' : s; }
function statusClass(s: string) { return `master-status ${s === 'confirmed' ? 'master-status-confirmed' : s === 'completed' ? 'master-status-completed' : s === 'noshow' ? 'master-status-noshow' : 'master-status-default'}`; }

const Icon = ({ type }: { type: 'calendar' | 'refresh' | 'camera' | 'star' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d={
        type === 'calendar'
          ? 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z'
          : type === 'camera'
          ? 'M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z'
          : type === 'star'
          ? 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z'
          : 'M20 11a8.1 8.1 0 0 0-14.7-4L4 9M4 4v5h5M4 13a8.1 8.1 0 0 0 14.7 4L20 15M20 20v-5h-5'
      }
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {type === 'camera' && <circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.7" />}
  </svg>
);

function MasterScheduleInner() {
  const searchParams = useSearchParams(), fileInputRef = useRef<HTMLInputElement>(null);
  const [token, setToken] = useState(''), [masterName, setMasterName] = useState(''), [masterPhotoUrl, setMasterPhotoUrl] = useState(''), [masterRating, setMasterRating] = useState(0), [masterRatingCount, setMasterRatingCount] = useState(0), [appointments, setAppointments] = useState<Appointment[]>([]), [loading, setLoading] = useState(false), [uploadingPhoto, setUploadingPhoto] = useState(false), [error, setError] = useState(''), [newAppointmentCount, setNewAppointmentCount] = useState(0);
  const knownAppointmentIdsRef = useRef<Set<string> | null>(null), pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = searchParams.get('token');
    if (t) { localStorage.setItem('masterToken', t); setToken(t); }
    else { const saved = localStorage.getItem('masterToken'); if (saved) setToken(saved); }
  }, [searchParams]);

  const loadSchedule = useCallback(async (masterToken: string) => {
    if (!masterToken) return;
    setLoading(true); setError('');
    try {
      const today = new Date(), dateFrom = today.toISOString().slice(0,10), future = new Date(today.getTime() + 7*86400000), dateTo = future.toISOString().slice(0,10);
      const fn = httpsCallable(getFirebaseFunctions(), 'getMasterSchedule');
      const result = await fn({ token: masterToken, dateFrom, dateTo });
      const data = result.data as ScheduleResponse;
      setMasterName(data.masterName);
      setMasterPhotoUrl(data.masterPhotoUrl || '');
      setMasterRating(data.masterRating || 0);
      setMasterRatingCount(data.masterRatingCount || 0);
      const incoming = Array.isArray(data.appointments) ? data.appointments : [], ids = new Set(incoming.map(a => a.id));
      if (knownAppointmentIdsRef.current === null) knownAppointmentIdsRef.current = ids;
      else {
        let added = 0;
        incoming.forEach(a => { if (!knownAppointmentIdsRef.current?.has(a.id)) added++; });
        if (added) {
          setNewAppointmentCount(c => c + added);
          if ('vibrate' in navigator && typeof navigator.vibrate === 'function') navigator.vibrate([200,100,200]);
        }
        knownAppointmentIdsRef.current = ids;
      }
      setAppointments(incoming);
    } catch (err) {
      setError('Ошибка: ' + (err instanceof Error ? err.message : 'неизвестная ошибка'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!token) return;
    knownAppointmentIdsRef.current = null;
    setNewAppointmentCount(0);
    void loadSchedule(token);
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(() => void loadSchedule(token), 15000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); pollingRef.current = null; };
  }, [token, loadSchedule]);

  const handleManualToken = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); localStorage.setItem('masterToken', token); void loadSchedule(token); };
  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingPhoto(true); setError('');
    try {
      const photoBase64 = await compressImage(file), fn = httpsCallable(getFirebaseFunctions(), 'uploadMasterPhoto'), result = await fn({ token, photoBase64 });
      setMasterPhotoUrl((result.data as { photoUrl: string }).photoUrl);
    } catch (err) {
      setError('Не удалось загрузить фото: ' + (err instanceof Error ? err.message : 'неизвестная ошибка'));
    } finally { setUploadingPhoto(false); e.target.value = ''; }
  };
  const grouped = appointments.reduce<Record<string, Appointment[]>>((r, a) => { (r[a.date] ??= []).push(a); return r; }, {});

  if (!token) return (
    <main className="master-page master-login-page">
      <div className="master-login-shell">
        <div className="master-brand-mark"><Icon type="calendar" /></div>
        <div className="master-login-card">
          <div className="master-login-kicker">BARBER CRM</div>
          <h1>Кабинет мастера</h1>
          <p>Вставьте ссылку или токен, который вы получили от администратора.</p>
          <form onSubmit={handleManualToken}>
            <label className="master-label" htmlFor="master-token">Токен доступа</label>
            <input id="master-token" value={token} onChange={e => setToken(e.target.value)} placeholder="Введите токен" required className="master-input" />
            <button className="master-primary-button">Открыть календарь</button>
          </form>
        </div>
      </div>
    </main>
  );

  return (
    <main className="master-page">
      <div className="master-shell">
        <header className="master-profile-card">
          <div className="master-profile-main">
            <div className="master-avatar-wrap">
              {masterPhotoUrl
                ? <img src={masterPhotoUrl} alt="Фото мастера" className="master-avatar" />
                : <div className="master-avatar master-avatar-placeholder">{(masterName || '?').charAt(0).toUpperCase()}</div>}
              <button className="master-avatar-edit" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto} aria-label="Изменить фото"><Icon type="camera" /></button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelected} className="master-hidden-input" />
            </div>
            <div className="master-profile-copy">
              <div className="master-eyebrow">ВАШ КАЛЕНДАРЬ</div>
              <h1>{masterName || 'Календарь мастера'}</h1>
              <div className="master-rating">
                <Icon type="star" />
                {masterRatingCount > 0
                  ? <><strong>{masterRating.toFixed(1)}</strong><span>{masterRatingCount} отзывов</span></>
                  : <span>Пока нет отзывов</span>}
              </div>
              <button className="master-photo-link" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto}>
                {uploadingPhoto ? 'Загрузка фото…' : 'Изменить фото'}
              </button>
            </div>
          </div>
          <div className="master-live"><span />Онлайн</div>
        </header>

        <div className="master-toolbar">
          <div>
            <div className="master-toolbar-title">Ближайшие записи</div>
            <div className="master-toolbar-subtitle">На следующие 7 дней</div>
          </div>
          <button className="master-refresh-button" onClick={() => { setNewAppointmentCount(0); void loadSchedule(token); }} disabled={loading}>
            <Icon type="refresh" />{loading ? 'Обновление…' : 'Обновить'}
          </button>
        </div>

        {newAppointmentCount > 0 && (
          <div className="master-new-card">
            <div className="master-new-icon" />
            <div className="master-new-copy">
              <strong>{newAppointmentCount === 1 ? 'Новая запись' : 'Новые записи'}</strong>
              <span>{newAppointmentCount} новых записей в календаре</span>
            </div>
            <button onClick={() => setNewAppointmentCount(0)}>Понятно</button>
          </div>
        )}

        {error && (
          <div className="master-error">
            <strong>Не удалось обновить календарь</strong>
            <span>{error}</span>
          </div>
        )}

        {Object.keys(grouped).length === 0 && !loading && (
          <div className="master-empty">
            <div className="master-empty-icon"><Icon type="calendar" /></div>
            <h2>Свободный календарь</h2>
            <p>На ближайшие 7 дней записей пока нет.</p>
          </div>
        )}

        <div className="master-days">
          {Object.entries(grouped).map(([date, items]) => {
            const d = dayParts(date);
            return (
              <section key={date} className="master-day-section">
                <div className="master-day-heading">
                  <div className="master-day-number">{d.day}</div>
                  <div><h2>{d.weekday}</h2><p>{formatDateRu(date).split(', ')[0]}</p></div>
                  <div className="master-day-count">
                    {items.length} {items.length === 1 ? 'запись' : items.length < 5 ? 'записи' : 'записей'}
                  </div>
                </div>
                <div className="master-appointments">
                  {items.map(a => (
                    <article key={a.id} className="master-appointment">
                      <div className="master-time-column">
                        <strong>{minutesToTime(a.startMinutes)}</strong>
                        <span>{minutesToTime(a.endMinutes)}</span>
                      </div>
                      <div className="master-appointment-line" />
                      <div className="master-appointment-body">
                        <div className="master-appointment-top">
                          <h3>{a.clientName}</h3>
                          <span className={statusClass(a.status)}>{statusLabel(a.status)}</span>
                        </div>
                        <p>{a.serviceNames.length ? a.serviceNames.join(' · ') : 'Услуга не указана'}</p>
                        <span className="master-duration">
                          {minutesToTime(Math.max(0, a.endMinutes - a.startMinutes))} длительность
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}

export default function MasterPage() {
  return (
    <Suspense fallback={<MasterSkeleton />}>
      <MasterScheduleInner />
    </Suspense>
  );
}