'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

type Branch = {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  isActive: boolean;
};

export default function BranchesPage() {
  const { user } = useAuth();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formPhone, setFormPhone] = useState('');

  const [saving, setSaving] = useState(false);
  const [restoringBranchId, setRestoringBranchId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }

    const db = getFirebaseDb();

    const unsub = onSnapshot(
      collection(db, 'tenants', user.tenantId, 'branches'),
      (snap) => {
        setBranches(
          snap.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<Branch, 'id'>),
          })),
        );

        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [user?.tenantId]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSaving(true);
    setError('');

    try {
      const createBranch = httpsCallable(
        getFirebaseFunctions(),
        'createBranch',
      );

      await createBranch({
        name: formName,
        address: formAddress,
        city: formCity,
        phone: formPhone,
      });

      setFormName('');
      setFormAddress('');
      setFormCity('');
      setFormPhone('');
      setShowForm(false);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось создать филиал',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (branchId: string) => {
    if (!window.confirm('Деактивировать филиал?')) return;

    setError('');

    try {
      const deactivateBranch = httpsCallable(
        getFirebaseFunctions(),
        'deactivateBranch',
      );

      await deactivateBranch({ branchId });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось деактивировать филиал',
      );
    }
  };

  const handleActivate = async (branchId: string) => {
    setRestoringBranchId(branchId);
    setError('');

    try {
      const activateBranch = httpsCallable(
        getFirebaseFunctions(),
        'activateBranch',
      );

      await activateBranch({ branchId });
    } catch (err: unknown) {
      console.error('Не удалось восстановить филиал', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось восстановить филиал',
      );
    } finally {
      setRestoringBranchId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-w-0">
        <div className="mb-8">
          <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
          <div className="mt-3 h-8 w-40 animate-pulse rounded-lg bg-gray-200" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-200" />
        </div>

        <div className="space-y-3">
          <div className="h-40 animate-pulse rounded-2xl border border-gray-200 bg-white" />
          <div className="h-40 animate-pulse rounded-2xl border border-gray-200 bg-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-6">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#aaa6a0]">
          Структура бизнеса
        </div>

        <h1 className="text-[28px] font-semibold tracking-[-0.035em] text-[#171717]">
          Филиалы
        </h1>

        <p className="mt-1 text-sm text-[#8b8781]">
          Управление филиалами и их контактными данными
        </p>
      </div>

      <button
        type="button"
        onClick={() => setShowForm((visible) => !visible)}
        className="mb-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#171717] text-sm font-medium text-white transition hover:bg-[#292929] active:scale-[0.99]"
      >
        <span className="text-lg leading-none">{showForm ? '×' : '+'}</span>
        <span>{showForm ? 'Отмена' : 'Добавить филиал'}</span>
      </button>

      {error && (
        <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="mb-5">
            <h2 className="text-base font-semibold text-[#171717]">
              Новый филиал
            </h2>

            <p className="mt-1 text-sm text-[#8b8781]">
              Добавьте основные данные филиала
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#77736d]">
                Название *
              </span>

              <input
                type="text"
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                required
                placeholder="Например, Barber House"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#171717] outline-none transition focus:border-black"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#77736d]">
                Город
              </span>

              <input
                type="text"
                value={formCity}
                onChange={(event) => setFormCity(event.target.value)}
                placeholder="Алматы"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#171717] outline-none transition focus:border-black"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-medium text-[#77736d]">
                Адрес
              </span>

              <input
                type="text"
                value={formAddress}
                onChange={(event) => setFormAddress(event.target.value)}
                placeholder="Улица, дом"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#171717] outline-none transition focus:border-black"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#77736d]">
                Телефон
              </span>

              <input
                type="tel"
                value={formPhone}
                onChange={(event) => setFormPhone(event.target.value)}
                placeholder="+7 700 000 00 00"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#171717] outline-none transition focus:border-black"
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-6 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Создание...' : 'Создать филиал'}
            </button>
          </div>
        </form>
      )}

      {branches.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
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
              aria-hidden="true"
            >
              <path d="M3 21h18" />
              <path d="M5 21V7l7-4 7 4v14" />
              <path d="M9 21v-6h6v6" />
              <path d="M9 9h.01" />
              <path d="M15 9h.01" />
            </svg>
          </div>

          <p className="mt-4 text-sm font-medium text-[#404040]">
            Пока нет филиалов
          </p>

          <p className="mt-1 text-sm text-[#9a9690]">
            Добавьте первый филиал, чтобы начать работу.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#f1f1ee] text-[#66615b]">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 21h18" />
                    <path d="M5 21V7l7-4 7 4v14" />
                    <path d="M9 21v-6h6v6" />
                    <path d="M9 9h.01" />
                    <path d="M15 9h.01" />
                  </svg>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[17px] font-semibold text-[#292725]">
                      {branch.name}
                    </p>

                    {branch.isActive ? (
                      <span className="inline-flex rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-medium text-green-700">
                        Активен
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700">
                        Неактивен
                      </span>
                    )}
                  </div>

                  <div className="mt-2 space-y-0.5 text-sm text-[#8b8781]">
                    {(branch.city || branch.address) && (
                      <p className="break-words">
                        {[branch.city, branch.address]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}

                    {branch.phone && (
                      <p className="break-words">{branch.phone}</p>
                    )}
                  </div>
                </div>
              </div>

              {branch.isActive ? (
                <button
                  type="button"
                  onClick={() => void handleDeactivate(branch.id)}
                  className="mt-4 flex h-11 w-full items-center justify-center rounded-xl border border-black bg-white text-sm font-medium text-black transition-colors hover:bg-black hover:text-white"
                >
                  Деактивировать
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleActivate(branch.id)}
                  disabled={restoringBranchId === branch.id}
                  className="mt-4 flex h-11 w-full items-center justify-center rounded-xl border border-green-600 bg-white text-sm font-medium text-green-700 transition-colors hover:bg-green-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {restoringBranchId === branch.id
                    ? 'Восстанавливаем…'
                    : 'Восстановить'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}