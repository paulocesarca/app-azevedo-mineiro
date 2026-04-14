# 💰 Azevedo Mineiro — Gestão Financeira Familiar

PWA de gestão financeira multi-usuário com sistema inteligente de crédito parcelado.

## 🚀 Como rodar

### Backend
```bash
cd backend && cp .env.example .env && npm install && npm run dev
# Roda na porta 3001
```

### Frontend
```bash
cd frontend && cp .env.example .env && npm install && npm run dev
# Roda na porta 5173
```

## 🌐 Acessar
- **App:** http://localhost:5173
- **API:** http://localhost:3001/health

## 👤 Primeiro acesso
1. Abra http://localhost:5173 → clique **Cadastrar**
2. Crie as duas contas (você e sua esposa)
3. Os dados são compartilhados entre todos os usuários

## 📦 Stack
| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| PWA | Service Worker + IndexedDB + Web Push |
| Gráficos | Recharts |
| Backend | Node.js + Express |
| Banco | SQLite (better-sqlite3) |
| Auth | JWT 30 dias |

## 💳 Cartões pré-configurados
| Cartão | Fechamento |
|--------|-----------|
| Sicredi | Dia 03 |
| Mercado Pago | Dia 09 |
| Banco Inter | Dia 09 |

## 🧮 Cálculo de parcelas
- Compra **após** o fechamento → 1ª parcela no mês seguinte
- Compra **antes** do fechamento → 1ª parcela no mesmo mês
