'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

const baseItems = [
  { href: '/app/calendar', label: 'Календарь', icon: 'calendar' },
  { href: '/app/settings', label: 'Салон', icon: 'building' },
  { href: '/app/branches', label: 'Филиалы', icon: 'branches' },
  { href: '/app/masters', label: 'Мастера', icon: 'masters' },
  { href: '/app/services', label: 'Услуги', icon: 'services' },
  { href: '/app/clients', label: 'Клиенты', icon: 'clients' },
];

const ownerItems = [
  { href: '/app', label: 'Главная', icon: 'home' },
  ...baseItems,
  { href: '/app/users', label: 'Пользователи', icon: 'users' },
];

function Icon({ name }: { name: string }) {
  const common = {
    width: 19,
    height: 19,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (name === 'home') return <svg {...common}><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></svg>;
  if (name === 'calendar') return <svg {...common}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M16 2.5v4M8 2.5v4M3 9h18" /><path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" /></svg>;
  if (name === 'building') return <svg {...common}><path d="M4 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17" /><path d="M16 9h3a1 1 0 0 1 1 1v11M8 7h4M8 11h4M8 15h4M8 19h4M4 21h17" /></svg>;
  if (name === 'branches') return <svg {...common}><path d="M6 3v12a3 3 0 0 0 3 3h9" /><path d="M6 7h7a3 3 0 0 0 3-3" /><circle cx="6" cy="3" r="1.5" /><circle cx="18" cy="18" r="1.5" /><circle cx="16" cy="4" r="1.5" /></svg>;
  if (name === 'masters') return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 21a7 7 0 0 1 14 0" /></svg>;
  if (name === 'services') return <svg {...common}><path d="m14.5 5.5 4-4 4 4-4 4" /><path d="M18.5 5.5 10 14" /><path d="M4 20h8" /><path d="M4 16h4" /></svg>;
  if (name === 'clients') return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.5" /></svg>;
  return <svg {...common}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 21a6 6 0 0 1 12 0M15 20a5 5 0 0 1 6 0" /></svg>;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const items = user?.role === 'owner' ? ownerItems : baseItems;

  return (
    <>
      <div className="mobile-topbar">
        <button type="button" className="mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Открыть меню">
          <span /><span /><span />
        </button>
        <div className="mobile-brand"><span className="brand-dot">B</span><span>Barber CRM</span></div>
        <div className="mobile-role">{user?.role === 'owner' ? 'Владелец' : 'Администратор'}</div>
      </div>

      {mobileOpen && <button type="button" className="sidebar-backdrop" aria-label="Закрыть меню" onClick={() => setMobileOpen(false)} />}

      <aside className={`app-sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">B</div>
          <div>
            <div className="brand-name">Barber CRM</div>
            <div className="brand-caption">Панель управления</div>
          </div>
          <button type="button" className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Закрыть меню">×</button>
        </div>

        <div className="sidebar-account">
          <div className="account-avatar">{(user?.email?.[0] || 'U').toUpperCase()}</div>
          <div className="account-copy">
            <div className="account-email">{user?.email}</div>
            <div className="account-role">{user?.role === 'owner' ? 'Владелец' : 'Администратор'}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-title">Рабочее пространство</div>
          {items.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href + '/'));
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`sidebar-link ${isActive ? 'is-active' : ''}`}>
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <button type="button" onClick={handleSignOut} className="sidebar-logout">
          <span className="logout-icon">↪</span>
          Выйти
        </button>
      </aside>
    </>
  );
}
