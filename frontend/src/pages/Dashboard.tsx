import { useState, useEffect, useCallback } from 'react';
import { Plus, TrendingUp, TrendingDown, CreditCard, Wallet, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';
import { formatCurrency, currentMonth, monthName } from '../lib/installments';
import TransactionForm from '../components/TransactionForm';
import TransactionCard from '../components/TransactionCard';
import type { Transaction } from '../types';
import clsx from 'clsx';

interface Summary {
  total_income: number;
  total_expense: number;
  total_credit: number;
  balance: number;
}

function SummaryCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="card flex-1 min-w-0">
      <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center mb-2', color)}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-base font-bold text-slate-100 truncate">{formatCurrency(value)}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { online } = useSync();
  const [month, setMonth] = useState(currentMonth());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_income: 0, total_expense: 0, total_credit: 0, balance: 0 });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editTx, setEditTx] = useState<Transaction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [year, m] = month.split('-');
      const txs = await api.transactions.list({ year, month: m });
      setTransactions(txs);

      const income = txs.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
      const expense = txs.filter(t => t.type === 'expense' && t.payment_method !== 'credit').reduce((a, t) => a + t.amount, 0);
      const credit = txs.filter(t => t.payment_method === 'credit').reduce((a, t) => a + t.amount, 0);

      setSummary({
        total_income: income,
        total_expense: expense + credit,
        total_credit: credit,
        balance: income - expense - credit,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (t: Transaction) => {
    if (!confirm(`Excluir "${t.description}"?`)) return;
    try {
      if (t.total_installments > 1) {
        if (confirm('Esta transação tem parcelas. Deseja excluir TODAS as parcelas?')) {
          await api.transactions.deleteGroup(t.parent_transaction_id);
        } else {
          await api.transactions.delete(t.id);
        }
      } else {
        await api.transactions.delete(t.id);
      }
      load();
    } catch (e) {
      alert('Erro ao excluir');
    }
  };

  // Gera lista dos últimos 6 meses
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  return (
    <div className="px-4 pt-3 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">Olá, {user?.name?.split(' ')[0]} 👋</p>
          <h1 className="text-lg font-bold text-slate-100">Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost p-2">
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => { setEditTx(null); setShowForm(true); }}
            className="btn-primary flex items-center gap-1.5 py-2"
          >
            <Plus className="w-4 h-4" />
            Nova
          </button>
        </div>
      </div>

      {/* Seletor de mês */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
        {months.map(m => (
          <button
            key={m}
            onClick={() => setMonth(m)}
            className={clsx(
              'flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
              month === m
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            )}
          >
            {monthName(m).split(' de ')[0]}
          </button>
        ))}
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Receitas" value={summary.total_income} icon={TrendingUp} color="bg-green-900/40 text-green-400" />
        <SummaryCard label="Despesas" value={summary.total_expense} icon={TrendingDown} color="bg-red-900/40 text-red-400" />
        <SummaryCard label="Crédito" value={summary.total_credit} icon={CreditCard} color="bg-blue-900/40 text-blue-400" />
        <div className="card flex-1 min-w-0">
          <div className={clsx(
            'w-8 h-8 rounded-lg flex items-center justify-center mb-2',
            summary.balance >= 0 ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
          )}>
            <Wallet className="w-4 h-4" />
          </div>
          <p className="text-xs text-slate-500 mb-0.5">Saldo</p>
          <p className={clsx(
            'text-base font-bold truncate',
            summary.balance >= 0 ? 'text-green-400' : 'text-red-400'
          )}>
            {formatCurrency(summary.balance)}
          </p>
        </div>
      </div>

      {/* Últimas transações */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-200">
            Transações — {monthName(month).split(' de ')[0]}
          </h2>
          <span className="text-xs text-slate-500">{transactions.length} itens</span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-500 text-sm">Nenhuma transação este mês</p>
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary mt-3 text-xs"
            >
              Registrar primeira transação
            </button>
          </div>
        ) : (
          <div>
            {transactions.slice(0, 10).map(t => (
              <TransactionCard
                key={t.id}
                transaction={t}
                onEdit={tx => { setEditTx(tx); setShowForm(true); }}
                onDelete={handleDelete}
              />
            ))}
            {transactions.length > 10 && (
              <p className="text-center text-xs text-slate-600 pt-2">
                +{transactions.length - 10} transações — veja todas em Transações
              </p>
            )}
          </div>
        )}
      </div>

      {/* Modal de nova transação */}
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
