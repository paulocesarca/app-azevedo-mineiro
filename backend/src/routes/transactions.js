const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const webpush = require('web-push');

const router = express.Router();

// Usa authMiddleware em todas as rotas
router.use(authMiddleware);

// GET /transactions
router.get('/', (req, res) => {
  const {
    start_date, end_date, category_id, subcategory_id,
    type, payment_method, card_id, user_id, search,
    month, year
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
  if (end_date) { query += ' AND t.date <= ?'; params.push(end_date); }
  if (month && year) {
    query += ' AND strftime(\'%m\', t.date) = ? AND strftime(\'%Y\', t.date) = ?';
    params.push(month.padStart(2, '0'), year);
  }
  if (category_id) { query += ' AND t.category_id = ?'; params.push(category_id); }
  if (subcategory_id) { query += ' AND t.subcategory_id = ?'; params.push(subcategory_id); }
  if (type) { query += ' AND t.type = ?'; params.push(type); }
  if (payment_method) { query += ' AND t.payment_method = ?'; params.push(payment_method); }
  if (card_id) { query += ' AND t.card_id = ?'; params.push(card_id); }
  if (user_id) { query += ' AND t.user_id = ?'; params.push(user_id); }
  if (search) { query += ' AND t.description LIKE ?'; params.push(`%${search}%`); }

  query += ' ORDER BY t.date DESC, t.created_at DESC';

  const transactions = db.prepare(query).all(...params);
  res.json(transactions);
});

// POST /transactions
router.post('/', (req, res) => {
  const {
    type, amount, description, category_id, subcategory_id,
    date, payment_method, card_id, installments, first_installment_date
  } = req.body;

  if (!type || !amount || !description || !date || !payment_method) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  const userId = req.user.id;
  const parentId = uuidv4();
  const numInstallments = (payment_method === 'credit' && installments > 1) ? parseInt(installments) : 1;
  const installmentAmount = parseFloat(amount) / numInstallments;

  const insert = db.prepare(`
    INSERT INTO transactions
    (id, user_id, type, amount, description, category_id, subcategory_id, date,
     payment_method, card_id, total_installments, installment_number, parent_transaction_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const createdTransactions = [];

  if (payment_method === 'credit' && numInstallments > 1) {
    // Calcula datas das parcelas
    const card = db.prepare('SELECT closing_day FROM cards WHERE id = ?').get(card_id);
    if (!card) return res.status(400).json({ error: 'Cartão não encontrado' });

    const dates = calculateInstallmentDates(first_installment_date || date, card.closing_day, numInstallments);

    const insertMany = db.transaction(() => {
      dates.forEach((installDate, idx) => {
        const id = uuidv4();
        insert.run(
          id, userId, type, installmentAmount, description,
          category_id || null, subcategory_id || null, installDate,
          payment_method, card_id, numInstallments, idx + 1, parentId
        );
        createdTransactions.push({ id, installment_number: idx + 1, date: installDate });
      });
    });
    insertMany();
  } else {
    const id = uuidv4();
    insert.run(
      id, userId, type, parseFloat(amount), description,
      category_id || null, subcategory_id || null, date,
      payment_method, card_id || null, 1, 1, parentId
    );
    createdTransactions.push({ id, installment_number: 1, date });
  }

  // Envia notificação para outros usuários
  sendNotificationToOthers(userId, {
    title: '💰 Nova transação registrada',
    body: `${req.user.name} registrou R$ ${parseFloat(amount).toFixed(2)} em ${description}${numInstallments > 1 ? ` (Crédito ${numInstallments}x)` : ''}`,
  });

  res.status(201).json({
    parent_id: parentId,
    transactions: createdTransactions,
    total_installments: numInstallments,
    amount_per_installment: installmentAmount,
  });
});

// PUT /transactions/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Transação não encontrada' });

  const {
    type, amount, description, category_id, subcategory_id,
    date, payment_method, card_id
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
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    type || null, amount ? parseFloat(amount) : null, description || null,
    category_id !== undefined ? category_id : existing.category_id,
    subcategory_id !== undefined ? subcategory_id : existing.subcategory_id,
    date || null, payment_method || null,
    card_id !== undefined ? card_id : existing.card_id,
    id
  );

  const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE /transactions/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Transação não encontrada' });

  db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  res.json({ success: true });
});

// DELETE /transactions/group/:parentId - deleta todas as parcelas de um grupo
router.delete('/group/:parentId', (req, res) => {
  const { parentId } = req.params;
  db.prepare('DELETE FROM transactions WHERE parent_transaction_id = ?').run(parentId);
  res.json({ success: true });
});

// GET /transactions/installments - parcelas por cartão
router.get('/installments/by-card', (req, res) => {
  const { card_id, from_date } = req.query;
  const today = from_date || new Date().toISOString().split('T')[0];

  let query = `
    SELECT t.*,
      u.name as user_name,
      c.name as category_name,
      cd.name as card_name,
      cd.closing_day,
      cd.color as card_color
    FROM transactions t
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN cards cd ON t.card_id = cd.id
    WHERE t.payment_method = 'credit' AND t.date >= ?
  `;
  const params = [today];

  if (card_id) { query += ' AND t.card_id = ?'; params.push(card_id); }
  query += ' ORDER BY t.date ASC';

  const installments = db.prepare(query).all(...params);
  res.json(installments);
});

// --- HELPERS ---

function calculateInstallmentDates(purchaseDate, closingDay, numInstallments) {
  const dates = [];
  const purchase = new Date(purchaseDate + 'T12:00:00Z');
  const purchaseDay = purchase.getUTCDate();
  const purchaseMonth = purchase.getUTCMonth(); // 0-indexed
  const purchaseYear = purchase.getUTCFullYear();

  // Determina o mês da 1ª parcela
  let firstMonth, firstYear;
  if (purchaseDay > closingDay) {
    // Compra APÓS fechamento -> parcela no próximo mês
    if (purchaseMonth === 11) {
      firstMonth = 0;
      firstYear = purchaseYear + 1;
    } else {
      firstMonth = purchaseMonth + 1;
      firstYear = purchaseYear;
    }
  } else {
    // Compra ANTES ou no dia do fechamento -> parcela no mês atual
    firstMonth = purchaseMonth;
    firstYear = purchaseYear;
  }

  for (let i = 0; i < numInstallments; i++) {
    let month = firstMonth + i;
    let year = firstYear;
    while (month > 11) { month -= 12; year++; }

    // Ajusta se o dia não existir no mês (ex: 31 em fevereiro)
    const maxDay = new Date(year, month + 1, 0).getDate();
    const day = Math.min(closingDay, maxDay);

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    dates.push(dateStr);
  }

  return dates;
}

function sendNotificationToOthers(userId, payload) {
  try {
    const otherUsers = db.prepare('SELECT push_subscription FROM users WHERE id != ? AND push_subscription IS NOT NULL').all(userId);
    otherUsers.forEach(u => {
      if (u.push_subscription) {
        const sub = JSON.parse(u.push_subscription);
        webpush.sendNotification(sub, JSON.stringify(payload)).catch(() => {});
      }
    });
  } catch (e) {
    // Ignora erros de push
  }
}

module.exports = router;
