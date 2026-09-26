'use client';

import { useAuth } from '@/lib/auth-context';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Дашборд</h1>
      <p className="text-gray-600 mb-6">
        Добро пожаловать! Это ваш личный кабинет.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Email</p>
          <p className="text-lg font-medium mt-1">{user?.email}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Роль</p>
          <p className="text-lg font-medium mt-1">{user?.role}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Tenant ID</p>
          <p className="text-sm font-mono mt-1 break-all">{user?.tenantId}</p>
        </div>
      </div>
      <p className="mt-6 text-sm text-gray-500">
        Полноценный дашборд с метриками появится в Спринте 13.
      </p>
    </div>
  );
}
