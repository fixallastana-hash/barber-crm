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
        setBranches(snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Branch, 'id'>),
        })));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user?.tenantId]);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'createBranch');
      await fn({ name: formName, address: formAddress, city: formCity, phone: formPhone });
      setFormName('');
      setFormAddress('');
      setFormCity('');
      setFormPhone('');
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (branchId: string) => {
    if (!confirm('Деактивировать филиал?')) return;
    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'deactivateBranch');
      await fn({ branchId });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'unknown';
      alert('Ошибка: ' + errorMessage);
    }
  };

  if (loading) return <p>Загрузка...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Филиалы</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {showForm ? 'Отмена' : '+ Добавить филиал'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 bg-white p-6 rounded-lg shadow space-y-4">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <label className="block">
            <span className="text-sm text-gray-700">Название *</span>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              className="mt-1 w-full px-3 py-2 border rounded"
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Адрес</span>
            <input
              type="text"
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded"
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm text-gray-700">Город</span>
              <input
                type="text"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded"
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Телефон</span>
              <input
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Создание...' : 'Создать филиал'}
          </button>
        </form>
      )}

      {branches.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
          Пока нет филиалов. Добавьте первый.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow divide-y">
          {branches.map((b) => (
            <div key={b.id} className="p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">
                  {b.name}{' '}
                  {!b.isActive && <span className="text-xs text-red-500">(неактивен)</span>}
                </p>
                <p className="text-sm text-gray-500">
                  {b.city} {b.address}
                </p>
              </div>
              {b.isActive && (
                <button
                  onClick={() => handleDeactivate(b.id)}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Деактивировать
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
