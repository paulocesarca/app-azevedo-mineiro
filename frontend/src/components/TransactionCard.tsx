import { useState } from 'react';
import { Pencil, Trash2, CreditCard, Smartphone, Building2, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import type { Transaction } from '../types';
import { formatDate, formatCurrency } from '../lib/installments';
import { api } from '../lib/api';
import clsx from 'clsx';

interface Props {
  transaction: Transaction;
  onEdit?: (t: Transaction) => void;
  onDelete?: (t: Transaction) => void;
  onStatusChange?: (updated: Transaction) => void;
  compact?: boolean;
}

function PaymentIcon({ method }: { method: string }) {
  if (method === 'credit') return <CreditCard className="w-3.5 h-3.5" />;
  if (method === 'pix') return <Smartphone className="w-3.5 h-3.5" />;
  return <Building2 className="w-3.5 h-3.5" />;
}

export default function TransactionCard({ transaction: t, onEdit, onDelete, onStatusChange, compact }: Props) {
  const isIncome  = t.type === 'income';
  const isCredit  = t.payment_method === 'credit';
  const isPending = t.status === 'pending';
  const [toggling, setToggling] = useState(false);

  const handleTogglePaid = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setToggling(true);
    try {
      const updated = isPending
        ? await api.transactions.markPaid(t.id)
        : await api.transactions.markUnpaid(t.id);
      onStatusChange?.(updated);
    } catch (_) {
      alert('Erro ao atualizar status');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className={clsx(
      'flex items-center gap-3 py-3 px-2 border-b border-slate-800/60 last:border-0 group',
      'hover:bg-slate-800/30 rounded-xl transition-all duration-100 -mx-2',
      isPending && 'opacity-80'
    )}>
      {/* Ícone */}
      <div className={clsx(
        'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base',
        isPending
          ? 'bg-yellow-900/30'
          : isIncome ? 'bg-green-900/30' : isCredit ? 'bg-blue-900/30' : 'bg-red-900/30'
      )}>
        {isPending ? '⏳' : isIncome ? '💰' : isCredit ? '💳' : '💸'}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={clsx(
              'text-sm font-medium truncate',
              isPending ? 'text-yellow-100' : 'text-slate-200'
            )}>
              {t.description}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {(t.subcategory_name || t.category_name) && (
                <span className="text-xs text-slate-500">
                  {t.category_name}{t.subcategory_name ? ` › ${t.subcategory_name}` : ''}
                </span>
              )}
              {!compact && (
                <span className="text-xs text-slate-600">· {t.user_name}</span>
              )}
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <p className={clsx(
              'text-sm font-semibold tabular-nums',
              isPending
                ? 'text-yellow-400'
                : isIncome ? 'text-green-400' : isCredit ? 'text-blue-400' : 'text-red-400'
            )}>
              {isIncome ? '+' : '-'}{formatCurrency(t.amount)}
            </p>
            <p className="text-xs text-slate-600">{formatDate(t.date)}</p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {/* Badge de status */}
          <span className={clsx(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium',
            isPending
              ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-800/50'
              : 'bg-green-900/20 text-green-600'
          )}>
            {isPending
              ? <><Clock className="w-2.5 h-2.5" /> A pagar</>
              : <><CheckCircle2 className="w-2.5 h-2.5" /> Pago</>}
          </span>

          {/* Forma de pagamento */}
          <span className={clsx(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium',
            isCredit ? 'bg-blue-900/30 text-blue-400' : 'bg-slate-800 text-slate-500'
          )}>
            <PaymentIcon method={t.payment_method} />
            {t.payment_method === 'credit' ? t.card_name : 'Pix/Débito'}
          </span>

          {isCredit && t.total_installments > 1 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] bg-indigo-900/30 text-indigo-400">
              {t.installment_number}/{t.total_installments}
            </span>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Botão marcar pago / desmarcar */}
        {onStatusChange && (
          <button
            onClick={handleTogglePaid}
            disabled={toggling}
            title={isPending ? 'Marcar como pago' : 'Desfazer pagamento'}
            className={clsx(
              'p-2 rounded-xl transition-all active:scale-90',
              isPending
                ? 'bg-yellow-900/40 text-yellow-400 hover:bg-yellow-800/60'
                : 'text-slate-600 hover:text-slate-400 opacity-0 group-hover:opacity-100'
            )}
          >
            {toggling
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : isPending
                ? <CheckCircle2 className="w-4 h-4" />
                : <CheckCircle2 className="w-4 h-4" />}
          </button>
        )}

        {/* Editar / Deletar (aparecem no hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button onClick={() => onEdit(t)} className="btn-ghost p-1.5">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(t)} className="btn-ghost p-1.5 hover:text-red-400">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
