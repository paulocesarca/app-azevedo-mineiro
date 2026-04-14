const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /categories - retorna árvore de categorias
router.get('/', (req, res) => {
  const all = db.prepare('SELECT * FROM categories ORDER BY name').all();
  const parents = all.filter(c => !c.parent_id);
  const result = parents.map(p => ({
    ...p,
    children: all.filter(c => c.parent_id === p.id),
  }));
  res.json(result);
});

// POST /categories
router.post('/', (req, res) => {
  const { name, parent_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
  const id = uuidv4();
  db.prepare('INSERT INTO categories (id, name, parent_id) VALUES (?, ?, ?)').run(id, name, parent_id || null);
  res.status(201).json({ id, name, parent_id: parent_id || null });
});

// GET /categories/cards
router.get('/cards', (req, res) => {
  const cards = db.prepare('SELECT * FROM cards ORDER BY name').all();
  res.json(cards);
});

// POST /categories/cards
router.post('/cards', (req, res) => {
  const { name, closing_day, color } = req.body;
  if (!name || !closing_day) return res.status(400).json({ error: 'Nome e dia de fechamento são obrigatórios' });
  const id = uuidv4();
  db.prepare('INSERT INTO cards (id, name, closing_day, color) VALUES (?, ?, ?, ?)').run(id, name, parseInt(closing_day), color || '#3B82F6');
  res.status(201).json({ id, name, closing_day: parseInt(closing_day), color: color || '#3B82F6' });
});

module.exports = router;
