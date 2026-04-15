import { useState, useEffect, useCallback } from 'react';
import { Plus, TrendingUp, TrendingDown, CreditCard, Wallet, RefreshCw, Clock, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';
import { formatCurrency, formatDate, currentMonth, monthName } from '../lib/installments';
import TransactionForm from '../components/TransactionForm';
import TransactionCard from '../components/TransactionCard';
import MonthSelector from '../components/MonthSelector';
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

function daysUntil(dateStr: string) {
  const t = new Date(dateStr + 'T12:00:00Z');
  const n = new Date(); n.setHours(0,0,0,0);
  return Math.ceil((t.getTime() - n.getTime()) / 86400000);
}

export default function Dashboard() {
  const { user } = useAuth();
  const { online } = useSync();
  const [month, setMonth] = useState(currentMonth());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingBills, setPendingBills] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_income: 0, total_expense: 0, total_credit: 0, balance: 0 });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editTx, setEditTx] = useState<Transaction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [year, m] = month.split('-');
      const [txs, bills] = await Promise.all([
        api.transactions.list({ year, month: m }),
        api.transactions.pending(),
      ]);
      setTransactions(txs);
      setPendingBills(bills);

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
      <MonthSelector value={month} onChange={setMonth} />

      {/* Contas a pagar — alerta rápido */}
      {pendingBills.length > 0 && (() => {
        const urgent = pendingBills.filter(t => daysUntil(t.date) <= 3);
        const totalPending = pendingBills.reduce((a, t) => a + t.amount, 0);
        return (
          <Link to="/bills" className="block card border-yellow-800/40 bg-yellow-900/10 hover:bg-yellow-900/20 transition-all">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-yellow-900/40 flex items-center justify-center flex-shrink-0">
                {urgent.length > 0
                  ? <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  : <Clock className="w-4 h-4 text-yellow-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-yellow-200">
                  {urgent.length > 0
                    ? `${urgent.length} conta${urgent.length > 1 ? 's' : ''} vence${urgent.length > 1 ? 'm' : ''} em breve!`
                    : `${pendingBills.length} conta${pendingBills.length > 1 ? 's' : ''} a pagar`}
                </p>
                <p className="text-xs text-yellow-500 mt-0.5">
                  Total pendente: {formatCurrency(totalPending)}
                </p>
                {urgent.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {urgent.slice(0, 3).map(t => (
                      <div key={t.id} className="flex items-center justify-between text-xs">
                        <span className="text-yellow-300/80 truncate max-w-[60%]">{t.description}</span>
                        <span className="text-yellow-400 font-medium flex-shrink-0 ml-2">
                          {formatCurrency(t.amount)} · {formatDate(t.date)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-yellow-600 text-xs mt-0.5">ver →</span>
            </div>
          </Link>
        );
      })()}

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
                onStatusChange={updated => setTransactions(prev => prev.map(x => x.id === updated.id ? updated : x))}
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
