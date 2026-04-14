/**
 * Calcula as datas de vencimento das parcelas de um cartão de crédito.
 *
 * Regra:
 *  - Se o dia da compra > dia de fechamento: 1ª parcela cai no fechamento do MÊS SEGUINTE
 *  - Se o dia da compra <= dia de fechamento: 1ª parcela cai no fechamento do MÊS ATUAL
 */
export function calculateInstallmentDates(
  purchaseDate: string,
  closingDay: number,
  numInstallments: number
): string[] {
  const purchase = new Date(purchaseDate + 'T12:00:00Z');
  const purchaseDay = purchase.getUTCDate();
  const purchaseMonth = purchase.getUTCMonth(); // 0-indexed
  const purchaseYear = purchase.getUTCFullYear();

  let firstMonth: number;
  let firstYear: number;

  if (purchaseDay > closingDay) {
    // Compra APÓS o fechamento → próximo mês
    if (purchaseMonth === 11) {
      firstMonth = 0;
      firstYear = purchaseYear + 1;
    } else {
      firstMonth = purchaseMonth + 1;
      firstYear = purchaseYear;
    }
  } else {
    // Compra ANTES ou NO dia do fechamento → mesmo mês
    firstMonth = purchaseMonth;
    firstYear = purchaseYear;
  }

  const dates: string[] = [];
  for (let i = 0; i < numInstallments; i++) {
    let month = firstMonth + i;
    let year = firstYear;
    while (month > 11) {
      month -= 12;
      year++;
    }

    // Ajusta se o dia não existe no mês (ex: 31 de fevereiro)
    const maxDay = new Date(year, month + 1, 0).getDate();
    const day = Math.min(closingDay, maxDay);

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    dates.push(dateStr);
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
