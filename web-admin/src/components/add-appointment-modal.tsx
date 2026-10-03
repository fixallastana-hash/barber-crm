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

export function AddAppointmentModal({ isOpen, onClose, onCreated, tenantId, initialMasterId, initialDate }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [masters, setMasters] = useState<Master[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [error, setError] = useState('');

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

        {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {loadingLists ? (
          <p className="text-sm text-gray-500">Загрузка данных...</p>
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