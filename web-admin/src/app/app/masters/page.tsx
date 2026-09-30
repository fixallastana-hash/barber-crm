'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import EditMasterCompensationModal from '@/components/edit-master-compensation-modal';

type Branch = { id: string; name: string; isActive: boolean };

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
  const [restoringMasterId, setRestoringMasterId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [compensationMaster, setCompensationMaster] = useState<Master | null>(null);

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

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
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

  const handleActivate = async (masterId: string) => {
    setRestoringMasterId(masterId);
    setError('');

    try {
      const activateMaster = httpsCallable(
        getFirebaseFunctions(),
        'activateMaster',
      );

      await activateMaster({ masterId });
    } catch (err) {
      console.error('Не удалось восстановить мастера', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось восстановить мастера',
      );
    } finally {
      setRestoringMasterId(null);
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
        'https://barber-crm-widget.web.app/master?token=' + data.token;

      await navigator.clipboard.writeText(url);

      window.alert(
        'Ссылка скопирована:\n\n' +
          url +
          '\n\nОтправьте её мастеру. Он сохранит на главный экран.',
      );
    } catch (err) {
      window.alert(
        'Ошибка: ' +
          (err instanceof Error ? err.message : 'неизвестная ошибка'),
      );
    }
  };

  if (loading) return <p>Загрузка...</p>;

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Мастера</h1>

        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="rounded-md border border-black bg-white px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-black hover:text-white"
        >
          {showForm ? '× Отмена' : '+ Добавить'}
        </button>
      </div>

      {error && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="grid gap-3 rounded-lg bg-white p-4 shadow md:grid-cols-2"
        >
          <label className="block">
            <span className="text-xs font-medium text-gray-600">
              Имя *
            </span>

            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="Например, Иван"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-black"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-600">
              WhatsApp номер *
            </span>

            <input
              type="tel"
              value={whatsappNumber}
              onChange={(event) => setWhatsappNumber(event.target.value)}
              required
              placeholder="+7 700 000 00 00"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-black"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-600">
              Основной филиал
            </span>

            <select
              value={primaryBranchId}
              onChange={(event) => setPrimaryBranchId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
            >
              <option value="">Не выбран</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="md:col-span-2">
            <legend className="text-xs font-medium text-gray-600">
              Тип мастера
            </legend>

            <div className="mt-2 flex gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="masterType"
                  value="employee"
                  checked={type === 'employee'}
                  onChange={() => setType('employee')}
                />
                Сотрудник
              </label>

              <label className="flex cursor-pointer items-center gap-2 text-sm">
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

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-black py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? 'Создание...' : 'Создать мастера'}
            </button>
          </div>
        </form>
      )}

      {masters.length === 0 ? (
        <div className="rounded-lg bg-white p-10 text-center shadow">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#f1f1ee] text-[#737373]">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 21a7 7 0 0 1 14 0" />
            </svg>
          </div>

          <p className="mt-4 text-sm font-medium text-[#404040]">
            Пока нет мастеров
          </p>

          <p className="mt-1 text-sm text-[#9a9690]">
            Добавьте первого мастера, чтобы начать.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {masters.map((master) => {
            const branchName =
              branches.find((b) => b.id === master.primaryBranchId)?.name ||
              '—';

            return (
              <div
                key={master.id}
                className="rounded-lg bg-white p-3 shadow"
              >
                <div className="flex items-start gap-3">
                  {master.photoUrl ? (
                    <img
                      src={master.photoUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                      {(master.name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={'/app/masters/schedule?masterId=' + master.id}
                        className="truncate text-sm font-semibold text-[#171717] hover:underline"
                      >
                        {master.name}
                      </Link>

                      {!master.isActive && (
                        <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                          неактивен
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                      {master.ratingCount && master.ratingCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-gray-600">
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="text-yellow-500"
                          >
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                          </svg>
                          {master.rating ?? 0} ({master.ratingCount})
                        </span>
                      ) : (
                        <span className="text-gray-400">Нет отзывов</span>
                      )}

                      <span className="text-gray-300">·</span>
                      <span className="truncate">{branchName}</span>
                    </div>

                    <div className="mt-0.5 break-words text-xs text-gray-500">
                      {master.whatsappNumber} ·{' '}
                      {master.type === 'renter'
                        ? 'Арендатор'
                        : 'Сотрудник'}
                    </div>
                  </div>

                  {master.isActive ? (
                    <div className="flex shrink-0 gap-1">
                      {user?.role === 'owner' && (
                        <button
                          type="button"
                          onClick={() => setCompensationMaster(master)}
                          aria-label="Компенсация"
                          title="Компенсация"
                          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-black"
                        >
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18v12H3z" />
                            <circle cx="12" cy="12" r="2.5" />
                            <path d="M6 6v12M18 6v12" />
                          </svg>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleCopyLink(master.id)}
                        aria-label="Ссылка для мастера"
                        title="Ссылка для мастера"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-black"
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDeactivate(master.id)}
                        aria-label="Деактивировать"
                        title="Деактивировать"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="4" y="11" width="16" height="10" rx="2" />
                          <path d="M8 11V7a4 4 0 1 1 8 0v4" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleActivate(master.id)}
                      disabled={restoringMasterId === master.id}
                      className="flex h-8 shrink-0 items-center justify-center rounded-md border border-green-600 px-3 text-xs font-medium text-green-700 transition hover:bg-green-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {restoringMasterId === master.id
                        ? 'Восстанавливаем…'
                        : 'Восстановить'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {compensationMaster && (
        <EditMasterCompensationModal
          masterId={compensationMaster.id}
          masterName={compensationMaster.name}
          masterType={compensationMaster.type}
          onClose={() => setCompensationMaster(null)}
        />
      )}
    </div>
  );
}