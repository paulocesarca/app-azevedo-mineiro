/**
 * Calcula as datas de vencimento das parcelas de um cartão de crédito.
 *
 * Regra:
 *  - Determina em qual fatura a compra cai (baseado no closing_day)
 *  - A parcela vence no mês SEGUINTE ao fechamento, no dia de vencimento (due_day)
 *
 * Exemplo: Sicredi fecha dia 29, vence dia 13
 *  - Compra dia 15/abril → fatura abril (fecha 29/04) → 1ª parcela: 13/maio ✅
 *  - Compra dia 30/abril → fatura maio (fecha 29/05) → 1ª parcela: 13/junho ✅
 */
export function calculateInstallmentDates(
  purchaseDate: string,
  closingDay: number,
  numInstallments: number,
  dueDay?: number | null
): string[] {
  const purchase = new Date(purchaseDate + 'T12:00:00Z');
  const purchaseDay = purchase.getUTCDate();
  const purchaseMonth = purchase.getUTCMonth();
  const purchaseYear = purchase.getUTCFullYear();

  // Mês em que a fatura fecha
  let billingMonth: number;
  let billingYear: number;

  if (purchaseDay > closingDay) {
    // Compra após fechamento → fatura do próximo mês
    billingMonth = purchaseMonth === 11 ? 0 : purchaseMonth + 1;
    billingYear  = purchaseMonth === 11 ? purchaseYear + 1 : purchaseYear;
  } else {
    // Compra antes/no fechamento → fatura deste mês
    billingMonth = purchaseMonth;
    billingYear  = purchaseYear;
  }

  // Parcela vence no mês seguinte ao fechamento, no due_day (ou closing_day se não tiver)
  const payDay = dueDay ?? closingDay;
  const firstMonth = billingMonth === 11 ? 0 : billingMonth + 1;
  const firstYear  = billingMonth === 11 ? billingYear + 1 : billingYear;

  const dates: string[] = [];
  for (let i = 0; i < numInstallments; i++) {
    let month = firstMonth + i;
    let year = firstYear;
    while (month > 11) {
      month -= 12;
      year++;
    }
    const maxDay = new Date(year, month + 1, 0).getDate();
    const day = Math.min(payDay, maxDay);
    dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }

  return dates;
}

/** Formata data de YYYY-MM-DD para DD/MM/YYYY */
export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

/** Retorna YYYY-MM do mês atual */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Retorna YYYY-MM-DD de hoje */
export function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** Formata valor monetário */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/** Retorna nome do mês em PT-BR */
export function monthName(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

/** Retorna os últimos N meses como YYYY-MM */
export function lastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}
