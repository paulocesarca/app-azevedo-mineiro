import { NavLink, Outlet, Link } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, CreditCard, PieChart, Target, Settings, Clock } from 'lucide-react';
import { useSync } from '../contexts/SyncContext';
import { useAuth } from '../contexts/AuthContext';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/',            icon: LayoutDashboard, label: 'Início'     },
  { to: '/transactions', icon: ArrowLeftRight,  label: 'Lançar'    },
  { to: '/bills',       icon: Clock,           label: 'Contas'    },
  { to: '/cards',       icon: CreditCard,      label: 'Cartões'   },
  { to: '/budget',      icon: Target,          label: 'Orçamento' },
  { to: '/reports',     icon: PieChart,        label: 'Relatórios'},
];

export default function Layout() {
  const { online, pendingCount } = useSync();
  const { user } = useAuth();

  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-10 bg-slate-950/80 backdrop-blur">
        {/* Status de sync / offline */}
        <div className="text-xs">
          {!online ? (
            <span className="flex items-center gap-1 text-yellow-400">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              Offline {pendingCount > 0 && `· ${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`}
            </span>
          ) : pendingCount > 0 ? (
            <span className="flex items-center gap-1 text-indigo-400">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Sincronizando…
            </span>
          ) : (
            <span className="text-slate-700">● Online</span>
          )}
        </div>

        {/* Avatar → Settings */}
        <Link
          to="/settings"
          className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold hover:bg-indigo-500 transition-colors"
          title="Configurações"
        >
          {user?.name?.charAt(0).toUpperCase() ?? <Settings className="w-3.5 h-3.5" />}
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-12 pb-28">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 z-40"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-around px-1 pt-1.5 pb-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-xl transition-all duration-150 flex-1',
                  isActive ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={clsx('p-1.5 rounded-xl transition-all', isActive && 'bg-indigo-500/20')}>
                    <Icon className="w-[17px] h-[17px]" />
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
