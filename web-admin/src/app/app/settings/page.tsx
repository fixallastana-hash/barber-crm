'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

type SalonInfo = {
  name: string;
  city: string;
  phone: string;
  whatsappBusinessNumber: string;
  dgisUrl: string;
  cancellationWindowHours: number;
  noshowBlockThreshold: number;
  requireConfirmation: boolean;
  pendingConfirmationTimeoutMinutes: number;
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [info, setInfo] = useState<SalonInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user?.tenantId) return;

    const db = getFirebaseDb();
    getDoc(doc(db, 'tenants', user.tenantId, 'config', 'info')).then((snap) => {
      if (snap.exists()) {
        setInfo(snap.data() as SalonInfo);
      }
      setLoading(false);
    });
  }, [user]);

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

  if (loading) return <p>Загрузка...</p>;
  if (!info) return <p>Данные салона не найдены</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Настройки салона</h1>
      {message && (
        <div className="mb-4 p-3 rounded bg-blue-50 text-blue-700 text-sm">
          {message}
        </div>
      )}
      <form onSubmit={handleSave} className="space-y-4 bg-white p-6 rounded-lg shadow">
        <label className="block">
          <span className="text-sm text-gray-700">Название салона</span>
          <input
            type="text"
            value={info.name}
            onChange={(e) => setInfo({ ...info, name: e.target.value })}
            className="mt-1 w-full px-3 py-2 border rounded"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Город</span>
          <input
            type="text"
            value={info.city}
            onChange={(e) => setInfo({ ...info, city: e.target.value })}
            className="mt-1 w-full px-3 py-2 border rounded"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Телефон</span>
          <input
            type="tel"
            value={info.phone}
            onChange={(e) => setInfo({ ...info, phone: e.target.value })}
            className="mt-1 w-full px-3 py-2 border rounded"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">WhatsApp Business номер</span>
          <input
            type="tel"
            value={info.whatsappBusinessNumber || ''}
            onChange={(e) => setInfo({ ...info, whatsappBusinessNumber: e.target.value })}
            className="mt-1 w-full px-3 py-2 border rounded"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Ссылка на 2ГИС</span>
          <input
            type="url"
            value={info.dgisUrl || ''}
            onChange={(e) => setInfo({ ...info, dgisUrl: e.target.value })}
            className="mt-1 w-full px-3 py-2 border rounded"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-gray-700">Отмена за N часов</span>
            <input
              type="number"
              min={1}
              value={info.cancellationWindowHours}
              onChange={(e) => setInfo({ ...info, cancellationWindowHours: Number(e.target.value) })}
              className="mt-1 w-full px-3 py-2 border rounded"
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Порог no-show</span>
            <input
              type="number"
              min={1}
              value={info.noshowBlockThreshold}
              onChange={(e) => setInfo({ ...info, noshowBlockThreshold: Number(e.target.value) })}
              className="mt-1 w-full px-3 py-2 border rounded"
            />
          </label>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={info.requireConfirmation}
            onChange={(e) => setInfo({ ...info, requireConfirmation: e.target.checked })}
          />
          <span className="text-sm text-gray-700">
            Требовать подтверждения новых записей
          </span>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </form>
    </div>
  );
}
