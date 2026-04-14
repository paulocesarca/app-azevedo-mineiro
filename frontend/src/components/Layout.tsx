import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, CreditCard, PieChart, Target, Settings } from 'lucide-react';
import { useSync } from '../contexts/SyncContext';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Início' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Lançar' },
  { to: '/cards', icon: CreditCard, label: 'Cartões' },
  { to: '/budget', icon: Target, label: 'Orçamento' },
  { to: '/reports', icon: PieChart, label: 'Relatórios' },
  { to: '/settings', icon: Settings, label: 'Config.' },
];

export default function Layout() {
  const { online, pendingCount } = useSync();

  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      {/* Status bar */}
      <div className={clsx(
        'fixed top-0 left-0 right-0 z-50 flex items-center justify-end px-4 py-1 text-xs transition-all',
        !online ? 'bg-yellow-900/80 text-yellow-300' : 'bg-transparent text-slate-600'
      )}>
        {!online && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            Sem conexão {pendingCount > 0 && `· ${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`}
          </span>
        )}
        {online && pendingCount > 0 && (
          <span className="flex items-center gap-1 text-indigo-400">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Sincronizando {pendingCount} item{pendingCount > 1 ? 's' : ''}…
          </span>
        )}
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-5 pb-28">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 z-40" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-around px-1 pt-1.5 pb-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all duration-150 flex-1',
                  isActive ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={clsx(
                    'p-1.5 rounded-xl transition-all',
                    isActive ? 'bg-indigo-500/20' : ''
                  )}>
                    <Icon className="w-[18px] h-[18px]" />
                  </div>
                  <span className="text-[9px] font-medium">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
