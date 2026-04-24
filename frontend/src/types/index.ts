export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  children?: Category[];
}

export interface Card {
  id: string;
  name: string;
  closing_day: number;
  due_day: number | null;
  color: string;
}

export type PaymentMethod = 'debit' | 'pix' | 'credit';
export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'paid' | 'pending';

export interface Transaction {
  id: string;
  user_id: string;
  user_name?: string;
  type: TransactionType;
  amount: number;
  description: string;
  category_id: string | null;
  subcategory_id: string | null;
  category_name?: string;
  subcategory_name?: string;
  date: string;
  payment_method: PaymentMethod;
  card_id: string | null;
  card_name?: string;
  card_closing_day?: number;
  card_color?: string;
  total_installments: number;
  installment_number: number;
  parent_transaction_id: string;
  status: TransactionStatus;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  // campos locais (IndexedDB)
  synced?: boolean;
  _local?: boolean;
}

export interface Budget {
  id: string;
  category_id: string;
  category_name?: string;
  month: string;
  amount: number;
  actual?: number;
  remaining?: number;
  percentage?: number;
}

export interface TransactionFilters {
  start_date?: string;
  end_date?: string;
  category_id?: string;
  subcategory_id?: string;
  type?: TransactionType | '';
  payment_method?: PaymentMethod | '';
  card_id?: string;
  user_id?: string;
  search?: string;
  month?: string;
  year?: string;
  status?: TransactionStatus | '';
}

export interface DashboardSummary {
  total_income: number;
  total_expense: number;
  total_credit: number;
  balance: number;
}

export interface SyncStatus {
  online: boolean;
  pendingCount: number;
  lastSync: string | null;
}
