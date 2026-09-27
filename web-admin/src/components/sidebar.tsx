'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="17" rx="3" />
      <path d="M16 2.5v4M8 2.5v4M3 9h18" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function BranchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 21V6l8-3 8 3v15" />
      <path d="M8 9h2M14 9h2M8 13h2M14 13h2M8 17h2M14 17h2" />
    </svg>
  );
}

function MasterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21c.8-4 3.3-6 7.5-6s6.7 2 7.5 6" />
    </svg>
  );
}

function ServiceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M14.5 5.5a4 4 0 0 0 4.9 5L11 18.9a2.2 2.2 0 0 1-3.1 0l-.8-.8a2.2 2.2 0 0 1 0-3.1L15.5 6a4 4 0 0 0-1-3.5" />
      <path d="M5 19l-1 1M7 17l-1 1" />
    </svg>
  );
}

function ClientIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 21c.7-3.5 2.9-5.5 6.5-5.5s5.8 2 6.5 5.5" />
      <path d="M16 5.5a3.5 3.5 0 0 1 0 7M17 15.5c2.6.6 4.1 2.4 4.5 5" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 21c.7-4 3-6 7-6s6.3 2 7 6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1h-2.6v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H4.4v-2.6h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.1H13v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1V14h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10" />
      <path d="M14 8l4 4-4 4M18 12H9" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

const commonItems: NavItem[] = [
  {
    href: '/app/calendar',
    label: 'Календарь',
    icon: <CalendarIcon />,
  },
  {
    href: '/app/settings',
    label: 'Салон',
    icon: <SettingsIcon />,
  },
  {
    href: '/app/branches',
    label: 'Филиалы',
    icon: <BranchIcon />,
  },
  {
    href: '/app/masters',
    label: 'Мастера',
    icon: <MasterIcon />,
  },
  {
    href: '/app/services',
    label: 'Услуги',
    icon: <ServiceIcon />,
  },
  {
    href: '/app/clients',
    label: 'Клиенты',
    icon: <ClientIcon />,
  },
];

const ownerItems: NavItem[] = [
  {
    href: '/app',
    label: 'Главная',
    icon: <DashboardIcon />,
  },
  ...commonItems,
  {
    href: '/app/users',
    label: 'Пользователи',
    icon: <UserIcon />,
  },
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-950 text-white shadow-sm">
        <span className="text-sm font-bold tracking-tight">BC</span>
      </div>

      <div>
        <div className="text-[15px] font-semibold tracking-tight text-gray-950">
          Barber CRM
        </div>
        <div className="text-[11px] text-gray-400">
          Управление салоном
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = user?.role === 'owner' ? ownerItems : commonItems;

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const closeMobile = () => {
    setMobileOpen(false);
  };

  const isActive = (href: string) => {
    if (href === '/app') {
      return pathname === '/app';
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const roleLabel = user?.role === 'owner' ? 'Владелец' : 'Администратор';

  const navigation = (
    <nav className="flex-1 space-y-1 overflow-y-auto">
      {items.map((item) => {
        const active = isActive(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={closeMobile}
            className={[
              'group flex items-center gap-3 rounded-xl px-3 py-2.5',
              'text-[14px] transition-all duration-150',
              active
                ? 'bg-gray-950 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950',
            ].join(' ')}
          >
            <span
              className={[
                'flex h-5 w-5 shrink-0 items-center justify-center',
                active ? 'text-white' : 'text-gray-400 group-hover:text-gray-700',
              ].join(' ')}
            >
              <span className="h-5 w-5">{item.icon}</span>
            </span>

            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const account = (
    <div className="border-t border-gray-100 pt-4">
      <div className="mb-3 flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
          {(user?.email?.[0] ?? 'U').toUpperCase()}
        </div>

        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-gray-900">
            {user?.email ?? 'Пользователь'}
          </div>
          <div className="mt-0.5 text-[11px] text-gray-400">
            {roleLabel}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] text-gray-500 transition hover:bg-red-50 hover:text-red-600"
      >
        <span className="h-5 w-5">
          <LogoutIcon />
        </span>
        Выйти
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur lg:hidden">
        <Logo />

        <button
          type="button"
          aria-label="Открыть меню"
          onClick={() => setMobileOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-700"
        >
          <span className="h-5 w-5">
            <MenuIcon />
          </span>
        </button>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden w-[260px] shrink-0 border-r border-gray-200 bg-white lg:flex lg:min-h-screen lg:flex-col lg:px-4 lg:py-5">
        <div className="mb-8 px-2">
          <Logo />
        </div>

        {navigation}
        {account}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Закрыть меню"
            onClick={closeMobile}
            className="absolute inset-0 bg-black/30"
          />

          <aside className="relative flex h-full w-[290px] max-w-[86vw] flex-col bg-white px-4 py-5 shadow-2xl">
            <div className="mb-7 flex items-center justify-between px-1">
              <Logo />

              <button
                type="button"
                aria-label="Закрыть меню"
                onClick={closeMobile}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
              >
                <span className="h-5 w-5">
                  <CloseIcon />
                </span>
              </button>
            </div>

            {navigation}
            {account}
          </aside>
        </div>
      )}
    </>
  );
      }
