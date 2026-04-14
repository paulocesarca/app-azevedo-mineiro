import { useState, useEffect, useCallback } from 'react';
import { CreditCard, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, formatDate, today } from '../lib/installments';
import type { Transaction, Card } from '../types';
import clsx from 'clsx';

interface CardGroup {
  card: Card;
  installments: Transaction[];
  total: number;
  count: number;
  nextClosing: string;
}

function getNextClosingDate(closingDay: number): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  let closingMonth = month;
  let closingYear = year;

  if (day >= closingDay) {
    closingMonth = month + 1;
    if (closingMonth > 11) { closingMonth = 0; closingYear = year + 1; }
  }

  return `${closingYear}-${String(closingMonth + 1).padStart(2, '0')}-${String(closingDay).padStart(2, '0')}`;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T12:00:00Z');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Cards() {
  const [cards, setCards] = useState<Card[]>([]);
  const [groups, setGroups] = useState<CardGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cds, installments] = await Promise.all([
        api.categories.cards(),
        api.transactions.installmentsByCard({ from_date: today() }),
      ]);
      setCards(cds);

      const grouped: CardGroup[] = cds.map(card => {
        const cardInstallments = installments.filter(t => t.card_id === card.id);
        return {
          card,
          installments: cardInstallments,
          total: cardInstallments.reduce((a, t) => a + t.amount, 0),
          count: cardInstallments.length,
          nextClosing: getNextClosingDate(card.closing_day),
        };
      });
      setGroups(grouped);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Agrupa parcelas por mês para um cartão
  const groupByMonth = (installments: Transaction[]) => {
    const map = new Map<string, Transaction[]>();
    installments.forEach(t => {
      const ym = t.date.substring(0, 7);
      if (!map.has(ym)) map.set(ym, []);
      map.get(ym)!.push(t);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  };

  if (loading) {
    return (
      <div className="px-4 pt-3 space-y-4 max-w-lg mx-auto">
        <h1 className="text-lg font-bold text-slate-100">Cartões</h1>
        {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-800 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="px-4 pt-3 space-y-4 max-w-lg mx-auto">
      <h1 className="text-lg font-bold text-slate-100">Cartões</h1>

      {groups.map(({ card, installments, total, count, nextClosing }) => {
        const days = daysUntil(nextClosing);
        const isExpanded = expandedCard === card.id;
        const monthGroups = groupByMonth(installments);

        return (
          <div key={card.id} className="card space-y-3">
            {/* Header do cartão */}
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedCard(isExpanded ? null : card.id)}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: card.color + '33', border: `1px solid ${card.color}55` }}
                >
                  <CreditCard className="w-5 h-5" style={{ color: card.color }} />
                </div>
                <div>
                  <p className="font-semibold text-slate-200">{card.name}</p>
                  <p className="text-xs text-slate-500">Fecha dia {card.closing_day} de cada mês</p>
                </div>
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-800/60 rounded-xl p-2.5 text-center">
                <p className="text-xs text-slate-500 mb-0.5">Pendentes</p>
                <p className="text-sm font-bold text-slate-200">{count}</p>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-2.5 text-center">
                <p className="text-xs text-slate-500 mb-0.5">Total</p>
                <p className="text-sm font-bold text-blue-400">{formatCurrency(total)}</p>
              </div>
              <div className={clsx(
                'rounded-xl p-2.5 text-center',
                days <= 1 ? 'bg-red-900/30' : days <= 5 ? 'bg-yellow-900/30' : 'bg-slate-800/60'
              )}>
                <p className="text-xs text-slate-500 mb-0.5">Fechamento</p>
                <p className={clsx(
                  'text-sm font-bold',
                  days <= 1 ? 'text-red-400' : days <= 5 ? 'text-yellow-400' : 'text-slate-200'
                )}>
                  {days === 0 ? 'Hoje!' : days === 1 ? 'Amanhã' : `${days}d`}
                </p>
                <p className="text-[10px] text-slate-600">{formatDate(nextClosing)}</p>
              </div>
            </div>

            {/* Parcelas expandidas */}
            {isExpanded && (
              <div className="space-y-3 pt-1 animate-fade-in">
                {installments.length === 0 ? (
                  <p className="text-center text-slate-500 text-sm py-3">Sem parcelas pendentes</p>
                ) : (
                  monthGroups.map(([ym, txs]) => {
                    const [year, month] = ym.split('-');
                    const monthLabel = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                    const monthTotal = txs.reduce((a, t) => a + t.amount, 0);

                    return (
                      <div key={ym}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-slate-400 capitalize">{monthLabel}</p>
                          <p className="text-xs font-bold text-blue-400">{formatCurrency(monthTotal)}</p>
                        </div>
                        <div className="space-y-0">
                          {txs.map(t => (
                            <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-300 truncate">{t.description}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-slate-600">{t.user_name}</span>
                                  {t.total_installments > 1 && (
                                    <span className="text-[10px] text-indigo-400 bg-indigo-900/30 px-1 rounded">
                                      {t.installment_number}/{t.total_installments}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 ml-3">
                                <p className="text-xs font-semibold text-blue-400">{formatCurrency(t.amount)}</p>
                                <p className="text-[10px] text-slate-600 flex items-center gap-0.5 justify-end">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(t.date)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
