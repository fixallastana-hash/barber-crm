'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

type Client = {
  id: string;
  name: string;
  phoneNormalized: string;
  totalVisits: number;
  totalSpentKzt: number;
  noshowCount: number;
  isBlocked: boolean;
};

export default function ClientsPage() {
  const { user } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      collection(getFirebaseDb(), 'tenants', user.tenantId, 'clients'),
      (snap) => {
        setClients(
          snap.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<Client, 'id'>),
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

  const filteredClients = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('ru');

    if (!normalizedSearch) return clients;

    return clients.filter(
      (client) =>
        client.name.toLocaleLowerCase('ru').includes(normalizedSearch) ||
        client.phoneNormalized.includes(normalizedSearch),
    );
  }, [clients, search]);

  const handleCreate = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setSaving(true);
    setError('');

    try {
      const createClient = httpsCallable(
        getFirebaseFunctions(),
        'createClient',
      );

      await createClient({
        name,
        phone,
      });

      setName('');
      setPhone('');
      setShowForm(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось создать клиента',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleBlockToggle = async (client: Client) => {
    setError('');

    try {
      const blockClient = httpsCallable(
        getFirebaseFunctions(),
        'blockClient',
      );

      await blockClient({
        clientId: client.id,
        blocked: !client.isBlocked,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось изменить статус клиента',
      );
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

        <div className="h-24 animate-pulse rounded-2xl border border-gray-200 bg-white" />
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#aaa6a0]">
          Клиентская база
        </div>

        <h1 className="text-[28px] font-semibold tracking-[-0.035em] text-[#171717]">
          Клиенты
        </h1>

        <p className="mt-1 text-sm text-[#8b8781]">
          Управление клиентами и историей посещений
        </p>
      </div>

      {/* Кнопка "Добавить клиента" — на всю ширину */}
      <button
        type="button"
        onClick={() => setShowForm((visible) => !visible)}
        className="mb-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#171717] text-sm font-medium text-white transition hover:bg-[#292929] active:scale-[0.99]"
      >
        <span className="text-lg leading-none">{showForm ? '×' : '+'}</span>
        <span>{showForm ? 'Отмена' : 'Добавить клиента'}</span>
      </button>

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
          className="mb-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="mb-5">
            <h2 className="text-base font-semibold text-[#171717]">
              Новый клиент
            </h2>

            <p className="mt-1 text-sm text-[#8b8781]">
              Добавьте имя и номер телефона клиента
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#77736d]">
                Имя *
              </span>

              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                placeholder="Имя клиента"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#171717] outline-none transition focus:border-black"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#77736d]">
                Телефон *
              </span>

              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
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
              {saving ? 'Создание...' : 'Создать клиента'}
            </button>
          </div>
        </form>
      )}

      {/* Toolbar — поиск */}
      <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block min-w-0 flex-1 sm:max-w-md">
            <span className="sr-only">Поиск клиентов</span>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по имени или телефону"
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-[#171717] outline-none transition focus:border-black"
            />

            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa6a0]">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
            </span>
          </label>

          <div className="text-sm text-[#8b8781]">
            {filteredClients.length === clients.length
              ? `${clients.length} ${
                  clients.length === 1 ? 'клиент' : 'клиентов'
                }`
              : `${filteredClients.length} из ${clients.length}`}
          </div>
        </div>
      </div>

      {/* Empty */}
      {filteredClients.length === 0 ? (
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
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>

          <p className="mt-4 text-sm font-medium text-[#404040]">
            {clients.length === 0
              ? 'Пока нет клиентов'
              : 'Ничего не найдено'}
          </p>

          <p className="mt-1 text-sm text-[#9a9690]">
            {clients.length === 0
              ? 'Добавьте первого клиента, чтобы начать вести базу.'
              : 'Попробуйте изменить запрос поиска.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                    Клиент
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                    Телефон
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                    Визиты
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                    Потрачено
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                    Неявки
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                    Статус
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                    Действие
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {filteredClients.map((client) => (
                  <tr key={client.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f1f1ee] text-sm font-semibold text-[#66615b]">
                          {(client.name || '?').charAt(0).toUpperCase()}
                        </div>

                        <span className="text-sm font-medium text-[#292725]">
                          {client.name}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-sm text-gray-600">
                      {client.phoneNormalized}
                    </td>

                    <td className="px-4 py-3 text-sm text-gray-600">
                      {client.totalVisits ?? 0}
                    </td>

                    <td className="px-4 py-3 text-sm text-gray-600">
                      {(client.totalSpentKzt ?? 0).toLocaleString('ru-RU')} ₸
                    </td>

                    <td className="px-4 py-3 text-sm">
                      <span
                        className={
                          (client.noshowCount ?? 0) >= 3
                            ? 'font-medium text-red-600'
                            : 'text-gray-600'
                        }
                      >
                        {client.noshowCount ?? 0}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {client.isBlocked ? (
                        <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                          Заблокирован
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                          Активен
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void handleBlockToggle(client)}
                        className="rounded-md border border-black bg-white px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black hover:text-white"
                      >
                        {client.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1f1ee] text-sm font-semibold text-[#66615b]">
                      {(client.name || '?').charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#292725]">
                        {client.name}
                      </p>

                      <p className="mt-0.5 truncate text-xs text-[#8b8781]">
                        {client.phoneNormalized}
                      </p>
                    </div>
                  </div>

                  {client.isBlocked ? (
                    <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700">
                      Заблокирован
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-medium text-green-700">
                      Активен
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-3 divide-x divide-[#e8e6e2] rounded-xl bg-[#faf9f7] py-3">
                  <div className="px-3 text-center">
                    <p className="text-[11px] text-[#99958f]">Визиты</p>

                    <p className="mt-1 text-sm font-semibold text-[#292725]">
                      {client.totalVisits ?? 0}
                    </p>
                  </div>

                  <div className="px-3 text-center">
                    <p className="text-[11px] text-[#99958f]">Потрачено</p>

                    <p className="mt-1 text-sm font-semibold text-[#292725]">
                      {(client.totalSpentKzt ?? 0).toLocaleString('ru-RU')} ₸
                    </p>
                  </div>

                  <div className="px-3 text-center">
                    <p className="text-[11px] text-[#99958f]">Неявки</p>

                    <p
                      className={
                        'mt-1 text-sm font-semibold ' +
                        ((client.noshowCount ?? 0) >= 3
                          ? 'text-red-600'
                          : 'text-[#292725]')
                      }
                    >
                      {client.noshowCount ?? 0}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleBlockToggle(client)}
                  className="mt-4 flex h-11 w-full items-center justify-center rounded-xl border border-black bg-white text-sm font-medium text-black transition-colors hover:bg-black hover:text-white"
                >
                  {client.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
