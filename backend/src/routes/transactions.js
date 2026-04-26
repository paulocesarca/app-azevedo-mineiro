const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const webpush = require('web-push');

const router = express.Router();
router.use(authMiddleware);

// GET /transactions
router.get('/', (req, res) => {
  const {
    start_date, end_date, category_id, subcategory_id,
    type, payment_method, card_id, user_id, search,
    month, year, status
  } = req.query;

  let query = `
    SELECT t.*,
      u.name as user_name,
      c.name as category_name,
      s.name as subcategory_name,
      cd.name as card_name,
      cd.closing_day as card_closing_day,
      cd.color as card_color
    FROM transactions t
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories s ON t.subcategory_id = s.id
    LEFT JOIN cards cd ON t.card_id = cd.id
    WHERE 1=1
  `;
  const params = [];

  if (start_date) { query += ' AND t.date >= ?'; params.push(start_date); }
  if (end_date)   { query += ' AND t.date <= ?'; params.push(end_date); }
  if (month && year) {
    query += ` AND strftime('%m', t.date) = ? AND strftime('%Y', t.date) = ?`;
    params.push(month.padStart(2, '0'), year);
  }
  if (category_id)    { query += ' AND t.category_id = ?';    params.push(category_id); }
  if (subcategory_id) { query += ' AND t.subcategory_id = ?'; params.push(subcategory_id); }
  if (type)           { query += ' AND t.type = ?';           params.push(type); }
  if (payment_method) { query += ' AND t.payment_method = ?'; params.push(payment_method); }
  if (card_id)        { query += ' AND t.card_id = ?';        params.push(card_id); }
  if (user_id)        { query += ' AND t.user_id = ?';        params.push(user_id); }
  if (search)         { query += ' AND t.description LIKE ?'; params.push(`%${search}%`); }
  if (status)         { query += ' AND t.status = ?';         params.push(status); }

  query += ' ORDER BY t.date ASC, t.created_at DESC';

  const transactions = db.prepare(query).all(...params);
  res.json(transactions);
});

// GET /transactions/pending — contas a pagar pendentes
router.get('/pending', (req, res) => {
  const transactions = db.prepare(`
    SELECT t.*,
      u.name as user_name,
      c.name as category_name,
      s.name as subcategory_name,
      cd.name as card_name,
      cd.color as card_color
    FROM transactions t
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories s ON t.subcategory_id = s.id
    LEFT JOIN cards cd ON t.card_id = cd.id
    WHERE t.status = 'pending'
    ORDER BY t.date ASC
  `).all();
  res.json(transactions);
});

// POST /transactions
router.post('/', (req, res) => {
  const {
    type, amount, description, category_id, subcategory_id,
    date, payment_method, card_id, installments, first_installment_date,
    status
  } = req.body;

  if (!type || !amount || !description || !date || !payment_method) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  const txStatus = status === 'pending' ? 'pending' : 'paid';
  const userId = req.user.id;
  const parentId = uuidv4();
  const numInstallments = (payment_method === 'credit' && installments > 1) ? parseInt(installments) : 1;
  const installmentAmount = parseFloat(amount); // frontend já envia o valor por parcela

  const insert = db.prepare(`
    INSERT INTO transactions
    (id, user_id, type, amount, description, category_id, subcategory_id, date,
     payment_method, card_id, total_installments, installment_number,
     parent_transaction_id, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const createdTransactions = [];

  if (payment_method === 'credit' && numInstallments > 1) {
    const card = db.prepare('SELECT closing_day, due_day FROM cards WHERE id = ?').get(card_id);
    if (!card) return res.status(400).json({ error: 'Cartão não encontrado' });

    const dates = calculateInstallmentDates(first_installment_date || date, card.closing_day, card.due_day, numInstallments);

    db.transaction(() => {
      dates.forEach((installDate, idx) => {
        const id = uuidv4();
        insert.run(
          id, userId, type, installmentAmount, description,
          category_id || null, subcategory_id || null, installDate,
          payment_method, card_id, numInstallments, idx + 1, parentId, txStatus
        );
        createdTransactions.push({ id, installment_number: idx + 1, date: installDate });
      });
    })();
  } else {
    const id = uuidv4();
    insert.run(
      id, userId, type, parseFloat(amount), description,
      category_id || null, subcategory_id || null, date,
      payment_method, card_id || null, 1, 1, parentId, txStatus
    );
    createdTransactions.push({ id, installment_number: 1, date });
  }

  sendNotificationToOthers(userId, {
    title: txStatus === 'pending' ? '📋 Conta lançada' : '💰 Nova transação',
    body: `${req.user.name} ${txStatus === 'pending' ? 'lançou conta a pagar' : 'registrou'}: R$ ${parseFloat(amount).toFixed(2)} — ${description}`,
  });

  res.status(201).json({
    parent_id: parentId,
    transactions: createdTransactions,
    total_installments: numInstallments,
    amount_per_installment: installmentAmount,
  });
});

// PATCH /transactions/:id/pay — marca como pago
router.patch('/:id/pay', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Transação não encontrada' });

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE transactions
    SET status = 'paid', paid_at = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(now, id);

  const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  res.json(updated);
});

// PATCH /transactions/:id/unpay — desmarca pagamento
router.patch('/:id/unpay', (req, res) => {
  const { id } = req.params;
  db.prepare(`
    UPDATE transactions
    SET status = 'pending', paid_at = NULL, updated_at = datetime('now')
    WHERE id = ?
  `).run(id);
  const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  res.json(updated);
});

// PUT /transactions/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Transação não encontrada' });

  const {
    type, amount, description, category_id, subcategory_id,
    date, payment_method, card_id, status
  } = req.body;

  db.prepare(`
    UPDATE transactions SET
      type = COALESCE(?, type),
      amount = COALESCE(?, amount),
      description = COALESCE(?, description),
      category_id = ?,
      subcategory_id = ?,
      date = COALESCE(?, date),
      payment_method = COALESCE(?, payment_method),
      card_id = ?,
      status = COALESCE(?, status),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    type || null,
    amount ? parseFloat(amount) : null,
    description || null,
    category_id !== undefined ? category_id : existing.category_id,
    subcategory_id !== undefined ? subcategory_id : existing.subcategory_id,
    date || null,
    payment_method || null,
    card_id !== undefined ? card_id : existing.card_id,
    status || null,
    id
  );

  const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE /transactions/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  if (!db.prepare('SELECT id FROM transactions WHERE id = ?').get(id))
    return res.status(404).json({ error: 'Transação não encontrada' });
  db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  res.json({ success: true });
});

