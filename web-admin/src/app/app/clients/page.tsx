'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

type Client = {
  id: string;
  name: string;
  phoneNormalized: string;
  totalVisits: number;
  totalSpentKzt: number;
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

  const loadClients = useCallback(async () => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const snap = await getDocs(collection(getFirebaseDb(), 'tenants', user.tenantId, 'clients'));
      setClients(snap.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<Client, 'id'>),
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить клиентов');
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => { void loadClients(); }, [loadClients]);

  const filteredClients = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('ru');
    if (!normalizedSearch) return clients;
    return clients.filter((client) =>
      client.name.toLocaleLowerCase('ru').includes(normalizedSearch) ||
      client.phoneNormalized.includes(normalizedSearch),
    );
  }, [clients, search]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const createClient = httpsCallable(getFirebaseFunctions(), 'createClient');
      await createClient({ name, phone });
      setName('');
      setPhone('');
      setShowForm(false);
      await loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать клиента');
    } finally {
      setSaving(false);
    }
  };

  const handleBlockToggle = async (client: Client) => {
    setError('');
    try {
      const blockClient = httpsCallable(getFirebaseFunctions(), 'blockClient');
      await blockClient({ clientId: client.id, blocked: !client.isBlocked });
      await loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить статус клиента');
    }
  };

  if (loading) return <p>Загрузка...</p>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Клиенты</h1>
        <button
          type="button"
          onClick={() => setShowForm((visible) => !visible)}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          {showForm ? 'Отмена' : '+ Добавить клиента'}
        </button>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 grid gap-4 rounded-lg bg-white p-6 shadow md:grid-cols-2">
          <label className="block">
            <span className="text-sm text-gray-700">Имя *</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Телефон *</span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Создание...' : 'Создать клиента'}
            </button>
          </div>
        </form>
      )}

      <label className="mb-4 block max-w-md">
        <span className="sr-only">Поиск клиентов</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск по имени или телефону"
          className="w-full rounded border bg-white px-3 py-2"
        />
      </label>

      {filteredClients.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow">
          {clients.length === 0 ? 'Пока нет клиентов' : 'Ничего не найдено'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Имя</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Телефон</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Визитов</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Потрачено</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Статус</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredClients.map((client) => (
                <tr key={client.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{client.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{client.phoneNormalized}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{client.totalVisits ?? 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {(client.totalSpentKzt ?? 0).toLocaleString('ru-RU')} ₸
                  </td>
                  <td className="px-4 py-3 text-sm">{client.isBlocked ? 'Заблокирован' : 'Активен'}</td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      type="button"
                      onClick={() => void handleBlockToggle(client)}
                      className={client.isBlocked ? 'text-green-700 hover:text-green-800' : 'text-red-600 hover:text-red-700'}
                    >
                      {client.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
