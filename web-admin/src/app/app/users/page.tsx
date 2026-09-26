'use client';

import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

type SalonUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
};

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<SalonUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    if (!user?.tenantId || user.role !== 'owner') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const snap = await getDocs(collection(getFirebaseDb(), 'tenants', user.tenantId, 'users'));
      setUsers(snap.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<SalonUser, 'id'>),
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, user?.role]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const createAdmin = httpsCallable(getFirebaseFunctions(), 'createAdmin');
      await createAdmin({ name, email, password, phone });
      setName('');
      setEmail('');
      setPassword('');
      setPhone('');
      setShowForm(false);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать администратора');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'owner') {
    return <p className="rounded-lg bg-white p-6 text-red-700 shadow">Доступ запрещён</p>;
  }
  if (loading) return <p>Загрузка...</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Пользователи</h1>
        <button type="button" onClick={() => setShowForm((visible) => !visible)}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          {showForm ? 'Отмена' : '+ Добавить администратора'}
        </button>
      </div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 grid gap-4 rounded-lg bg-white p-6 shadow md:grid-cols-2">
          <label className="block">
            <span className="text-sm text-gray-700">Имя *</span>
            <input type="text" value={name} onChange={(event) => setName(event.target.value)}
              required className="mt-1 w-full rounded border px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Email *</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)}
              required className="mt-1 w-full rounded border px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Пароль (мин. 8 символов) *</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)}
              required minLength={8} className="mt-1 w-full rounded border px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Телефон</span>
            <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)}
              className="mt-1 w-full rounded border px-3 py-2" />
          </label>
          <div className="md:col-span-2">
            <button type="submit" disabled={saving}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Создание...' : 'Создать администратора'}
            </button>
          </div>
        </form>
      )}

      {users.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow">Пользователей пока нет.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Имя</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Роль</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.role}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.isActive ? 'Активен' : 'Неактивен'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
