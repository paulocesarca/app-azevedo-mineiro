import { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../lib/api';
import type { Investment, InvestmentType } from '../types';
import { today } from '../lib/installments';
import clsx from 'clsx';

interface Props {
  onClose: () => void;
  onSaved: () => void;
  editInvestment?: Investment | null;
}

const TYPES: { value: InvestmentType; label: string }[] = [
  { value: 'renda_fixa', label: '📈 Renda Fixa' },
  { value: 'cdb',        label: '🏦 CDB' },
  { value: 'tesouro',    label: '🇧🇷 Tesouro Direto' },
  { value: 'acoes',      label: '📊 Ações' },
  { value: 'fii',        label: '🏢 FII' },
  { value: 'cripto',     label: '₿ Cripto' },
  { value: 'outro',      label: '💼 Outro' },
];

const COLORS = [
  '#6366F1', '#10B981', '#3B82F6', '#F59E0B',
  '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6',
];

export default function InvestmentForm({ onClose, onSaved, editInvestment }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState(editInvestment?.name || '');
  const [type, setType] = useState<InvestmentType>(editInvestment?.type || 'renda_fixa');
  const [institution, setInstitution] = useState(editInvestment?.institution || '');
  const [investedAmount, setInvestedAmount] = useState(editInvestment ? String(editInvestment.invested_amount) : '');
  const [currentValue, setCurrentValue] = useState(editInvestment ? String(editInvestment.current_value) : '');
  const [dateInvested, setDateInvested] = useState(editInvestment?.date_invested || today());
  const [notes, setNotes] = useState(editInvestment?.notes || '');
  const [color, setColor] = useState(editInvestment?.color || '#6366F1');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Nome é obrigatório'); return; }
    if (!investedAmount || parseFloat(investedAmount) <= 0) { setError('Valor investido inválido'); return; }

    setLoading(true);
    setError('');

    try {
      const payload = {
        name: name.trim(),
        type,
        institution: institution.trim() || null,
        invested_amount: parseFloat(investedAmount),
        current_value: parseFloat(currentValue || investedAmount),
        date_invested: dateInvested,
        notes: notes.trim() || null,
        color,
      };

      if (editInvestment) {
        await api.investments.update(editInvestment.id, payload);
      } else {
        await api.investments.create(payload);
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-800 max-h-[92vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-slate-900 flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-800 rounded-t-3xl z-10">
          <h2 className="font-semibold text-slate-100">
            {editInvestment ? 'Editar investimento' : 'Novo investimento'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-2 -mr-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Nome */}
          <div>
            <label className="label">Nome</label>
            <input
              className="input"
              type="text"
              placeholder="Ex: CDB Sicredi 120% CDI"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="label">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={clsx(
                    'py-2 px-3 rounded-xl text-xs font-medium border text-left transition-all',
                    type === t.value
                      ? 'bg-indigo-900/40 border-indigo-700 text-indigo-300'
                      : 'border-slate-700 text-slate-500 hover:text-slate-300'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Instituição */}
          <div>
            <label className="label">Instituição (opcional)</label>
            <input
              className="input"
              type="text"
              placeholder="Ex: Sicredi, XP, NuInvest…"
              value={institution}
              onChange={e => setInstitution(e.target.value)}
            />
          </div>

          {/* Valores */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor investido (R$)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={investedAmount}
                onChange={e => setInvestedAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Valor atual (R$)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                placeholder="Igual ao investido"
                value={currentValue}
                onChange={e => setCurrentValue(e.target.value)}
              />
            </div>
          </div>

          {/* Data */}
          <div>
            <label className="label">Data do investimento</label>
            <input
              className="input"
              type="date"
              value={dateInvested}
              onChange={e => setDateInvested(e.target.value)}
              required
            />
          </div>

          {/* Cor */}
          <div>
            <label className="label">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={clsx(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    color === c ? 'border-white scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="label">Observações (opcional)</label>
            <input
              className="input"
              type="text"
              placeholder="Ex: Vence em 12/2025, resgate automático…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
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
            {loading ? 'Salvando…' : editInvestment ? 'Salvar alterações' : 'Adicionar investimento'}
          </button>
        </form>
      </div>
    </div>
  );
}
