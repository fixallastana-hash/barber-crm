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

  if (loading) {
    return (
      <div className="min-w-0">
        <div className="mb-8">
          <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
          <div className="mt-3 h-8 w-32 animate-pulse rounded-lg bg-gray-200" />
        </div>

        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-2xl border border-gray-200 bg-white" />
          <div className="h-24 animate-pulse rounded-2xl border border-gray-200 bg-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {/* Header */}
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
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
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[#171717] px-5 text-sm font-medium text-white shadow-sm transition hover:bg-[#292929] active:scale-[0.99]"
        >
          <span className="mr-2 text-lg leading-none">
            {showForm ? '×' : '+'}
          </span>

          {showForm ? 'Отмена' : 'Добавить филиал'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="crm-card mb-5 p-5 sm:p-6"
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
                className="crm-input"
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
                className="crm-input"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-medium text-[#77736d]">
                Адрес
              </span>

              <input
                type="text"
                value={formAddress}
                onChange={(event) =>
                  setFormAddress(event.target.value)
                }
                placeholder="Улица, дом"
                className="crm-input"
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
                className="crm-input"
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Создание...' : 'Создать филиал'}
            </button>
          </div>
        </form>
      )}

      {/* Branches */}
      {branches.length === 0 ? (
        <div className="crm-card p-10 text-center">
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
              className="crm-card p-4 sm:p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f1f1ee] text-[#66615b]">
                    <svg
                      width="20"
                      height="20"
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

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#292725]">
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

                    <div className="mt-1.5 space-y-0.5 text-sm text-[#8b8781]">
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

                {branch.isActive && (
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        void handleDeactivate(branch.id)
                      }
                      className="rounded-md border border-black bg-white px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black hover:text-white"
                    >
                      Деактивировать
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
