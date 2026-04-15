import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthName } from '../lib/installments';

interface Props {
  value: string;          // "YYYY-MM"
  onChange: (month: string) => void;
  minMonth?: string;      // "YYYY-MM" — não deixa ir além disso para trás
  maxMonth?: string;      // "YYYY-MM" — não deixa ir além disso para frente
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function MonthSelector({ value, onChange, minMonth, maxMonth }: Props) {
  const prev = addMonths(value, -1);
  const next = addMonths(value, +1);

  const canGoPrev = !minMonth || prev >= minMonth;
  const canGoNext = !maxMonth || next <= maxMonth;

  // Capitaliza primeira letra do nome do mês
  const label = monthName(value).replace(/^\w/, c => c.toUpperCase());

  return (
    <div className="flex items-center justify-between bg-slate-800/60 rounded-2xl px-2 py-1.5">
      <button
        onClick={() => canGoPrev && onChange(prev)}
        disabled={!canGoPrev}
        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-700 active:scale-90 transition-all disabled:opacity-25 disabled:cursor-not-allowed"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <span className="text-sm font-semibold text-slate-100 select-none min-w-[160px] text-center">
        {label}
      </span>

      <button
        onClick={() => canGoNext && onChange(next)}
        disabled={!canGoNext}
        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-700 active:scale-90 transition-all disabled:opacity-25 disabled:cursor-not-allowed"
        aria-label="Próximo mês"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
