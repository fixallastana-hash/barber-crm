'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  tenantId: string;
};

type Client = { id: string; name: string; phoneNormalized?: string; isBlocked?: boolean };
type Service = { id: string; name: string; durationMinutes: number; priceKzt: number; isActive: boolean };
type Master = { id: string; name: string; isActive: boolean };
type Slot = { start: number; end: number; branchId: string; time?: string };

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return String(hours).padStart(2, '0') + ':' + String(remainder).padStart(2, '0');
}

export function AddAppointmentModal({ isOpen, onClose, onCreated, tenantId }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [masters, setMasters] = useState<Master[]>([]);
  const [clientId, setClientId] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [masterId, setMasterId] = useState('');
  const [date, setDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totalDuration = useMemo(
    () => services
      .filter((service) => selectedServiceIds.includes(service.id))
      .reduce((sum, service) => sum + Number(service.durationMinutes || 0), 0),
    [services, selectedServiceIds],
  );

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
    if (!clientId || !masterId || !date || selectedServiceIds.length === 0) return;
    setSaving(true);
    setError('');
    try {
      const createAppointment = httpsCallable(getFirebaseFunctions(), 'createAppointment');
      await createAppointment({
        masterId,
        clientId,
        serviceIds: selectedServiceIds,
        date,
        startMinutes: slot.start,
        source: 'admin',
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать запись');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="appointment-modal-title"
        className="my-8 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="appointment-modal-title" className="text-xl font-bold">Новая запись</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть"
            className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800">✕</button>
        </div>

        {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {loadingLists ? <p>Загрузка данных...</p> : (
          <div className="space-y-5">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">1. Клиент</span>
              <select value={clientId} onChange={(event) => setClientId(event.target.value)}
                className="w-full rounded border px-3 py-2">
                <option value="">Выберите клиента</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.phoneNormalized ? ' · ' + client.phoneNormalized : ''}</option>)}
              </select>
            </label>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-gray-700">2. Услуги</legend>
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
              <span className="mb-1 block text-sm font-medium text-gray-700">3. Мастер</span>
              <select value={masterId} onChange={(event) => setMasterId(event.target.value)}
                className="w-full rounded border px-3 py-2">
                <option value="">Выберите мастера</option>
                {masters.map((master) => <option key={master.id} value={master.id}>{master.name}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">4. Дата</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)}
                className="w-full rounded border px-3 py-2" />
            </label>

            <section>
              <h3 className="mb-2 text-sm font-medium text-gray-700">5. Свободное время</h3>
              {!masterId || !date || totalDuration <= 0 ? (
                <p className="text-sm text-gray-500">Выберите клиента, услуги, мастера и дату, чтобы увидеть слоты.</p>
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
        )}
      </div>
    </div>
  );
}
