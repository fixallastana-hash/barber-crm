'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const [showInactive, setShowInactive] = useState(false);
  const [showInactiveCategories, setShowInactiveCategories] = useState(false);

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);

  const [categoryName, setCategoryName] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [bufferMinutes, setBufferMinutes] = useState('0');
  const [priceKzt, setPriceKzt] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [restoringCategoryId, setRestoringCategoryId] = useState<string | null>(null);
  const [restoringServiceId, setRestoringServiceId] = useState<string | null>(null);
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
        setCategories(
          snap.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<Category, 'id'>),
          })),
        );
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
        setServices(
          snap.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<Service, 'id'>),
          })),
        );
      },
      (err) => setError(err.message),
    );

    return () => {
      unsubCategories();
      unsubServices();
    };
  }, [user?.tenantId]);

  const visibleCategories = useMemo(
    () =>
      showInactiveCategories
        ? categories
        : categories.filter((c) => c.isActive),
    [categories, showInactiveCategories],
  );

  const visibleServices = useMemo(
    () =>
      showInactive
        ? services
        : services.filter((s) => s.isActive),
    [services, showInactive],
  );

  const handleCreateCategory = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setSavingCategory(true);
    setError('');
    setMessage('');

    try {
      const createCategory = httpsCallable(
        getFirebaseFunctions(),
        'createCategory',
      );

      await createCategory({ name: categoryName });

      setCategoryName('');
      setShowCategoryForm(false);
      setMessage('Категория создана');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось создать категорию',
      );
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

  const handleDeleteCategory = async (categoryIdValue: string) => {
    if (!window.confirm('Удалить категорию навсегда? Действие необратимо.')) {
      return;
    }

    setError('');
    setMessage('');

    try {
      const deleteCategory = httpsCallable(
        getFirebaseFunctions(),
        'deleteCategory',
      );

      await deleteCategory({ categoryId: categoryIdValue });
      setMessage('Категория удалена');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось удалить категорию',
      );
    }
  };

  const handleDeactivateCategory = async (categoryIdValue: string) => {
    if (!window.confirm('Деактивировать категорию?')) {
      return;
    }

    setError('');
    setMessage('');

    try {
      const deactivateCategory = httpsCallable(
        getFirebaseFunctions(),
        'deactivateCategory',
      );

      await deactivateCategory({ categoryId: categoryIdValue });
    } catch (err) {
      console.error('Не удалось деактивировать категорию', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось деактивировать категорию',
      );
    }
  };

  const handleActivateCategory = async (categoryIdValue: string) => {
    setRestoringCategoryId(categoryIdValue);
    setError('');
    setMessage('');

    try {
      const activateCategory = httpsCallable(
        getFirebaseFunctions(),
        'activateCategory',
      );

      await activateCategory({ categoryId: categoryIdValue });
    } catch (err) {
      console.error('Не удалось восстановить категорию', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось восстановить категорию',
      );
    } finally {
      setRestoringCategoryId(null);
    }
  };

  const handleCreateService = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setSavingService(true);
    setError('');
    setMessage('');

    try {
      const createService = httpsCallable(
        getFirebaseFunctions(),
        'createService',
      );

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
      setShowServiceForm(false);
      setMessage('Услуга создана');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось создать услугу',
      );
    } finally {
      setSavingService(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!window.confirm('Удалить услугу навсегда? Действие необратимо.')) {
      return;
    }

    setError('');
    setMessage('');

    try {
      const deleteService = httpsCallable(
        getFirebaseFunctions(),
        'deleteService',
      );

      await deleteService({ serviceId });
      setMessage('Услуга удалена');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось удалить услугу',
      );
    }
  };

  const handleDeactivateService = async (serviceId: string) => {
    if (!window.confirm('Деактивировать услугу?')) {
      return;
    }

    setError('');
    setMessage('');

    try {
      const deactivateService = httpsCallable(
        getFirebaseFunctions(),
        'deactivateService',
      );

      await deactivateService({ serviceId });
    } catch (err) {
      console.error('Не удалось деактивировать услугу', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось деактивировать услугу',
      );
    }
  };

  const handleActivateService = async (serviceId: string) => {
    setRestoringServiceId(serviceId);
    setError('');
    setMessage('');

    try {
      const activateService = httpsCallable(
        getFirebaseFunctions(),
        'activateService',
      );

      await activateService({ serviceId });
    } catch (err) {
      console.error('Не удалось восстановить услугу', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось восстановить услугу',
      );
    } finally {
      setRestoringServiceId(null);
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
    <div className="min-w-0 space-y-6">
      <h1 className="text-2xl font-bold">Услуги и категории</h1>

      {error && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {message && (
        <p className="rounded bg-blue-50 p-3 text-sm text-blue-700">
          {message}
        </p>
      )}

      <section className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Категории</h2>

          <button
            type="button"
            onClick={() => setShowCategoryForm((v) => !v)}
            className="rounded-md border border-black bg-white px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-black hover:text-white"
          >
            {showCategoryForm ? '× Отмена' : '+ Добавить'}
          </button>
        </div>

        {showCategoryForm && (
          <form
            onSubmit={handleCreateCategory}
            className="mb-3 flex gap-2 rounded-lg bg-white p-3 shadow"
          >
            <input
              type="text"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              required
              placeholder="Название категории"
              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
            />

            <button
              type="submit"
              disabled={savingCategory}
              className="shrink-0 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {savingCategory ? '...' : 'Создать'}
            </button>
          </form>
        )}

        <div className="rounded-lg bg-white p-1 shadow">
          {visibleCategories.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">
              Категорий пока нет.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {visibleCategories.map((category) => (
                <li
                  key={category.id}
                  className="flex items-center gap-2 py-2 pl-3 pr-2"
                >
                  <span className="min-w-0 flex-1 break-words text-sm font-medium text-[#171717]">
                    {category.name}

                    {!category.isActive && (
                      <span className="ml-2 text-xs font-normal text-red-500">
                        (неактивна)
                      </span>
                    )}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleEditCategory(category)}
                    aria-label="Редактировать категорию"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-black"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void handleDeleteCategory(category.id)
                    }
                    aria-label="Удалить категорию"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </button>

                  {category.isActive ? (
                    <button
                      type="button"
                      onClick={() =>
                        void handleDeactivateCategory(category.id)
                      }
                      aria-label="Деактивировать категорию"
                      className="flex h-8 shrink-0 items-center justify-center rounded-md border border-red-200 px-3 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Деактивировать
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        void handleActivateCategory(category.id)
                      }
                      disabled={restoringCategoryId === category.id}
                      aria-label="Восстановить категорию"
                      className="flex h-8 shrink-0 items-center justify-center rounded-md border border-green-600 px-3 text-xs font-medium text-green-700 transition hover:bg-green-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {restoringCategoryId === category.id
                        ? 'Восстанавливаем…'
                        : 'Восстановить'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
          <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
            <input
              type="checkbox"
              className="peer absolute h-4 w-4 cursor-pointer appearance-none rounded border border-gray-300 bg-white transition checked:border-black checked:bg-black"
              checked={showInactiveCategories}
              onChange={(event) =>
                setShowInactiveCategories(event.target.checked)
              }
            />

            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none relative text-white opacity-0 peer-checked:opacity-100"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>

          Показать неактивные
        </label>
      </section>

      <section className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Услуги</h2>

          <button
            type="button"
            onClick={() => setShowServiceForm((v) => !v)}
            disabled={categories.filter((c) => c.isActive).length === 0}
            className="rounded-md border border-black bg-white px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {showServiceForm ? '× Отмена' : '+ Добавить'}
          </button>
        </div>

        {showServiceForm && (
          <form
            onSubmit={handleCreateService}
            className="mb-3 grid gap-3 rounded-lg bg-white p-4 shadow md:grid-cols-2"
          >
            <label className="block">
              <span className="text-xs font-medium text-gray-600">
                Название *
              </span>

              <input
                type="text"
                value={serviceName}
                onChange={(event) => setServiceName(event.target.value)}
                required
                placeholder="Например, Стрижка"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-black"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-600">
                Категория *
              </span>

              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
              >
                <option value="">Выберите категорию</option>

                {categories
                  .filter((c) => c.isActive)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-600">
                Длительность (мин) *
              </span>

              <input
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(event) =>
                  setDurationMinutes(event.target.value)
                }
                required
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-black"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-600">
                Буфер (мин)
              </span>

              <input
                type="number"
                min={0}
                value={bufferMinutes}
                onChange={(event) =>
                  setBufferMinutes(event.target.value)
                }
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-black"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-xs font-medium text-gray-600">
                Цена (₸) *
              </span>

              <input
                type="number"
                min={0}
                value={priceKzt}
                onChange={(event) => setPriceKzt(event.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-black"
              />
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={savingService}
                className="w-full rounded-lg bg-black py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                {savingService ? 'Создание...' : 'Создать услугу'}
              </button>
            </div>
          </form>
        )}

        {visibleServices.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow">
            {showInactive
              ? 'Услуг пока нет.'
              : 'Активных услуг нет.'}
          </div>
        ) : (
          <>
            <div className="hidden w-full min-w-0 overflow-x-auto rounded-lg bg-white shadow md:block">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Название
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Категория
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Длительность
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Цена
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Статус
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Действия
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {visibleServices.map((service) => {
                    const category = categories.find(
                      (item) => item.id === service.categoryId,
                    );

                    return (
                      <tr
                        key={service.id}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {service.name}
                        </td>

                        <td className="px-4 py-3 text-sm text-gray-600">
                          {category?.name ||
                            service.categoryName ||
                            '—'}
                        </td>

                        <td className="px-4 py-3 text-sm text-gray-600">
                          {service.durationMinutes} мин
                        </td>

                        <td className="px-4 py-3 text-sm text-gray-600">
                          {service.priceKzt.toLocaleString('ru-RU')} ₸
                        </td>

                        <td className="px-4 py-3">
                          {service.isActive ? (
                            <span className="inline-flex rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                              Активна
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                              Неактивна
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEdit(service)}
                              aria-label="Редактировать"
                              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-black"
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void handleDeleteService(service.id)
                              }
                              aria-label="Удалить"
                              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M3 6h18" />
                                <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              </svg>
                            </button>

                            {service.isActive ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleDeactivateService(
                                    service.id,
                                  )
                                }
                                aria-label="Деактивировать"
                                className="flex h-8 shrink-0 items-center justify-center rounded-md border border-red-200 px-3 text-xs font-medium text-red-600 transition hover:bg-red-50"
                              >
                                Деактивировать
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleActivateService(
                                    service.id,
                                  )
                                }
                                disabled={
                                  restoringServiceId === service.id
                                }
                                aria-label="Восстановить"
                                className="flex h-8 shrink-0 items-center justify-center rounded-md border border-green-600 px-3 text-xs font-medium text-green-700 transition hover:bg-green-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {restoringServiceId === service.id
                                  ? 'Восстанавливаем…'
                                  : 'Восстановить'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
                        <div className="space-y-2 md:hidden">
              {visibleServices.map((service) => {
                const category = categories.find(
                  (item) => item.id === service.categoryId,
                );

                return (
                  <div
                    key={service.id}
                    className="rounded-lg bg-white p-3 shadow"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold text-[#171717]">
                          {service.name}
                        </p>

                        <p className="mt-0.5 break-words text-xs text-gray-500">
                          {category?.name ||
                            service.categoryName ||
                            '—'}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                          <span>{service.durationMinutes} мин</span>

                          <span className="font-semibold text-[#171717]">
                            {service.priceKzt.toLocaleString('ru-RU')} ₸
                          </span>

                          {!service.isActive && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                              Неактивна
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(service)}
                          aria-label="Редактировать"
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
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void handleDeleteService(service.id)
                          }
                          aria-label="Удалить"
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
                            <path d="M3 6h18" />
                            <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          </svg>
                        </button>

                        {service.isActive ? (
                          <button
                            type="button"
                            onClick={() =>
                              void handleDeactivateService(
                                service.id,
                              )
                            }
                            aria-label="Деактивировать"
                            className="flex h-8 shrink-0 items-center justify-center rounded-md border border-red-200 px-3 text-xs font-medium text-red-600 transition hover:bg-red-50"
                          >
                            Деактивировать
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              void handleActivateService(service.id)
                            }
                            disabled={
                              restoringServiceId === service.id
                            }
                            aria-label="Восстановить"
                            className="flex h-8 shrink-0 items-center justify-center rounded-md border border-green-600 px-3 text-xs font-medium text-green-700 transition hover:bg-green-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {restoringServiceId === service.id
                              ? 'Восстанавливаем…'
                              : 'Восстановить'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
          <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
            <input
              type="checkbox"
              className="peer absolute h-4 w-4 cursor-pointer appearance-none rounded border border-gray-300 bg-white transition checked:border-black checked:bg-black"
              checked={showInactive}
              onChange={(event) =>
                setShowInactive(event.target.checked)
              }
            />

            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none relative text-white opacity-0 peer-checked:opacity-100"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>

          Показать неактивные
        </label>
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