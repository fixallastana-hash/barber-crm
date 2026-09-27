'use client';

import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';

type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceKzt: number;
};

type Props = {
  service: Service | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export default function EditServiceModal({ service, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [bufferMinutes, setBufferMinutes] = useState('0');
  const [priceKzt, setPriceKzt] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (service) {
      setName(service.name);
      setDurationMinutes(String(service.durationMinutes));
      setBufferMinutes(String(service.bufferMinutes));
      setPriceKzt(String(service.priceKzt));
    } else {
      setName('');
      setDurationMinutes('');
      setBufferMinutes('0');
      setPriceKzt('');
    }
    setSaving(false);
    setSaved(false);
    setError('');
  }, [service]);

  if (!service) return null;

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');

    try {
      const updateService = httpsCallable(getFirebaseFunctions(), 'updateService');
      await updateService({
        serviceId: service.id,
        name: name.trim(),
        durationMinutes: Number(durationMinutes),
        bufferMinutes: Number(bufferMinutes),
        priceKzt: Number(priceKzt),
      });
      await onSaved();
      setSaving(false);
      setSaved(true);
      window.setTimeout(onClose, 2000);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Не удалось сохранить услугу');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Редактировать услугу</h2>
          <button type="button" onClick={onClose} disabled={saving} className="text-2xl text-gray-400 hover:text-gray-600 disabled:opacity-50" aria-label="Закрыть">×</button>
        </div>

        {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {saved && <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-700">Сохранено</p>}

        <form onSubmit={handleSave} className="space-y-4">
          <label className="block">
            <span className="text-sm text-gray-700">Название *</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required disabled={saving} className="mt-1 w-full rounded border px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Длительность (минуты) *</span>
            <input type="number" min={1} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} required disabled={saving} className="mt-1 w-full rounded border px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Буфер (минуты)</span>
            <input type="number" min={0} value={bufferMinutes} onChange={(e) => setBufferMinutes(e.target.value)} disabled={saving} className="mt-1 w-full rounded border px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Цена (₸) *</span>
            <input type="number" min={0} value={priceKzt} onChange={(e) => setPriceKzt(e.target.value)} required disabled={saving} className="mt-1 w-full rounded border px-3 py-2" />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="rounded border px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50">Отмена</button>
            <button type="submit" disabled={saving || saved} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
