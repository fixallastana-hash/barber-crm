'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';
import { AddGroupAppointmentForm } from '@/components/add-group-appointment-form';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  tenantId: string;
  initialMasterId?: string;
  initialDate?: string;
};

type Client = { id: string; name: string; phoneNormalized?: string; isBlocked?: boolean };
type Service = { id: string; name: string; durationMinutes: number; priceKzt: number; isActive: boolean; bufferMinutes?: number };
type Master = { id: string; name: string; isActive: boolean; serviceIds?: string[] };
type Slot = { start: number; end: number; branchId: string; time?: string };

type Mode = 'single' | 'group';

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1);
  if (digits.length === 11 && digits.startsWith('7')) return '+' + digits;
  if (digits.length === 10) return '+7' + digits;
  return '+' + digits;
}

function phoneDigits(input: string): string {
  return input.replace(/\D/g, '');
}

export function AddAppointmentModal({ isOpen, onClose, onCreated, tenantId, initialMasterId, initialDate }: Props) {
  const [mode, setMode] = useState<Mode>('single');

  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [masters, setMasters] = useState<Master[]>([]);

  const [clientPhone, setClientPhone] = useState('');
  const [clientName, setClientName] = useState('');

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [masterId, setMasterId] = useState(initialMasterId || '');
  const [date, setDate] = useState(initialDate || '');
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const phoneNorm = useMemo(() => normalizePhone(clientPhone), [clientPhone]);
  const phoneCount = useMemo(() => phoneDigits(clientPhone).length, [clientPhone]);
  const phoneValid = phoneCount >= 10 && phoneCount <= 15;

  const matchedClient = useMemo<Client | null>(() => {
    if (!phoneValid) return null;
    const target = phoneNorm.replace(/\D/g, '');
    return clients.find((c) => (c.phoneNormalized || '').replace(/\D/g, '') === target) || null;
  }, [clients, phoneNorm, phoneValid]);

  const isNewClient = phoneValid && !matchedClient;

  const totalDuration = useMemo(
    () => services
      .filter((service) => selectedServiceIds.includes(service.id))
      .reduce((sum, service) => sum + Number(service.durationMinutes || 0), 0),
    [services, selectedServiceIds],
  );

  useEffect(() => {
    if (!isOpen) return;
    setMasterId(initialMasterId || '');
    setDate(initialDate || '');
    setMode('single');
    setError('');
    setClientPhone('');
    setClientName('');
    setSelectedServiceIds([]);
    setAvailableSlots([]);
  }, [isOpen, initialMasterId, initialDate]);

  useEffect(() => {
    if (!isOpen || !tenantId) return;
    let cancelled = false;
    const loadLists = async () => {
      setLoadingLists(true);
      setError('');
      try {
        const db = getFirebaseDb();
        const [clientSnap, serviceSnap, masterSnap] = await Promise.all([
          getDocs(collection(db, 'tenants', tenantId, 'clients')),
          getDocs(collection(db, 'tenants', tenantId, 'services')),
          getDocs(collection(db, 'tenants', tenantId, 'masters')),
        ]);
        if (cancelled) return;
        setClients(clientSnap.docs
          .map((item) => ({ id: item.id, ...(item.data() as Omit<Client, 'id'>) }))
          .filter((client) => !client.isBlocked));
        setServices(serviceSnap.docs
          .map((item) => ({ id: item.id, ...(item.data() as Omit<Service, 'id'>) }))
          .filter((service) => service.isActive));
        setMasters(masterSnap.docs
          .map((item) => ({ id: item.id, ...(item.data() as Omit<Master, 'id'>) }))
          .filter((master) => master.isActive));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить данные');
      } finally {
        if (!cancelled) setLoadingLists(false);
      }
    };
    void loadLists();
    return () => { cancelled = true; };
  }, [isOpen, tenantId]);

  useEffect(() => {
    if (!isOpen || !masterId || !date || totalDuration <= 0) {
      setAvailableSlots([]);
      return;
    }
    let cancelled = false;
    const loadSlots = async () => {
      setLoadingSlots(true);
      setError('');
      try {
        const getAvailableSlots = httpsCallable(getFirebaseFunctions(), 'getAvailableSlots');
        const result = await getAvailableSlots({ masterId, date, durationMinutes: totalDuration });
        if (!cancelled) {
          const data = result.data as { slots?: Slot[] };
          setAvailableSlots(data.slots || []);
        }
      } catch (err) {
        if (!cancelled) {
          setAvailableSlots([]);
          setError(err instanceof Error ? err.message : 'Не удалось загрузить свободное время');
        }
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    };
    void loadSlots();
    return () => { cancelled = true; };
  }, [isOpen, masterId, date, totalDuration, selectedServiceIds]);

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds((current) => current.includes(serviceId)
      ? current.filter((id) => id !== serviceId)
      : [...current, serviceId]);
  };

  const handleSelectSlot = async (slot: Slot) => {
    if (!phoneValid) {
      setError('Введите телефон клиента');
      return;
    }
    if (!masterId || !date || selectedServiceIds.length === 0) return;

    setSaving(true);
    setError('');
    try {
      let finalClientId = matchedClient?.id || '';

      if (!finalClientId) {
        const ownerFallback = clientName.trim() || `Клиент ${phoneNorm.slice(-4)}`;
        const createClientFn = httpsCallable(getFirebaseFunctions(), 'createClient');
        try {
          const res = await createClientFn({ name: ownerFallback, phone: phoneNorm });
          finalClientId = (res.data as { clientId?: string }).clientId || '';
        } catch (err) {
          const e = err as { code?: string; message?: string };
          const code = (e.code || '').replace(/^functions\//, '');
          if (code === 'already-exists') {
            // Клиент появился только что в параллельном окне — перечитаем
            const db = getFirebaseDb();
            const clientSnap = await getDocs(collection(db, 'tenants', tenantId, 'clients'));
            const found = clientSnap.docs.find(
              (d) => (d.data().phoneNormalized || '') === phoneNorm,
            );
            if (found) finalClientId = found.id;
          }
          if (!finalClientId) throw err;
        }
      }

      if (!finalClientId) {
        setError('Не удалось определить клиента');
        return;
      }

      const createAppointment = httpsCallable(getFirebaseFunctions(), 'createAppointment');
      await createAppointment({
        masterId,
        clientId: finalClientId,
        serviceIds: selectedServiceIds,
        date,
        startMinutes: slot.start,
        source: 'admin',
      });
      onCreated();
      onClose();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      const code = (e.code || '').replace(/^functions\//, '');
      if (code === 'aborted' || e.message?.includes('slot_taken')) {
        setError('Это время только что заняли. Выберите другое.');
      } else if (code === 'permission-denied') {
        setError('Клиент заблокирован.');
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось создать запись');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="appointment-modal-title"
        className="my-8 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="appointment-modal-title" className="text-xl font-bold">Новая запись</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть"
            className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800">✕</button>
        </div>

        <div className="mb-5 flex gap-1 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ' +
              (mode === 'single'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-800')
            }
          >
            Один
          </button>
          <button
            type="button"
            onClick={() => setMode('group')}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ' +
              (mode === 'group'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-800')
            }
          >
            Несколько (2–6)
          </button>
        </div>

        {loadingLists ? (
          <p className="text-sm text-gray-500">Загрузка данных...</p>
        ) : mode === 'single' ? (
          <div className="space-y-5">
            {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            <div className="rounded border border-gray-200 bg-gray-50 p-3">
              <span className="mb-2 block text-sm font-medium text-gray-700">Телефон клиента</span>
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+7 ___ ___ __ __"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />

              {phoneValid && matchedClient && (
                <div className="mt-2 flex items-start gap-2 rounded border border-green-200 bg-green-50 p-2.5">
                  <span className="mt-0.5 text-green-600">✓</span>
                  <div className="min-w-0 flex-1 text-sm">
                    <b className="block truncate text-green-800">{matchedClient.name}</b>
                    <span className="block truncate text-xs text-green-700">{matchedClient.phoneNormalized}</span>
                  </div>
                </div>
              )}

              {phoneValid && !matchedClient && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Имя нового клиента (не обязательно)"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              )}

              {!phoneValid && clientPhone && (
                <p className="mt-1.5 text-xs text-gray-500">Введите номер полностью (10–15 цифр)</p>
              )}
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-gray-700">Услуги</legend>
              {services.length === 0 ? <p className="text-sm text-gray-500">Нет активных услуг.</p> : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {services.map((service) => (
                    <label key={service.id} className="flex items-center gap-2 rounded border p-3">
                      <input type="checkbox" checked={selectedServiceIds.includes(service.id)} onChange={() => toggleService(service.id)} />
                      <span className="text-sm">{service.name} · {service.durationMinutes} мин · {Number(service.priceKzt || 0).toLocaleString('ru-RU')} ₸</span>
                    </label>
                  ))}
                </div>
              )}
              {totalDuration > 0 && <p className="mt-2 text-sm text-gray-500">Общая длительность: {totalDuration} мин</p>}
            </fieldset>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Мастер</span>
              <select value={masterId} onChange={(event) => setMasterId(event.target.value)}
                className="w-full rounded border px-3 py-2">
                <option value="">Выберите мастера</option>
                {masters.map((master) => <option key={master.id} value={master.id}>{master.name}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Дата</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)}
                className="w-full rounded border px-3 py-2" />
            </label>

            <section>
              <h3 className="mb-2 text-sm font-medium text-gray-700">Свободное время</h3>
              {!phoneValid || !masterId || !date || totalDuration <= 0 ? (
                <p className="text-sm text-gray-500">Заполните телефон, услуги, мастера и дату, чтобы увидеть слоты.</p>
              ) : loadingSlots ? <p className="text-sm text-gray-500">Загрузка слотов...</p> : availableSlots.length === 0 ? (
                <p className="text-sm text-gray-500">Свободного времени нет.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableSlots.map((slot, index) => (
                    <button key={slot.start + '-' + slot.branchId + '-' + index} type="button"
                      onClick={() => void handleSelectSlot(slot)} disabled={saving}
                      className="rounded border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                      {slot.time || minutesToTime(slot.start)}
                    </button>
                  ))}
                </div>
              )}
              {saving && <p className="mt-2 text-sm text-gray-500">Создание записи...</p>}
            </section>
          </div>
        ) : (
          <AddGroupAppointmentForm
            tenantId={tenantId}
            clients={clients}
            services={services}
            masters={masters}
            initialDate={initialDate}
            onCreated={onCreated}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}