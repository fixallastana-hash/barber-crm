'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import SalonBannerModal from '@/components/salon-banner-modal';

type SalonInfo = {
  name: string;
  city: string;
  phone: string;
  whatsappBusinessNumber: string;
  dgisUrl: string;
  bannerUrl?: string;
  cancellationWindowHours: number;
  noshowBlockThreshold: number;
  requireConfirmation: boolean;
  pendingConfirmationTimeoutMinutes: number;
  widgetSlug: string;
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [info, setInfo] = useState<SalonInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [slug, setSlug] = useState('');
  const [savingSlug, setSavingSlug] = useState(false);
  const [slugMessage, setSlugMessage] = useState('');
  const [slugError, setSlugError] = useState('');
  const [slugSaved, setSlugSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bannerModalOpen, setBannerModalOpen] = useState(false);

  useEffect(() => {
    if (!user?.tenantId) return;
    let cancelled = false;

    const db = getFirebaseDb();
    getDoc(doc(db, 'tenants', user.tenantId, 'config', 'info'))
      .then((snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          const salonInfo = snap.data() as SalonInfo;
          setInfo(salonInfo);
          setSlug(salonInfo.widgetSlug || '');
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        setMessage('Не удалось загрузить настройки салона');
      });

    return () => {
      cancelled = true;
    };
  }, [user?.tenantId]);

  const handleSaveSlug = async () => {
    const normalizedSlug = slug.trim().toLowerCase();
    setSlug(normalizedSlug);
    setSlugMessage('');
    setSlugError('');
    setSlugSaved(false);

    if (
      normalizedSlug.length < 3 ||
      normalizedSlug.length > 50 ||
      !/^[a-z0-9-]+$/.test(normalizedSlug)
    ) {
      setSlugError('Введите от 3 до 50 символов: только латиница, цифры и дефис');
      return;
    }

    setSavingSlug(true);
    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'updateWidgetSlug');
      const res = await fn({ slug: normalizedSlug });
      const data = res.data as { slug: string };
      setSlug(data.slug);
      setSlugMessage('Сохранено');
      setSlugError('');
      setSlugSaved(true);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'already-exists' || error.code?.endsWith('/already-exists')) {
        setSlugError('Этот slug уже занят, выберите другой');
      } else {
        setSlugError('Ошибка: ' + (error.message || 'unknown'));
      }
    } finally {
      setSavingSlug(false);
    }
  };

  const widgetUrl =
    'https://barber-crm-widget.web.app/book?slug=' + encodeURIComponent(slug);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(widgetUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setSlugError('Не удалось скопировать ссылку');
    }
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!info) return;

    setSaving(true);
    setMessage('');
    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'updateSalonInfo');
      await fn(info);
      setMessage('Сохранено');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'unknown';
      setMessage('Ошибка: ' + errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleBannerChanged = (bannerUrl: string) => {
    setInfo((prev) => (prev ? { ...prev, bannerUrl } : prev));
  };

  if (loading) return <p>Загрузка...</p>;
  if (!info) return <p>{message || 'Данные салона не найдены'}</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Настройки салона</h1>

      {/* Фото салона (шапка) */}
      <section className="mb-6 rounded-lg bg-white p-6 shadow">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Фото салона (шапка)</h2>
          <p className="mt-1 text-sm text-gray-600">
            Показывается фоном в шапке страницы онлайн-записи. Лучше горизонтальное
            фото 3:1 (например, 1200×400).
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-20 w-48 overflow-hidden rounded-lg border bg-gray-50">
            {info.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={info.bannerUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                Нет фото
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setBannerModalOpen(true)}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            {info.bannerUrl ? 'Изменить фото' : 'Загрузить фото'}
          </button>
        </div>
      </section>

      {/* Slug */}
      <section className="mb-6 space-y-4 rounded-lg bg-white p-6 shadow">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Публичная ссылка для записи
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Задайте короткое имя для страницы онлайн-записи.
          </p>
        </div>
        <label className="block">
          <span className="text-sm text-gray-700">Slug салона</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugMessage('');
              setSlugError('');
              setSlugSaved(false);
            }}
            autoCapitalize="none"
            autoCorrect="off"
            className="mt-1 w-full rounded border px-3 py-2"
          />
          <span className="mt-1 block text-sm text-gray-500">
            Только латиница, цифры и дефис. Например: barbershop-almaty
          </span>
        </label>
        <button
          type="button"
          onClick={handleSaveSlug}
          disabled={savingSlug}
          className="rounded bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {savingSlug ? 'Сохраняем...' : 'Сохранить ссылку'}
        </button>
        {slugMessage && (
          <p role="status" className="text-sm text-green-700">
            {slugMessage}
          </p>
        )}
        {slugError && (
          <p role="alert" className="text-sm text-red-700">
            {slugError}
          </p>
        )}
        {slugSaved && (
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="break-all text-sm text-gray-700">Ваша ссылка: {widgetUrl}</p>
            <button
              type="button"
              onClick={handleCopyLink}
              className="mt-3 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Скопировать
            </button>
            {copied && (
              <span role="status" className="ml-3 text-sm text-green-700">
                Скопировано
              </span>
            )}
          </div>
        )}
      </section>

      {/* Info */}
      {message && (
        <div className="mb-4 rounded bg-blue-50 p-3 text-sm text-blue-700">
          {message}
        </div>
      )}
      <form
        onSubmit={handleSave}
        className="space-y-4 rounded-lg bg-white p-6 shadow"
      >
        <label className="block">
          <span className="text-sm text-gray-700">Название салона</span>
          <input
            type="text"
            value={info.name}
            onChange={(e) => setInfo({ ...info, name: e.target.value })}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Город</span>
          <input
            type="text"
            value={info.city}
            onChange={(e) => setInfo({ ...info, city: e.target.value })}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Телефон</span>
          <input
            type="tel"
            value={info.phone}
            onChange={(e) => setInfo({ ...info, phone: e.target.value })}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">WhatsApp Business номер</span>
          <input
            type="tel"
            value={info.whatsappBusinessNumber || ''}
            onChange={(e) =>
              setInfo({ ...info, whatsappBusinessNumber: e.target.value })
            }
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Ссылка на 2ГИС</span>
          <input
            type="url"
            value={info.dgisUrl || ''}
            onChange={(e) => setInfo({ ...info, dgisUrl: e.target.value })}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-gray-700">Отмена за N часов</span>
            <input
              type="number"
              min={1}
              value={info.cancellationWindowHours}
              onChange={(e) =>
                setInfo({
                  ...info,
                  cancellationWindowHours: Number(e.target.value),
                })
              }
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Порог no-show</span>
            <input
              type="number"
              min={1}
              value={info.noshowBlockThreshold}
              onChange={(e) =>
                setInfo({
                  ...info,
                  noshowBlockThreshold: Number(e.target.value),
                })
              }
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={info.requireConfirmation}
            onChange={(e) =>
              setInfo({ ...info, requireConfirmation: e.target.checked })
            }
          />
          <span className="text-sm text-gray-700">
            Требовать подтверждения новых записей
          </span>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded bg-blue-600 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </form>

      {bannerModalOpen && (
        <SalonBannerModal
          initialBannerUrl={info.bannerUrl}
          onClose={() => setBannerModalOpen(false)}
          onSaved={(bannerUrl) => {
            handleBannerChanged(bannerUrl);
            setBannerModalOpen(false);
          }}
        />
      )}
    </div>
  );
}