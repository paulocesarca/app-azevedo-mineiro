import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Transaction, Budget, Card, Category } from '../types';

interface FinanceDB extends DBSchema {
  transactions: {
    key: string;
    value: Transaction & { synced: boolean };
    indexes: {
      'by-date': string;
      'by-user': string;
      'by-card': string;
      'by-parent': string;
    };
  };
  categories: {
    key: string;
    value: Category;
  };
  cards: {
    key: string;
    value: Card;
  };
  budgets: {
    key: string;
    value: Budget;
    indexes: { 'by-month': string };
  };
  sync_queue: {
    key: string;
    value: {
      id: string;
      operation: 'create' | 'update' | 'delete';
      entity: string;
      entity_id: string;
      payload?: unknown;
      created_at: string;
    };
  };
}

let dbInstance: IDBPDatabase<FinanceDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<FinanceDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<FinanceDB>('azevedo-mineiro-finance', 2, {
    upgrade(db, oldVersion) {
      // Transactions
      if (!db.objectStoreNames.contains('transactions')) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
        txStore.createIndex('by-date', 'date');
        txStore.createIndex('by-user', 'user_id');
        txStore.createIndex('by-card', 'card_id');
        txStore.createIndex('by-parent', 'parent_transaction_id');
      }

      // Categories
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }

      // Cards
      if (!db.objectStoreNames.contains('cards')) {
        db.createObjectStore('cards', { keyPath: 'id' });
      }

      // Budgets
      if (!db.objectStoreNames.contains('budgets')) {
        const budgetStore = db.createObjectStore('budgets', { keyPath: 'id' });
        budgetStore.createIndex('by-month', 'month');
      }

      // Sync queue
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id' });
      }
    },
  });

  return dbInstance;
}

// --- Transactions ---
export async function saveTransactionLocal(tx: Transaction): Promise<void> {
  const db = await getDB();
  await db.put('transactions', { ...tx, synced: false });
}

export async function getTransactionsLocal(filters?: {
  month?: string;
  year?: string;
  start_date?: string;
  end_date?: string;
}): Promise<Transaction[]> {
  const db = await getDB();
  let all = await db.getAll('transactions');

  if (filters?.month && filters?.year) {
    const prefix = `${filters.year}-${filters.month.padStart(2, '0')}`;
    all = all.filter(t => t.date.startsWith(prefix));
  }
  if (filters?.start_date) {
    all = all.filter(t => t.date >= filters.start_date!);
  }
  if (filters?.end_date) {
    all = all.filter(t => t.date <= filters.end_date!);
  }

  return all.sort((a, b) => b.date.localeCompare(a.date));
}

export async function deleteTransactionLocal(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('transactions', id);
}

// --- Categories ---
export async function saveCategoriesLocal(categories: Category[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('categories', 'readwrite');
  await Promise.all(categories.flatMap(c => [
    tx.store.put(c),
    ...(c.children || []).map(child => tx.store.put(child)),
  ]));
  await tx.done;
}

export async function getCategoriesLocal(): Promise<Category[]> {
  const db = await getDB();
  return db.getAll('categories');
}

// --- Cards ---
export async function saveCardsLocal(cards: Card[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('cards', 'readwrite');
  await Promise.all(cards.map(c => tx.store.put(c)));
  await tx.done;
}

export async function getCardsLocal(): Promise<Card[]> {
  const db = await getDB();
  return db.getAll('cards');
}

// --- Sync Queue ---
export async function addToSyncQueue(item: {
  id: string;
  operation: 'create' | 'update' | 'delete';
  entity: string;
  entity_id: string;
  payload?: unknown;
}): Promise<void> {
  const db = await getDB();
  await db.put('sync_queue', { ...item, created_at: new Date().toISOString() });
}

export async function getSyncQueue() {
  const db = await getDB();
  return db.getAll('sync_queue');
}

export async function clearSyncQueueItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('sync_queue', id);
}

export async function getSyncQueueCount(): Promise<number> {
  const db = await getDB();
  return db.count('sync_queue');
}
