const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/finance.db');

// Garante que o diretório existe
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Habilita WAL para performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Criação das tabelas
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    push_subscription TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (parent_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    closing_day INTEGER NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    category_id TEXT,
    subcategory_id TEXT,
    date TEXT NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('debit', 'pix', 'credit')),
    card_id TEXT,
    total_installments INTEGER DEFAULT 1,
    installment_number INTEGER DEFAULT 1,
    parent_transaction_id TEXT,
    status TEXT NOT NULL DEFAULT 'paid' CHECK(status IN ('paid', 'pending')),
    paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (subcategory_id) REFERENCES categories(id),
    FOREIGN KEY (card_id) REFERENCES cards(id)
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    month TEXT NOT NULL,
    amount REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(category_id, month),
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    payload TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Dados iniciais
function seedData() {
  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (categoryCount.count > 0) return;

  const { v4: uuidv4 } = require('uuid');

  // Categorias pai
  const cats = [
    { id: uuidv4(), name: 'Compras', parent_id: null },
    { id: uuidv4(), name: 'Despesas Fixas', parent_id: null },
    { id: uuidv4(), name: 'Despesas Variáveis', parent_id: null },
    { id: uuidv4(), name: 'Receitas', parent_id: null },
  ];

  const insertCat = db.prepare('INSERT INTO categories (id, name, parent_id) VALUES (?, ?, ?)');
  cats.forEach(c => insertCat.run(c.id, c.name, c.parent_id));

  // Subcategorias
  const comprasId = cats[0].id;
  const fixasId = cats[1].id;
  const variaveisId = cats[2].id;
  const receitasId = cats[3].id;

  const subcats = [
    { id: uuidv4(), name: 'Lazer', parent_id: comprasId },
    { id: uuidv4(), name: 'Mercado', parent_id: comprasId },
    { id: uuidv4(), name: 'Almoço de família', parent_id: comprasId },
    { id: uuidv4(), name: 'Mercado não planejado', parent_id: comprasId },
    { id: uuidv4(), name: 'Gasolina', parent_id: fixasId },
    { id: uuidv4(), name: 'Comida não planejada', parent_id: variaveisId },
    { id: uuidv4(), name: 'Salário', parent_id: receitasId },
    { id: uuidv4(), name: 'Freelance', parent_id: receitasId },
  ];
  subcats.forEach(c => insertCat.run(c.id, c.name, c.parent_id));

  // Cartões
  const insertCard = db.prepare('INSERT INTO cards (id, name, closing_day, due_day, color) VALUES (?, ?, ?, ?, ?)');
  insertCard.run(uuidv4(), 'Sicredi', 29, 13, '#16A34A');
  insertCard.run(uuidv4(), 'Mercado Pago', 9, null, '#2563EB');
  insertCard.run(uuidv4(), 'Banco Inter', 9, null, '#EA580C');
}

// Migração de categorias: adiciona Contratos Fixos e Freelancers se ainda não existirem
function migrateIncomeCategories() {
  const { v4: uuidv4 } = require('uuid');
  const receitas = db.prepare("SELECT id FROM categories WHERE name = 'Receitas' AND parent_id IS NULL").get();
  if (!receitas) return;

  const toAdd = ['Contratos Fixos', 'Freelancers'];
  toAdd.forEach(name => {
    const exists = db.prepare('SELECT id FROM categories WHERE name = ? AND parent_id = ?').get(name, receitas.id);
    if (!exists) {
      db.prepare('INSERT INTO categories (id, name, parent_id) VALUES (?, ?, ?)').run(uuidv4(), name, receitas.id);
    }
  });
}
migrateIncomeCategories();

// Migração: adiciona colunas novas em DBs já existentes sem quebrar
try { db.exec(`ALTER TABLE transactions ADD COLUMN status TEXT NOT NULL DEFAULT 'paid'`); } catch (_) {}
try { db.exec(`ALTER TABLE transactions ADD COLUMN paid_at TEXT`); } catch (_) {}
try { db.exec(`ALTER TABLE cards ADD COLUMN due_day INTEGER`); } catch (_) {}

// Migração: atualiza Sicredi para fechamento dia 29 e vencimento dia 13
function migrateSicrediCard() {
  db.prepare(`UPDATE cards SET closing_day = 29, due_day = 13 WHERE name = 'Sicredi'`).run();
}
migrateSicrediCard();

seedData();

module.exports = db;
