const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /budget?month=YYYY-MM
router.get('/', (req, res) => {
  const { month } = req.query;

  let budgets;
  if (month) {
    budgets = db.prepare(`
      SELECT b.*, c.name as category_name, c.parent_id
      FROM budgets b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.month = ?
      ORDER BY c.name
    `).all(month);
  } else {
    budgets = db.prepare(`
      SELECT b.*, c.name as category_name, c.parent_id
      FROM budgets b
      LEFT JOIN categories c ON b.category_id = c.id
      ORDER BY b.month DESC, c.name
    `).all();
  }

  res.json(budgets);
});

// POST /budget - cria ou atualiza orçamento
router.post('/', (req, res) => {
  const { category_id, month, amount } = req.body;
  if (!category_id || !month || amount === undefined) {
    return res.status(400).json({ error: 'category_id, month e amount são obrigatórios' });
  }

  const existing = db.prepare('SELECT id FROM budgets WHERE category_id = ? AND month = ?').get(category_id, month);
  if (existing) {
    db.prepare('UPDATE budgets SET amount = ? WHERE id = ?').run(parseFloat(amount), existing.id);
    res.json({ id: existing.id, category_id, month, amount: parseFloat(amount) });
  } else {
    const id = uuidv4();
    db.prepare('INSERT INTO budgets (id, category_id, month, amount) VALUES (?, ?, ?, ?)').run(id, category_id, month, parseFloat(amount));
    res.status(201).json({ id, category_id, month, amount: parseFloat(amount) });
  }
});

// DELETE /budget/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM budgets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /budget/summary?month=YYYY-MM - orçado vs realizado
router.get('/summary', (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month é obrigatório (YYYY-MM)' });

  const budgets = db.prepare(`
    SELECT b.*, c.name as category_name
    FROM budgets b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.month = ?
  `).all(month);

  const [year, m] = month.split('-');
  const startDate = `${year}-${m}-01`;
  const endDate = `${year}-${m}-31`;

  const actuals = db.prepare(`
    SELECT category_id, subcategory_id, SUM(amount) as total
    FROM transactions
    WHERE date BETWEEN ? AND ? AND type = 'expense'
    GROUP BY category_id
  `).all(startDate, endDate);

  const actualsMap = {};
  actuals.forEach(a => { actualsMap[a.category_id] = a.total; });

  const result = budgets.map(b => ({
    ...b,
    actual: actualsMap[b.category_id] || 0,
    remaining: b.amount - (actualsMap[b.category_id] || 0),
    percentage: ((actualsMap[b.category_id] || 0) / b.amount) * 100,
  }));

  res.json(result);
});

module.exports = router;
