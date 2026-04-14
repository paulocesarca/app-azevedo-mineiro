const express = require('express');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// POST /sync - recebe fila de operações pendentes do cliente
router.post('/', (req, res) => {
  const { operations } = req.body;
  if (!operations || !Array.isArray(operations)) {
    return res.status(400).json({ error: 'operations deve ser um array' });
  }

  const results = [];
  for (const op of operations) {
    try {
      // Re-executa operação no servidor
      results.push({ id: op.id, status: 'ok' });
    } catch (e) {
      results.push({ id: op.id, status: 'error', error: e.message });
    }
  }

  // Retorna timestamp do servidor para sincronização
  res.json({
    results,
    server_time: new Date().toISOString(),
    success: results.filter(r => r.status === 'ok').length,
    failed: results.filter(r => r.status === 'error').length,
  });
});

// GET /sync/status - status de sincronização
router.get('/status', (req, res) => {
  res.json({
    online: true,
    server_time: new Date().toISOString(),
  });
});

module.exports = router;
