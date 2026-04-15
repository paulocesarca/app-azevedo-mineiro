import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Target } from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, currentMonth, monthName } from '../lib/installments';
import MonthSelector from '../components/MonthSelector';
import type { Budget, Category } from '../types';
import clsx from 'clsx';

interface BudgetWithActual extends Budget {
  actual: number;
  remaining: number;
  percentage: number;
}

export default function BudgetPage() {
  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState<BudgetWithActual[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newCatId, setNewCatId] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summary, cats] = await Promise.all([
        api.budget.summary(month),
        api.categories.list(),
      ]);
      setBudgets(summary as BudgetWithActual[]);
      setCategories(cats);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatId || !newAmount || parseFloat(newAmount) <= 0) return;
    setSaving(true);
    try {
      await api.budget.upsert({ category_id: newCatId, month, amount: parseFloat(newAmount) });
      setNewCatId('');
      setNewAmount('');
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir orçamento?')) return;
    await api.budget.delete(id);
    load();
  };

  const totalBudget = budgets.reduce((a, b) => a + b.amount, 0);
  const totalActual = budgets.reduce((a, b) => a + b.actual, 0);
  const globalPct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

  const parentCategories = categories.filter(c => !c.parent_id);

  return (
    <div className="px-4 pt-3 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-100">Orçamento</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-1.5 py-2">
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      </div>

      {/* Seletor de mês */}
      <MonthSelector value={month} onChange={setMonth} />

      {/* Formulário de novo orçamento */}
      {showForm && (
        <form onSubmit={handleAdd} className="card space-y-3 animate-slide-up">
          <h3 className="text-sm font-semibold text-slate-200">Novo orçamento — {monthName(month)}</h3>
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={newCatId} onChange={e => setNewCatId(e.target.value)} required>
              <option value="">Selecione uma categoria</option>
              {parentCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Valor orçado (R$)</label>
            <input className="input" type="number" step="0.01" min="1" placeholder="0,00" value={newAmount} onChange={e => setNewAmount(e.target.value)} required />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
          </div>
        </form>
      )}

      {/* Resumo global */}
      {budgets.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-200">Total orçado</p>
            <p className="text-xs text-slate-500">{globalPct.toFixed(0)}% utilizado</p>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-bold text-slate-100">{formatCurrency(totalActual)}</span>
            <span className="text-sm text-slate-500">de {formatCurrency(totalBudget)}</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-500',
                globalPct > 100 ? 'bg-red-500' : globalPct > 80 ? 'bg-yellow-500' : 'bg-green-500'
              )}
              style={{ width: `${Math.min(globalPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Lista de orçamentos por categoria */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-800 rounded-2xl animate-pulse" />)}
        </div>
      ) : budgets.length === 0 ? (
        <div className="card text-center py-8">
          <Target className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Nenhum orçamento definido</p>
          <p className="text-slate-600 text-xs mt-1">Adicione metas mensais por categoria</p>
          <button onClick={() => setShowForm(true)} className="btn-primary mt-4 text-sm">
            Criar primeiro orçamento
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map(b => {
            const pct = Math.min(b.percentage || 0, 100);
            const isOver = (b.percentage || 0) > 100;
            const isNear = (b.percentage || 0) > 80;

            return (
              <div key={b.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{b.category_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatCurrency(b.actual)} de {formatCurrency(b.amount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      'text-xs font-bold',
                      isOver ? 'text-red-400' : isNear ? 'text-yellow-400' : 'text-green-400'
                    )}>
                      {(b.percentage || 0).toFixed(0)}%
                    </span>
                    <button onClick={() => handleDelete(b.id)} className="btn-ghost p-1 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Barra de progresso */}
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all duration-500',
                      isOver ? 'bg-red-500' : isNear ? 'bg-yellow-500' : 'bg-green-500'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Restante */}
                <p className={clsx(
                  'text-xs mt-1.5',
                  isOver ? 'text-red-400' : 'text-slate-500'
                )}>
                  {isOver
                    ? `⚠️ Excedeu ${formatCurrency(Math.abs(b.remaining || 0))}`
                    : `Disponível: ${formatCurrency(b.remaining || 0)}`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
