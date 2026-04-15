require('dotenv').config();
const express = require('express');
const cors = require('cors');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3001;

// Configurar VAPID keys para push notifications
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls';

webpush.setVapidDetails(
  'mailto:admin@azevedomineiro.app',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:5173', 'http://frontend'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Rotas
app.use('/auth', require('./routes/auth'));
app.use('/transactions', require('./routes/transactions'));
app.use('/categories', require('./routes/categories'));
app.use('/budget', require('./routes/budget'));
app.use('/notifications', require('./routes/notifications'));
app.use('/sync', require('./routes/sync'));

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Expõe VAPID public key
app.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.listen(PORT, () => {
  console.log(`✅ Backend rodando em http://localhost:${PORT}`);
});
