const express = require('express');
const webpush = require('web-push');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// POST /notifications/subscribe - salva subscription do usuário
router.post('/subscribe', (req, res) => {
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'subscription é obrigatório' });

  db.prepare('UPDATE users SET push_subscription = ? WHERE id = ?').run(
    JSON.stringify(subscription),
    req.user.id
  );
  res.json({ success: true });
});

// POST /notifications/send - envia notificação manual
router.post('/send', (req, res) => {
  const { user_ids, title, body } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title e body são obrigatórios' });

  let users;
  if (user_ids && user_ids.length > 0) {
    users = db.prepare(`SELECT push_subscription FROM users WHERE id IN (${user_ids.map(() => '?').join(',')}) AND push_subscription IS NOT NULL`).all(...user_ids);
  } else {
    users = db.prepare('SELECT push_subscription FROM users WHERE push_subscription IS NOT NULL').all();
  }

  const results = [];
  users.forEach(u => {
    try {
      const sub = JSON.parse(u.push_subscription);
      webpush.sendNotification(sub, JSON.stringify({ title, body }));
      results.push('sent');
    } catch (e) {
      results.push('failed');
    }
  });

  res.json({ sent: results.filter(r => r === 'sent').length, failed: results.filter(r => r === 'failed').length });
});

// POST /notifications/closing-reminder - envia lembretes de fechamento
router.post('/closing-reminder', (req, res) => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tomorrowDay = tomorrow.getDate();
  const cards = db.prepare('SELECT * FROM cards WHERE closing_day = ?').all(tomorrowDay);

  cards.forEach(card => {
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const totals = db.prepare(`
      SELECT user_id, SUM(amount) as total, COUNT(*) as count
      FROM transactions
      WHERE card_id = ? AND date BETWEEN ? AND ?
      GROUP BY user_id
    `).all(card.id, startDate, endDate);

    const users = db.prepare('SELECT * FROM users WHERE push_subscription IS NOT NULL').all();
    users.forEach(user => {
      const userTotal = totals.find(t => t.user_id === user.id);
      const msg = userTotal
        ? `${card.name}: você gastou R$ ${userTotal.total.toFixed(2)} este mês (${userTotal.count} transações). Fechamento amanhã!`
        : `${card.name}: sem gastos registrados este mês. Fechamento amanhã!`;

      try {
        const sub = JSON.parse(user.push_subscription);
        webpush.sendNotification(sub, JSON.stringify({
          title: `🔔 Fechamento ${card.name} amanhã`,
          body: msg,
        })).catch(() => {});
      } catch (e) {}
    });
  });

  res.json({ success: true, cards_processed: cards.length });
});

module.exports = router;
