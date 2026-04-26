const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /investments — lista todos
router.get('/', (req, res) => {
  const investments = db.prepare(`
    SELECT * FROM investments ORDER BY created_at DESC
  `).all();

  const updates = db.prepare(`
    SELECT * FROM investment_updates ORDER BY date DESC
  `).all();

  const result = investments.map(inv => ({
    ...inv,
    updates: updates.filter(u => u.investment_id === inv.id),
  }));

  res.json(result);
});

// POST /investments — criar
router.post('/', (req, res) => {
  const { name, type, institution, invested_amount, current_value, date_invested, notes, color } = req.body;

  if (!name || !invested_amount || !date_invested) {
    return res.status(400).json({ error: 'Campos obrigatórios: name, invested_amount, date_invested' });
  }

  const id = uuidv4();
  const value = current_value ?? invested_amount;

  db.prepare(`
    INSERT INTO investments (id, name, type, institution, invested_amount, current_value, date_invested, notes, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, type || 'outro', institution || null, invested_amount, value, date_invested, notes || null, color || '#6366F1');

  // Registra update inicial
  db.prepare(`
    INSERT INTO investment_updates (id, investment_id, value, note, date)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), id, value, 'Valor inicial', date_invested);

  const investment = db.prepare('SELECT * FROM investments WHERE id = ?').get(id);
  res.status(201).json(investment);
});

// PUT /investments/:id — editar
router.put('/:id', (req, res) => {
  const { name, type, institution, invested_amount, current_value, date_invested, notes, color } = req.body;

  const inv = db.prepare('SELECT * FROM investments WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Investimento não encontrado' });

  db.prepare(`
    UPDATE investments
    SET name = ?, type = ?, institution = ?, invested_amount = ?, current_value = ?,
        date_invested = ?, notes = ?, color = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ?? inv.name,
    type ?? inv.type,
    institution ?? inv.institution,
    invested_amount ?? inv.invested_amount,
    current_value ?? inv.current_value,
    date_invested ?? inv.date_invested,
    notes ?? inv.notes,
    color ?? inv.color,
    req.params.id,
  );

  res.json(db.prepare('SELECT * FROM investments WHERE id = ?').get(req.params.id));
});

// PATCH /investments/:id/update-value — atualizar rendimento
router.patch('/:id/update-value', (req, res) => {
  const { value, note, date } = req.body;

  if (value == null) return res.status(400).json({ error: 'value é obrigatório' });

  const inv = db.prepare('SELECT * FROM investments WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Investimento não encontrado' });

  // Atualiza valor atual
  db.prepare(`
    UPDATE investments SET current_value = ?, updated_at = datetime('now') WHERE id = ?
  `).run(value, req.params.id);

  // Registra no histórico
  const updateId = uuidv4();
  db.prepare(`
    INSERT INTO investment_updates (id, investment_id, value, note, date)
    VALUES (?, ?, ?, ?, ?)
  `).run(updateId, req.params.id, value, note || null, date || new Date().toISOString().slice(0, 10));

  res.json(db.prepare('SELECT * FROM investments WHERE id = ?').get(req.params.id));
});

// DELETE /investments/:id
router.delete('/:id', (req, res) => {
  const inv = db.prepare('SELECT * FROM investments WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Investimento não encontrado' });

  db.prepare('DELETE FROM investment_updates WHERE investment_id = ?').run(req.params.id);
  db.prepare('DELETE FROM investments WHERE id = ?').run(req.params.id);

  res.json({ success: true });
});

module.exports = router;