// DELETE /transactions/group/:parentId
router.delete('/group/:parentId', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE parent_transaction_id = ?').run(req.params.parentId);
  res.json({ success: true });
});

// GET /transactions/installments/by-card
router.get('/installments/by-card', (req, res) => {
  const { card_id, from_date } = req.query;
  const today = from_date || new Date().toISOString().split('T')[0];

  let query = `
    SELECT t.*, u.name as user_name, c.name as category_name,
      cd.name as card_name, cd.closing_day, cd.color as card_color
    FROM transactions t
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN cards cd ON t.card_id = cd.id
    WHERE t.payment_method = 'credit' AND t.date >= ?
  `;
  const params = [today];
  if (card_id) { query += ' AND t.card_id = ?'; params.push(card_id); }
  query += ' ORDER BY t.date ASC';

  res.json(db.prepare(query).all(...params));
});

// --- HELPERS ---

function calculateInstallmentDates(purchaseDate, closingDay, dueDay, numInstallments) {
  const dates = [];
  const purchase = new Date(purchaseDate + 'T12:00:00Z');
  const purchaseDay   = purchase.getUTCDate();
  const purchaseMonth = purchase.getUTCMonth();
  const purchaseYear  = purchase.getUTCFullYear();

  let firstMonth, firstYear, payDay;

  if (dueDay) {
    // Cartão COM vencimento (ex: Sicredi fecha 29, vence 13):
    // Determina qual fatura a compra entra, depois vai pro mês seguinte no due_day
    let billingMonth, billingYear;
    if (purchaseDay > closingDay) {
      billingMonth = purchaseMonth === 11 ? 0  : purchaseMonth + 1;
      billingYear  = purchaseMonth === 11 ? purchaseYear + 1 : purchaseYear;
    } else {
      billingMonth = purchaseMonth;
      billingYear  = purchaseYear;
    }
    firstMonth = billingMonth === 11 ? 0  : billingMonth + 1;
    firstYear  = billingMonth === 11 ? billingYear + 1 : billingYear;
    payDay = dueDay;
  } else {
    // Cartão SEM vencimento configurado (ex: Banco Inter fecha 9):
    // Compra antes/no fechamento → parcela no mês atual no closing_day
    // Compra após fechamento → parcela no mês seguinte no closing_day
    if (purchaseDay > closingDay) {
      firstMonth = purchaseMonth === 11 ? 0  : purchaseMonth + 1;
      firstYear  = purchaseMonth === 11 ? purchaseYear + 1 : purchaseYear;
    } else {
      firstMonth = purchaseMonth;
      firstYear  = purchaseYear;
    }
    payDay = closingDay;
  }

  for (let i = 0; i < numInstallments; i++) {
    let month = firstMonth + i, year = firstYear;
    while (month > 11) { month -= 12; year++; }
    const maxDay = new Date(year, month + 1, 0).getDate();
    const day = Math.min(payDay, maxDay);
    dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  return dates;
}

function sendNotificationToOthers(userId, payload) {
  try {
    const others = db.prepare('SELECT push_subscription FROM users WHERE id != ? AND push_subscription IS NOT NULL').all(userId);
    others.forEach(u => {
      try {
        webpush.sendNotification(JSON.parse(u.push_subscription), JSON.stringify(payload)).catch(() => {});
      } catch (_) {}
    });
  } catch (_) {}
}

module.exports = router;
