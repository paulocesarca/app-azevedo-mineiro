import { useState } from 'react';
import { X, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '../lib/api';
import type { Investment } from '../types';
import { today, formatCurrency } from '../lib/installments';
import clsx from 'clsx';

interface Props {
  investment: Investment;
  onClose: () => void;
  onSaved: () => void;
}

export default function UpdateValueForm({ investment, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [value, setValue] = useState(String(investment.current_value));
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today());

  const newValue = parseFloat(value) || 0;
  const diff = newValue - investment.current_value;
  const diffPct = investment.current_value > 0 ? (diff / investment.current_value) * 100 : 0;
  const totalReturn = newValue - investment.invested_amount;
  const totalPct = investment.invested_amount > 0 ? (totalReturn / investment.invested_amount) * 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value || newValue <= 0) { setError('Valor inválido'); return; }

    setLoading(true);
    setError('');
    try {
      await api.investments.updateValue(investment.id, newValue, note || undefined, date);
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-800 animate-slide-up">
        <div className="sticky top-0 bg-slate-900 flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-800 rounded-t-3xl z-10">
          <div>
            <h2 className="font-semibold text-slate-100">Atualizar rendimento</h2>
            <p className="text-xs text-slate-500">{investment.name}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 -mr-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Valor atual vs novo */}
          <div className="bg-slate-800/50 rounded-xl p-3 flex items-center justify-between">
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase">Valor anterior</p>
              <p className="text-sm font-semibold text-slate-300">{formatCurrency(investment.current_value)}</p>
            </div>
            <div className="text-slate-600">→</div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase">Novo valor</p>
              <p className={clsx(
                'text-sm font-bold',
                newValue > investment.current_value ? 'text-green-400' : newValue < investment.current_value ? 'text-red-400' : 'text-slate-300'
              )}>
                {formatCurrency(newValue)}
              </p>
            </div>
            {newValue !== investment.current_value && (
              <div className={clsx(
                'flex items-center gap-1 text-xs font-medium',
                diff >= 0 ? 'text-green-400' : 'text-red-400'
              )}>
                {diff >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {diff >= 0 ? '+' : ''}{diffPct.toFixed(2)}%
              </div>
            )}
          </div>

          {/* Novo valor */}
          <div>
            <label className="label">Novo valor atual (R$)</label>
            <input
              className="input text-lg font-semibold"
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={e => setValue(e.target.value)}
              required
              autoFocus
            />
            {newValue > 0 && (
              <p className={clsx(
                'text-xs mt-1 flex items-center gap-1',
                totalReturn >= 0 ? 'text-green-500/80' : 'text-red-500/80'
              )}>
                Rendimento total sobre o investido:&nbsp;
                <strong>{totalReturn >= 0 ? '+' : ''}{formatCurrency(totalReturn)} ({totalPct.toFixed(2)}%)</strong>
              </p>
            )}
          </div>

          {/* Data da atualização */}
          <div>
            <label className="label">Data da atualização</label>
            <input
              className="input"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>

          {/* Observação */}
          <div>
            <label className="label">Observação (opcional)</label>
            <input
              className="input"
              type="text"
              placeholder="Ex: Rendimento do mês, cupom de juros…"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-800/50 rounded-xl px-3 py-2.5 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            {loading ? 'Salvando…' : 'Atualizar valor'}
          </button>
        </form>
      </div>
    </div>
  );
}
