import { useState, useEffect } from 'react';
import { Plus, TrendingUp, TrendingDown, RefreshCw, Pencil, Trash2, History } from 'lucide-react';
import { api } from '../lib/api';
import type { Investment } from '../types';
import { formatCurrency } from '../lib/installments';
import InvestmentForm from '../components/InvestmentForm';
import UpdateValueForm from '../components/UpdateValueForm';
import clsx from 'clsx';

const TYPE_LABELS: Record<string, string> = {
  renda_fixa: '📈 Renda Fixa',
  acoes: '📊 Ações',
  fii: '🏢 FII',
  cdb: '🏦 CDB',
  tesouro: '🇧🇷 Tesouro Direto',
  cripto: '₿ Cripto',
  outro: '💼 Outro',
};

const TYPE_COLORS: Record<string, string> = {
  renda_fixa: 'bg-green-900/30 text-green-400',
  acoes: 'bg-blue-900/30 text-blue-400',
  fii: 'bg-orange-900/30 text-orange-400',
  cdb: 'bg-teal-900/30 text-teal-400',
  tesouro: 'bg-yellow-900/30 text-yellow-400',
  cripto: 'bg-purple-900/30 text-purple-400',
  outro: 'bg-slate-800 text-slate-400',
};

export default function Investments() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Investment | null>(null);
  const [updateItem, setUpdateItem] = useState<Investment | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.investments.list();
      setInvestments(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (inv: Investment) => {
    if (!confirm(`Excluir "${inv.name}"?`)) return;
    await api.investments.delete(inv.id);
    load();
  };

  const totalInvested = investments.reduce((a, i) => a + i.invested_amount, 0);
  const totalCurrent = investments.reduce((a, i) => a + i.current_value, 0);
  const totalReturn = totalCurrent - totalInvested;
  const returnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
  const isPositive = totalReturn >= 0;

  return (
    <div className="px-4 pt-3 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-100">Investimentos</h1>
        <button
          onClick={() => { setEditItem(null); setShowForm(true); }}
          className="btn-primary flex items-center gap-1.5 py-2"
        >
          <Plus className="w-4 h-4" /> Novo
        </button>
      </div>

      {/* Resumo */}
      <div className="card space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Patrimônio total</p>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-slate-100">{formatCurrency(totalCurrent)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Investido: {formatCurrency(totalInvested)}</p>
          </div>
          <div className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold',
            isPositive ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
          )}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {isPositive ? '+' : ''}{formatCurrency(totalReturn)} ({returnPct.toFixed(2)}%)
          </div>
        </div>

        {/* Barra de distribuição por tipo */}
        {investments.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {Object.entries(
              investments.reduce((acc, inv) => {
                acc[inv.type] = (acc[inv.type] || 0) + inv.current_value;
                return acc;
              }, {} as Record<string, number>)
            ).sort((a, b) => b[1] - a[1]).map(([type, value]) => (
              <div key={type} className="flex items-center gap-2">
                <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded-md', TYPE_COLORS[type])}>
                  {TYPE_LABELS[type]}
                </span>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${(value / totalCurrent) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 tabular-nums w-24 text-right">
                  {formatCurrency(value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      ) : investments.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-3xl mb-2">📈</p>
          <p className="text-slate-400 text-sm">Nenhum investimento cadastrado</p>
          <p className="text-slate-600 text-xs mt-1">Clique em "Novo" para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {investments.map(inv => {
            const ret = inv.current_value - inv.invested_amount;
            const pct = inv.invested_amount > 0 ? (ret / inv.invested_amount) * 100 : 0;
            const pos = ret >= 0;
            const isOpen = showHistory === inv.id;

            return (
              <div key={inv.id} className="card p-0 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-100">{inv.name}</p>
                        <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded-md', TYPE_COLORS[inv.type])}>
                          {TYPE_LABELS[inv.type]}
                        </span>
                      </div>
                      {inv.institution && (
                        <p className="text-xs text-slate-500 mt-0.5">{inv.institution}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <div>
                          <p className="text-[10px] text-slate-600">Investido</p>
                          <p className="text-xs font-medium text-slate-300">{formatCurrency(inv.invested_amount)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-600">Atual</p>
                          <p className="text-xs font-bold text-slate-100">{formatCurrency(inv.current_value)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-600">Rendimento</p>
                          <p className={clsx('text-xs font-semibold', pos ? 'text-green-400' : 'text-red-400')}>
                            {pos ? '+' : ''}{formatCurrency(ret)} ({pct.toFixed(2)}%)
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button
                        onClick={() => setUpdateItem(inv)}
                        className="btn-ghost p-1.5 text-indigo-400 hover:text-indigo-300"
                        title="Atualizar valor"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setShowHistory(isOpen ? null : inv.id)}
                        className={clsx('btn-ghost p-1.5', isOpen ? 'text-indigo-400' : 'text-slate-500')}
                        title="Histórico"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setEditItem(inv); setShowForm(true); }}
                        className="btn-ghost p-1.5"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(inv)}
                        className="btn-ghost p-1.5 hover:text-red-400"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Histórico de atualizações */}
                {isOpen && inv.updates && inv.updates.length > 0 && (
                  <div className="border-t border-slate-800 px-4 py-3 bg-slate-800/30">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Histórico de atualizações
                    </p>
                    <div className="space-y-1.5">
                      {inv.updates.slice(0, 10).map(u => (
                        <div key={u.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">{u.date}</span>
                          <span className="text-slate-400">{u.note || '—'}</span>
                          <span className="text-slate-200 font-medium tabular-nums">{formatCurrency(u.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modais */}
      {showForm && (
        <InvestmentForm
          editInvestment={editItem}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          onSaved={load}
        />
      )}
      {updateItem && (
        <UpdateValueForm
          investment={updateItem}
          onClose={() => setUpdateItem(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
