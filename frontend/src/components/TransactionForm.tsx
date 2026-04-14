import { useState, useEffect } from 'react';
import { X, ChevronDown, Calculator } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { calculateInstallmentDates, formatDate, today } from '../lib/installments';
import type { Category, Card, Transaction } from '../types';
import clsx from 'clsx';

interface Props {
  onClose: () => void;
  onSaved: () => void;
  editTransaction?: Transaction | null;
}

export default function TransactionForm({ onClose, onSaved, editTransaction }: Props) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [type, setType] = useState<'income' | 'expense'>(editTransaction?.type || 'expense');
  const [amount, setAmount] = useState(editTransaction ? String(editTransaction.amount * (editTransaction.total_installments || 1)) : '');
  const [description, setDescription] = useState(editTransaction?.description || '');
  const [categoryId, setCategoryId] = useState(editTransaction?.category_id || '');
  const [subcategoryId, setSubcategoryId] = useState(editTransaction?.subcategory_id || '');
  const [date, setDate] = useState(editTransaction?.date || today());
  const [paymentMethod, setPaymentMethod] = useState<'debit' | 'pix' | 'credit'>(editTransaction?.payment_method || 'debit');
  const [cardId, setCardId] = useState(editTransaction?.card_id || '');
  const [installments, setInstallments] = useState(editTransaction?.total_installments || 1);
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(editTransaction?.date || today());

  // Computed installment dates preview
  const [installmentDates, setInstallmentDates] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([api.categories.list(), api.categories.cards()]).then(([cats, cds]) => {
      setCategories(cats);
      setCards(cds);
      if (!cardId && cds.length > 0) setCardId(cds[0].id);
    });
  }, []);

  useEffect(() => {
    if (paymentMethod === 'credit' && installments > 1 && cardId) {
      const card = cards.find(c => c.id === cardId);
      if (card) {
        const dates = calculateInstallmentDates(firstInstallmentDate || date, card.closing_day, installments);
        setInstallmentDates(dates);
      }
    } else {
      setInstallmentDates([]);
    }
  }, [paymentMethod, installments, cardId, firstInstallmentDate, date, cards]);

  const parentCategories = categories.filter(c => !c.parent_id);
  const subcategories = categoryId
    ? categories.filter(c => c.parent_id === categoryId)
    : [];

  const selectedCard = cards.find(c => c.id === cardId);
  const totalAmount = parseFloat(amount) || 0;
  const installmentAmount = installments > 1 ? totalAmount / installments : totalAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) { setError('Valor inválido'); return; }
    if (!description.trim()) { setError('Descrição é obrigatória'); return; }

    setLoading(true);
    setError('');

    try {
      const payload = {
        type,
        amount: parseFloat(amount),
        description: description.trim(),
        category_id: categoryId || null,
        subcategory_id: subcategoryId || null,
        date,
        payment_method: paymentMethod,
        card_id: paymentMethod === 'credit' ? cardId : null,
        installments: paymentMethod === 'credit' ? installments : 1,
        first_installment_date: paymentMethod === 'credit' && installments > 1 ? (firstInstallmentDate || date) : date,
      };

      if (editTransaction) {
        await api.transactions.update(editTransaction.id, payload);
      } else {
        await api.transactions.create(payload);
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
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-800 rounded-t-3xl sm:rounded-t-2xl z-10">
          <h2 className="font-semibold text-slate-100">
            {editTransaction ? 'Editar transação' : 'Nova transação'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-2 -mr-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Tipo */}
          <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
            {(['expense', 'income'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={clsx(
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                  type === t
                    ? t === 'expense'
                      ? 'bg-red-900/60 text-red-300 shadow'
                      : 'bg-green-900/60 text-green-300 shadow'
                    : 'text-slate-500 hover:text-slate-300'
                )}
              >
                {t === 'expense' ? '💸 Despesa' : '💰 Receita'}
              </button>
            ))}
          </div>

          {/* Valor */}
          <div>
            <label className="label">Valor total (R$)</label>
            <input
              className="input text-lg font-semibold"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
            {paymentMethod === 'credit' && installments > 1 && totalAmount > 0 && (
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <Calculator className="w-3 h-3" />
                {installments}x de R$ {installmentAmount.toFixed(2)}
              </p>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label className="label">Descrição</label>
            <input
              className="input"
              type="text"
              placeholder="Ex: Compras no mercado"
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>

          {/* Categoria */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoria</label>
              <div className="relative">
                <select
                  className="input appearance-none pr-8"
                  value={categoryId}
                  onChange={e => { setCategoryId(e.target.value); setSubcategoryId(''); }}
                >
                  <option value="">Selecione</option>
                  {parentCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="label">Subcategoria</label>
              <div className="relative">
                <select
                  className="input appearance-none pr-8"
                  value={subcategoryId}
                  onChange={e => setSubcategoryId(e.target.value)}
                  disabled={!categoryId || subcategories.length === 0}
                >
                  <option value="">Selecione</option>
                  {subcategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Data */}
          <div>
            <label className="label">Data da compra</label>
            <input
              className="input"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>

          {/* Forma de pagamento */}
          <div>
            <label className="label">Forma de pagamento</label>
            <div className="flex gap-2">
              {(['debit', 'pix', 'credit'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={clsx(
                    'flex-1 py-2 rounded-xl text-xs font-medium border transition-all',
                    paymentMethod === m
                      ? m === 'credit'
                        ? 'bg-blue-900/40 border-blue-700 text-blue-300'
                        : 'bg-slate-700 border-slate-600 text-slate-200'
                      : 'border-slate-700 text-slate-500 hover:text-slate-300'
                  )}
                >
                  {m === 'debit' ? '🏦 Débito' : m === 'pix' ? '⚡ PIX' : '💳 Crédito'}
                </button>
              ))}
            </div>
          </div>

          {/* Campos de crédito */}
          {paymentMethod === 'credit' && (
            <div className="bg-slate-800/50 rounded-xl p-3 space-y-3 border border-slate-700/50">
              <div>
                <label className="label">Cartão</label>
                <div className="relative">
                  <select
                    className="input appearance-none pr-8"
                    value={cardId}
                    onChange={e => setCardId(e.target.value)}
                    required
                  >
                    {cards.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (fecha dia {c.closing_day})</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="label">Número de parcelas</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="48"
                  value={installments}
                  onChange={e => setInstallments(parseInt(e.target.value) || 1)}
                />
              </div>

              {installments > 1 && (
                <div>
                  <label className="label">Data da primeira parcela</label>
                  <input
                    className="input"
                    type="date"
                    value={firstInstallmentDate}
                    onChange={e => setFirstInstallmentDate(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    O sistema calculará as datas baseado no fechamento do {selectedCard?.name} (dia {selectedCard?.closing_day})
                  </p>
                </div>
              )}

              {/* Preview das parcelas */}
              {installmentDates.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-slate-400 mb-2">Datas calculadas automaticamente:</p>
                  <div className="space-y-1">
                    {installmentDates.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{i + 1}ª parcela</span>
                        <span className="text-blue-300 font-medium">{formatDate(d)}</span>
                        <span className="text-slate-400">R$ {installmentAmount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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
            {loading ? 'Salvando…' : editTransaction ? 'Salvar alterações' : 'Registrar transação'}
          </button>
        </form>
      </div>
    </div>
  );
}
