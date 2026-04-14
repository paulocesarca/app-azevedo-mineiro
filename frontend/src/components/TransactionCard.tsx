import { Pencil, Trash2, CreditCard, Smartphone, Building2 } from 'lucide-react';
import type { Transaction } from '../types';
import { formatDate, formatCurrency } from '../lib/installments';
import clsx from 'clsx';

interface Props {
  transaction: Transaction;
  onEdit?: (t: Transaction) => void;
  onDelete?: (t: Transaction) => void;
  compact?: boolean;
}

function PaymentIcon({ method }: { method: string }) {
  if (method === 'credit') return <CreditCard className="w-3.5 h-3.5" />;
  if (method === 'pix') return <Smartphone className="w-3.5 h-3.5" />;
  return <Building2 className="w-3.5 h-3.5" />;
}

export default function TransactionCard({ transaction: t, onEdit, onDelete, compact }: Props) {
  const isIncome = t.type === 'income';
  const isCredit = t.payment_method === 'credit';

  return (
    <div className={clsx(
      'flex items-center gap-3 py-3 px-1 border-b border-slate-800/60 last:border-0 group',
      'hover:bg-slate-800/30 rounded-xl transition-all duration-100 -mx-1 px-2'
    )}>
      {/* Ícone / indicador */}
      <div className={clsx(
        'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base',
        isIncome ? 'bg-green-900/30' : isCredit ? 'bg-blue-900/30' : 'bg-red-900/30'
      )}>
        {isIncome ? '💰' : isCredit ? '💳' : '💸'}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{t.description}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {t.subcategory_name || t.category_name ? (
                <span className="text-xs text-slate-500">
                  {t.category_name}{t.subcategory_name ? ` › ${t.subcategory_name}` : ''}
                </span>
              ) : null}
              {!compact && (
                <span className="text-xs text-slate-600">· {t.user_name}</span>
              )}
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <p className={clsx(
              'text-sm font-semibold tabular-nums',
              isIncome ? 'text-green-400' : isCredit ? 'text-blue-400' : 'text-red-400'
            )}>
              {isIncome ? '+' : '-'}{formatCurrency(t.amount)}
            </p>
            <p className="text-xs text-slate-600">{formatDate(t.date)}</p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className={clsx(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium',
            isCredit ? 'bg-blue-900/30 text-blue-400' : 'bg-slate-800 text-slate-500'
          )}>
            <PaymentIcon method={t.payment_method} />
            {t.payment_method === 'credit' ? t.card_name : t.payment_method === 'pix' ? 'PIX' : 'Débito'}
          </span>

          {isCredit && t.total_installments > 1 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] bg-indigo-900/30 text-indigo-400">
              {t.installment_number}/{t.total_installments}
            </span>
          )}
        </div>
      </div>

      {/* Ações */}
      {(onEdit || onDelete) && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
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
      )}
    </div>
  );
}
