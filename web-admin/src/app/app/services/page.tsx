'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import EditServiceModal from '@/components/edit-service-modal';
import EditCategoryModal from '@/components/edit-category-modal';

type Category = {
  id: string;
  name: string;
  isActive: boolean;
  order?: number;
};

type Service = {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceKzt: number;
  isActive: boolean;
};

export default function ServicesPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryName, setCategoryName] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [bufferMinutes, setBufferMinutes] = useState('0');
  const [priceKzt, setPriceKzt] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }
    const db = getFirebaseDb();

    const unsubCategories = onSnapshot(
      collection(db, 'tenants', user.tenantId, 'categories'),
      (snap) => {
        setCategories(snap.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<Category, 'id'>),
        })));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    const unsubServices = onSnapshot(
      collection(db, 'tenants', user.tenantId, 'services'),
      (snap) => {
        setServices(snap.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<Service, 'id'>),
        })));
      },
      (err) => setError(err.message),
    );

    return () => {
      unsubCategories();
      unsubServices();
    };
  }, [user?.tenantId]);

  const handleCreateCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingCategory(true);
    setError('');
    setMessage('');
    try {
      const createCategory = httpsCallable(getFirebaseFunctions(), 'createCategory');
      await createCategory({ name: categoryName });
      setCategoryName('');
      setMessage('Категория создана');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать категорию');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleEditCategory = (category: Category) => {
    setError('');
    setMessage('');
    setEditingCategory(category);
  };

  const handleCategoryEditSaved = async () => {
    setError('');
    setMessage('');
  };

  const handleDeactivateCategory = async (categoryIdValue: string) => {
    if (!window.confirm('Удалить категорию? Услуги в ней должны быть неактивны.')) {
      return;
    }
    setError('');
    setMessage('');
    try {
      const deactivateCategory = httpsCallable(getFirebaseFunctions(), 'deactivateCategory');
      await deactivateCategory({ categoryId: categoryIdValue });
      setMessage('Категория удалена');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить категорию');
    }
  };

  const handleCreateService = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingService(true);
    setError('');
    setMessage('');
    try {
      const createService = httpsCallable(getFirebaseFunctions(), 'createService');
      await createService({
        name: serviceName,
        categoryId,
        durationMinutes: Number(durationMinutes),
        bufferMinutes: Number(bufferMinutes || 0),
        priceKzt: Number(priceKzt),
      });
      setServiceName('');
      setCategoryId('');
      setDurationMinutes('');
      setBufferMinutes('0');
      setPriceKzt('');
      setMessage('Услуга создана');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать услугу');
    } finally {
      setSavingService(false);
    }
  };

  const handleDeactivate = async (serviceId: string) => {
    if (!window.confirm('Удалить услугу?')) {
      return;
    }
    setError('');
    setMessage('');
    try {
      const deactivateService = httpsCallable(getFirebaseFunctions(), 'deactivateService');
      await deactivateService({ serviceId });
      setMessage('Услуга удалена');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить услугу');
    }
  };

  const handleEdit = (service: Service) => {
    setError('');
    setMessage('');
    setEditingService(service);
  };

  const handleEditSaved = async () => {
    setError('');
    setMessage('');
  };

  if (loading) return <p>Загрузка...</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Услуги и категории</h1>
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p className="rounded bg-blue-50 p-3 text-sm text-blue-700">{message}</p>}

      <section>
        <h2 className="mb-4 text-xl font-semibold">Категории</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg bg-white p-6 shadow">
            {categories.length === 0 ? (
              <p className="text-sm text-gray-500">Категорий пока нет.</p>
            ) : (
              <ul className="divide-y">
                {categories.map((category) => (
                  <li key={category.id} className="flex items-center justify-between py-3">
                    <span>
                      {category.name}
                      {!category.isActive && (
                        <span className="ml-2 text-xs text-red-500">(неактивна)</span>
                      )}
                    </span>
                    {category.isActive && (
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => handleEditCategory(category)}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          Редактировать
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeactivateCategory(category.id)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <form onSubmit={handleCreateCategory} className="space-y-4 rounded-lg bg-white p-6 shadow">
            <label className="block">
              <span className="text-sm text-gray-700">Название категории *</span>
              <input type="text" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required className="mt-1 w-full rounded border px-3 py-2" />
            </label>
            <button type="submit" disabled={savingCategory} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
              {savingCategory ? 'Создание...' : 'Создать категорию'}
            </button>
          </form>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Услуги</h2>
        <form onSubmit={handleCreateService} className="mb-6 grid gap-4 rounded-lg bg-white p-6 shadow md:grid-cols-2">
          <label className="block">
            <span className="text-sm text-gray-700">Название *</span>
            <input type="text" value={serviceName} onChange={(event) => setServiceName(event.target.value)} required className="mt-1 w-full rounded border px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Категория *</span>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required className="mt-1 w-full rounded border px-3 py-2">
              <option value="">Выберите категорию</option>
              {categories.filter((category) => category.isActive).map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Длительность (минуты) *</span>
            <input type="number" min={1} value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} required className="mt-1 w-full rounded border px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Буфер (минуты)</span>
            <input type="number" min={0} value={bufferMinutes} onChange={(event) => setBufferMinutes(event.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Цена (₸) *</span>
            <input type="number" min={0} value={priceKzt} onChange={(event) => setPriceKzt(event.target.value)} required className="mt-1 w-full rounded border px-3 py-2" />
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={savingService || categories.filter((category) => category.isActive).length === 0} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
              {savingService ? 'Создание...' : 'Создать услугу'}
            </button>
          </div>
        </form>

        {services.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow">Услуг пока нет.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Название</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Категория</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Длительность</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Цена</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Статус</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {services.map((service) => {
                  const category = categories.find((item) => item.id === service.categoryId);
                  return (
                    <tr key={service.id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{service.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{category?.name || service.categoryName || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{service.durationMinutes} мин</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{service.priceKzt.toLocaleString('ru-RU')} ₸</td>
                      <td className="px-4 py-3 text-sm">{service.isActive ? 'Активна' : 'Неактивна'}</td>
                      <td className="px-4 py-3 text-sm">
                        {service.isActive && (
                          <div className="flex flex-wrap gap-3">
                            <button type="button" onClick={() => handleEdit(service)} className="text-blue-600 hover:text-blue-700">
                              Редактировать
                            </button>
                            <button type="button" onClick={() => void handleDeactivate(service.id)} className="text-red-600 hover:text-red-700">
                              Удалить
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EditServiceModal
        service={editingService}
        onClose={() => setEditingService(null)}
        onSaved={handleEditSaved}
      />

      {editingCategory && (
        <EditCategoryModal
          categoryId={editingCategory.id}
          initialName={editingCategory.name}
          onClose={() => setEditingCategory(null)}
          onSaved={handleCategoryEditSaved}
        />
      )}
    </div>
  );
}
