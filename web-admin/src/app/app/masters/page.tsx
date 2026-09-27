'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import EditMasterCompensationModal from '@/components/edit-master-compensation-modal';

type Branch = {
  id: string;
  name: string;
  isActive: boolean;
};

type Master = {
  id: string;
  name: string;
  whatsappNumber: string;
  primaryBranchId: string;
  type: string;
  isActive: boolean;
  photoUrl?: string;
  rating?: number;
  ratingCount?: number;
};

export default function MastersPage() {
  const { user } = useAuth();

  const [masters, setMasters] = useState<Master[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [primaryBranchId, setPrimaryBranchId] = useState('');
  const [type, setType] = useState<'employee' | 'renter'>('employee');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [compensationMaster, setCompensationMaster] =
    useState<Master | null>(null);

  useEffect(() => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }

    const db = getFirebaseDb();

    const unsubMasters = onSnapshot(
      collection(db, 'tenants', user.tenantId, 'masters'),
      (snap) => {
        setMasters(
          snap.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<Master, 'id'>),
          })),
        );

        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    const unsubBranches = onSnapshot(
      collection(db, 'tenants', user.tenantId, 'branches'),
      (snap) => {
        setBranches(
          snap.docs
            .map((item) => ({
              id: item.id,
              ...(item.data() as Omit<Branch, 'id'>),
            }))
            .filter((branch) => branch.isActive),
        );
      },
      (err) => setError(err.message),
    );

    return () => {
      unsubMasters();
      unsubBranches();
    };
  }, [user?.tenantId]);

  const handleCreate = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setSaving(true);
    setError('');

    try {
      const createMaster = httpsCallable(
        getFirebaseFunctions(),
        'createMaster',
      );

      await createMaster({
        name,
        whatsappNumber,
        primaryBranchId,
        type,
      });

      setName('');
      setWhatsappNumber('');
      setPrimaryBranchId('');
      setType('employee');
      setShowForm(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось создать мастера',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (masterId: string) => {
    if (!window.confirm('Деактивировать мастера?')) return;

    setError('');

    try {
      const deactivateMaster = httpsCallable(
        getFirebaseFunctions(),
        'deactivateMaster',
      );

      await deactivateMaster({ masterId });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось деактивировать мастера',
      );
    }
  };

  const handleCopyLink = async (masterId: string) => {
    try {
      const generateMasterToken = httpsCallable(
        getFirebaseFunctions(),
        'generateMasterToken',
      );

      const result = await generateMasterToken({ masterId });

      const data = result.data as { token: string };

      const url =
        'https://barber-crm-widget.web.app/master?token=' +
        data.token;

      await navigator.clipboard.writeText(url);

      window.alert(
        'Ссылка скопирована:\n\n' +
          url +
          '\n\nОтправьте её мастеру. Он сохранит на главный экран.',
      );
    } catch (err) {
      window.alert(
        'Ошибка: ' +
          (err instanceof Error
            ? err.message
            : 'неизвестная ошибка'),
      );
    }
  };

  if (loading) return <p>Загрузка...</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Мастера</h1>

        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          {showForm ? 'Отмена' : '+ Добавить мастера'}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 space-y-4 rounded-lg bg-white p-6 shadow"
        >
          <label className="block">
            <span className="text-sm text-gray-700">
              Имя *
            </span>

            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-700">
              WhatsApp номер *
            </span>

            <input
              type="tel"
              value={whatsappNumber}
              onChange={(event) =>
                setWhatsappNumber(event.target.value)
              }
              required
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-700">
              Основной филиал
            </span>

            <select
              value={primaryBranchId}
              onChange={(event) =>
                setPrimaryBranchId(event.target.value)
              }
              className="mt-1 w-full rounded border px-3 py-2"
            >
              <option value="">Не выбран</option>

              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="mb-2 text-sm text-gray-700">
              Тип мастера
            </legend>

            <div className="flex gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="masterType"
                  value="employee"
                  checked={type === 'employee'}
                  onChange={() => setType('employee')}
                />
                Сотрудник
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="masterType"
                  value="renter"
                  checked={type === 'renter'}
                  onChange={() => setType('renter')}
                />
                Арендатор
              </label>
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Создание...' : 'Создать мастера'}
          </button>
         </form>
      )}

      {masters.length === 0 ? (
