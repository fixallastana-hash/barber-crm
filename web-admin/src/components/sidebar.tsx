'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const navItems = [
  { href: '/app', label: 'Дашборд' },
  { href: '/app/settings', label: 'Салон' },
  { href: '/app/branches', label: 'Филиалы' },
  { href: '/app/masters', label: 'Мастера' },
  { href: '/app/services', label: 'Услуги' },
  { href: '/app/clients', label: 'Клиенты' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen p-4 flex flex-col">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Barber CRM</h2>
        <p className="text-xs text-gray-500 mt-1">{user?.email}</p>
        <p className="text-xs text-gray-400">Роль: {user?.role}</p>
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded text-sm ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={handleSignOut}
        className="mt-4 text-sm text-red-600 hover:text-red-700 text-left px-3 py-2"
      >
        Выйти
      </button>
    </aside>
  );
}
