import { useState, useEffect, useCallback } from 'react';
import { Plus, Filter, X, Search, Download } from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, today } from '../lib/installments';
import TransactionForm from '../components/TransactionForm';
import TransactionCard from '../components/TransactionCard';
import type { Transaction, Category, Card, TransactionFilters } from '../types';
import clsx from 'clsx';

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const now = new Date();
  const [filters, setFilters] = useState<TransactionFilters>({
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filters.month && filters.year) { params.month = filters.month; params.year = filters.year; }
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.subcategory_id) params.subcategory_id = filters.subcategory_id;
      if (filters.type) params.type = filters.type;
      if (filters.payment_method) params.payment_method = filters.payment_method;
      if (filters.card_id) params.card_id = filters.card_id;
      if (filters.user_id) params.user_id = filters.user_id;
      if (filters.search) params.search = filters.search;

      const txs = await api.transactions.list(params);
      setTransactions(txs);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([api.categories.list(), api.categories.cards(), api.auth.users()]).then(([cats, cds, us]) => {
      setCategories(cats);
      setCards(cds);
      setUsers(us);
    });
  }, []);

  const handleDelete = async (t: Transaction) => {
    if (!confirm(`Excluir "${t.description}"?`)) return;
    try {
      if (t.total_installments > 1) {
        if (confirm(`Esta transação tem ${t.total_installments} parcelas. Excluir TODAS?`)) {
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

  const exportCSV = (type: 'history' | 'future') => {
    const todayStr = today();
    const data = type === 'history'
      ? transactions.filter(t => t.date <= todayStr)
      : transactions.filter(t => t.date > todayStr);

    const header = 'Data,Descrição,Categoria,Subcategoria,Tipo,Valor,Pagamento,Cartão,Parcela,Total Parcelas,Usuário\n';
    const rows = data.map(t => [
      t.date, t.description, t.category_name || '', t.subcategory_name || '',
      t.type === 'income' ? 'Receita' : 'Despesa',
      t.amount.toFixed(2),
      t.payment_method === 'credit' ? 'Crédito' : t.payment_method === 'pix' ? 'PIX' : 'Débito',
      t.card_name || '',
      t.installment_number, t.total_installments,
      t.user_name || '',
    ].map(v => `"${v}"`).join(',')).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transacoes-${type === 'history' ? 'historico' : 'futuro'}-${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const parentCategories = categories.filter(c => !c.parent_id);
  const subcategories = filters.category_id
    ? categories.filter(c => c.parent_id === filters.category_id)
    : [];

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);

  return (
    <div className="px-4 pt-3 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-100">Transações</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(!showFilters)} className={clsx('btn-ghost p-2', showFilters && 'text-indigo-400')}>
            <Filter className="w-4 h-4" />
          </button>
          <button onClick={() => { setEditTx(null); setShowForm(true); }} className="btn-primary flex items-center gap-1.5 py-2">
            <Plus className="w-4 h-4" /> Nova
          </button>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          className="input pl-9"
          type="text"
          placeholder="Buscar transações..."
          value={filters.search || ''}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
        />
      </div>

      {/* Filtros expandidos */}
      {showFilters && (
        <div className="card space-y-3 animate-slide-up">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Mês</label>
              <select className="input" value={filters.month || ''} onChange={e => setFilters(f => ({ ...f, month: e.target.value, start_date: '', end_date: '' }))}>
                <option value="">Todos</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={String(m)}>{new Date(2000, m - 1).toLocaleDateString('pt-BR', { month: 'long' })}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Ano</label>
              <select className="input" value={filters.year || ''} onChange={e => setFilters(f => ({ ...f, year: e.target.value }))}>
                {[now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1].map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={filters.type || ''} onChange={e => setFilters(f => ({ ...f, type: e.target.value as TransactionFilters['type'] }))}>
                <option value="">Todos</option>
                <option value="income">Receita</option>
                <option value="expense">Despesa</option>
              </select>
            </div>
            <div>
              <label className="label">Pagamento</label>
              <select className="input" value={filters.payment_method || ''} onChange={e => setFilters(f => ({ ...f, payment_method: e.target.value as TransactionFilters['payment_method'] }))}>
                <option value="">Todos</option>
                <option value="debit">Débito</option>
                <option value="pix">PIX</option>
                <option value="credit">Crédito</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoria</label>
              <select className="input" value={filters.category_id || ''} onChange={e => setFilters(f => ({ ...f, category_id: e.target.value, subcategory_id: '' }))}>
                <option value="">Todas</option>
                {parentCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Subcategoria</label>
              <select className="input" value={filters.subcategory_id || ''} onChange={e => setFilters(f => ({ ...f, subcategory_id: e.target.value }))} disabled={!filters.category_id}>
                <option value="">Todas</option>
                {subcategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cartão</label>
              <select className="input" value={filters.card_id || ''} onChange={e => setFilters(f => ({ ...f, card_id: e.target.value }))}>
                <option value="">Todos</option>
                {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Usuário</label>
              <select className="input" value={filters.user_id || ''} onChange={e => setFilters(f => ({ ...f, user_id: e.target.value }))}>
                <option value="">Todos</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <button onClick={() => setFilters({ month: String(now.getMonth() + 1), year: String(now.getFullYear()) })} className="btn-secondary w-full text-xs">
            <X className="w-3.5 h-3.5 inline mr-1" /> Limpar filtros
          </button>
        </div>
      )}

      {/* Totalizadores */}
      <div className="flex gap-3">
        <div className="card flex-1 text-center py-3">
          <p className="text-xs text-slate-500">Receitas</p>
          <p className="text-sm font-bold text-green-400">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="card flex-1 text-center py-3">
          <p className="text-xs text-slate-500">Despesas</p>
          <p className="text-sm font-bold text-red-400">{formatCurrency(totalExpense)}</p>
        </div>
      </div>

      {/* Lista */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-200">{transactions.length} transações</p>
          <div className="flex gap-1">
            <button onClick={() => exportCSV('history')} className="btn-ghost p-1.5 text-xs flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> Histórico
            </button>
            <button onClick={() => exportCSV('future')} className="btn-ghost p-1.5 text-xs flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> Futuro
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-slate-800 rounded-xl animate-pulse" />)}
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-8">Nenhuma transação encontrada</p>
        ) : (
          transactions.map(t => (
            <TransactionCard
              key={t.id}
              transaction={t}
              onEdit={tx => { setEditTx(tx); setShowForm(true); }}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

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
