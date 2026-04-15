import { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, formatDate, today } from '../lib/installments';
import TransactionForm from '../components/TransactionForm';
import TransactionCard from '../components/TransactionCard';
import type { Transaction } from '../types';
import clsx from 'clsx';

type Tab = 'pending' | 'paid';

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T12:00:00Z');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyColor(days: number) {
  if (days < 0)  return 'text-red-400 bg-red-900/30';
  if (days === 0) return 'text-red-400 bg-red-900/30';
  if (days <= 3)  return 'text-orange-400 bg-orange-900/30';
  if (days <= 7)  return 'text-yellow-400 bg-yellow-900/30';
  return 'text-slate-400 bg-slate-800';
}

function urgencyLabel(days: number) {
  if (days < 0)  return `${Math.abs(days)}d atrasado`;
  if (days === 0) return 'Vence hoje!';
  if (days === 1) return 'Vence amanhã';
  return `${days} dias`;
}

export default function Bills() {
  const [tab, setTab] = useState<Tab>('pending');
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Busca pendentes + pagas do mês atual para o histórico
      const now = new Date();
      const [pending, paid] = await Promise.all([
        api.transactions.list({ status: 'pending' }),
        api.transactions.list({
          status: 'paid',
          month: String(now.getMonth() + 1),
          year: String(now.getFullYear()),
        }),
      ]);
      setAllTransactions([...pending, ...paid]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pending = allTransactions.filter(t => t.status === 'pending');
  const paid    = allTransactions.filter(t => t.status === 'paid');

  const displayed = tab === 'pending' ? pending : paid;

  // Totais
  const totalPending = pending.reduce((a, t) => a + t.amount, 0);
  const totalPaid    = paid.reduce((a, t) => a + t.amount, 0);

  // Pendentes agrupados por urgência
  const overdue   = pending.filter(t => daysUntil(t.date) < 0);
  const dueToday  = pending.filter(t => daysUntil(t.date) === 0);
  const dueWeek   = pending.filter(t => daysUntil(t.date) > 0 && daysUntil(t.date) <= 7);
  const dueLater  = pending.filter(t => daysUntil(t.date) > 7);

  const handleDelete = async (t: Transaction) => {
    if (!confirm(`Excluir "${t.description}"?`)) return;
    await api.transactions.delete(t.id);
    load();
  };

  const handleStatusChange = (updated: Transaction) => {
    setAllTransactions(prev =>
      prev.map(t => t.id === updated.id ? updated : t)
    );
  };

  return (
    <div className="px-4 pt-3 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-100">Contas a Pagar</h1>
        <button
          onClick={() => { setEditTx(null); setShowForm(true); }}
          className="btn-primary flex items-center gap-1.5 py-2"
        >
          <Plus className="w-4 h-4" /> Lançar
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-slate-500">Pendente</span>
          </div>
          <p className="text-lg font-bold text-yellow-400">{formatCurrency(totalPending)}</p>
          <p className="text-xs text-slate-600 mt-0.5">{pending.length} conta{pending.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="text-xs text-slate-500">Pago (mês)</span>
          </div>
          <p className="text-lg font-bold text-green-400">{formatCurrency(totalPaid)}</p>
          <p className="text-xs text-slate-600 mt-0.5">{paid.length} conta{paid.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Alertas de urgência */}
      {(overdue.length > 0 || dueToday.length > 0) && (
        <div className="card border-red-800/50 bg-red-900/10 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            {overdue.length > 0 && (
              <p className="text-sm text-red-300 font-medium">
                {overdue.length} conta{overdue.length > 1 ? 's' : ''} em atraso!
              </p>
            )}
            {dueToday.length > 0 && (
              <p className="text-sm text-orange-300 font-medium">
                {dueToday.length} conta{dueToday.length > 1 ? 's' : ''} vence{dueToday.length > 1 ? 'm' : ''} hoje!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
        {([
          { id: 'pending', label: `A pagar (${pending.length})`, icon: Clock },
          { id: 'paid',    label: `Pago (${paid.length})`,       icon: CheckCircle2 },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all',
              tab === id ? 'bg-slate-700 text-slate-100 shadow' : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-800 rounded-2xl animate-pulse" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="card text-center py-10">
          {tab === 'pending' ? (
            <>
              <CheckCircle2 className="w-10 h-10 text-green-500/40 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Nenhuma conta pendente 🎉</p>
              <p className="text-slate-600 text-xs mt-1">Lance uma conta para acompanhar o pagamento</p>
            </>
          ) : (
            <>
              <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Nenhuma conta paga este mês</p>
            </>
          )}
          <button onClick={() => setShowForm(true)} className="btn-primary mt-4 text-sm">
            Lançar conta
          </button>
        </div>
      ) : tab === 'pending' ? (
        /* Pendentes agrupadas por urgência */
        <div className="space-y-4">
          {[
            { label: '🚨 Atrasadas', items: overdue, color: 'text-red-400' },
            { label: '🔴 Vencem hoje', items: dueToday, color: 'text-orange-400' },
            { label: '🟡 Esta semana', items: dueWeek, color: 'text-yellow-400' },
            { label: '📅 Próximos', items: dueLater, color: 'text-slate-400' },
          ].filter(g => g.items.length > 0).map(group => (
            <div key={group.label} className="card">
              <div className="flex items-center justify-between mb-3">
                <p className={clsx('text-xs font-semibold', group.color)}>{group.label}</p>
                <p className="text-xs text-slate-500">
                  {formatCurrency(group.items.reduce((a, t) => a + t.amount, 0))}
                </p>
              </div>
              {group.items.map(t => {
                const days = daysUntil(t.date);
                return (
                  <div key={t.id} className="relative">
                    {/* Badge de urgência */}
                    <div className="absolute right-10 top-3.5 z-10">
                      <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full', urgencyColor(days))}>
                        {urgencyLabel(days)}
                      </span>
                    </div>
                    <TransactionCard
                      transaction={t}
                      onEdit={tx => { setEditTx(tx); setShowForm(true); }}
                      onDelete={handleDelete}
                      onStatusChange={handleStatusChange}
                      compact
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        /* Pagas */
        <div className="card">
          {displayed.map(t => (
            <TransactionCard
              key={t.id}
              transaction={t}
              onEdit={tx => { setEditTx(tx); setShowForm(true); }}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              compact
            />
          ))}
        </div>
      )}

      {showForm && (
        <TransactionForm
          onClose={() => { setShowForm(false); setEditTx(null); }}
          onSaved={load}
          editTransaction={editTx}
        />
      )}
    </div>
  );
}
