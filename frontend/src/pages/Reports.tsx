import { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';
import { api } from '../lib/api';
import { formatCurrency, currentMonth, monthName, lastNMonths } from '../lib/installments';
import MonthSelector from '../components/MonthSelector';
import type { Transaction } from '../types';
import clsx from 'clsx';

const COLORS = ['#6366f1', '#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6'];

const RADIAN = Math.PI / 180;
function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number;
}) {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs">
      <p className="text-slate-300">{payload[0].name}</p>
      <p className="font-bold text-slate-100">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

export default function Reports() {
  const [month, setMonth] = useState(currentMonth());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ month: string; income: number; expense: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pie' | 'bar' | 'line' | 'cards'>('pie');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [year, m] = month.split('-');
      const txs = await api.transactions.list({ year, month: m });
      setTransactions(txs);

      // Dados dos últimos 6 meses para o gráfico de linha
      const months = lastNMonths(6);
      const monthlyPromises = months.map(async (mo) => {
        const [y, mm] = mo.split('-');
        const data = await api.transactions.list({ year: y, month: mm });
        return {
          month: monthName(mo).split(' de ')[0],
          income: data.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0),
          expense: data.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0),
        };
      });
      const monthly = await Promise.all(monthlyPromises);
      setMonthlyData(monthly);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  // Dados para gráfico de pizza (despesas por categoria)
  const expenseByCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce<Record<string, number>>((acc, t) => {
      const key = t.category_name || 'Sem categoria';
      acc[key] = (acc[key] || 0) + t.amount;
      return acc;
    }, {});

  const pieData = Object.entries(expenseByCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Dados para barras por cartão
  const installmentsByCard = transactions
    .filter(t => t.payment_method === 'credit')
    .reduce<Record<string, number>>((acc, t) => {
      const key = t.card_name || 'Desconhecido';
      acc[key] = (acc[key] || 0) + t.amount;
      return acc;
    }, {});

  const cardData = Object.entries(installmentsByCard).map(([name, value]) => ({ name, value }));

  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);

  const TABS = [
    { id: 'pie', label: 'Por categoria' },
    { id: 'bar', label: 'Receita/Despesa' },
    { id: 'line', label: 'Histórico' },
    { id: 'cards', label: 'Por cartão' },
  ] as const;

  return (
    <div className="px-4 pt-3 space-y-4 max-w-lg mx-auto">
      <h1 className="text-lg font-bold text-slate-100">Relatórios</h1>

      {/* Seletor de mês */}
      <MonthSelector value={month} onChange={setMonth} />

      {/* Totais do mês */}
      <div className="flex gap-3">
        <div className="card flex-1 text-center py-3">
          <p className="text-xs text-slate-500">Receitas</p>
          <p className="text-sm font-bold text-green-400">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="card flex-1 text-center py-3">
          <p className="text-xs text-slate-500">Despesas</p>
          <p className="text-sm font-bold text-red-400">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="card flex-1 text-center py-3">
          <p className="text-xs text-slate-500">Saldo</p>
          <p className={clsx('text-sm font-bold', totalIncome - totalExpense >= 0 ? 'text-green-400' : 'text-red-400')}>
            {formatCurrency(totalIncome - totalExpense)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-800 rounded-xl p-1 gap-1 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex-shrink-0 flex-1 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap px-2',
              activeTab === tab.id ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-64 bg-slate-800 rounded-2xl animate-pulse" />
      ) : (
        <div className="card">
          {/* Gráfico de Pizza - Despesas por categoria */}
          {activeTab === 'pie' && (
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-4">Despesas por categoria</h3>
              {pieData.length === 0 ? (
                <p className="text-center text-slate-500 text-sm py-8">Sem despesas no período</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        labelLine={false}
                        label={CustomLabel as unknown as boolean}
                      >
                        {pieData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="mt-3 space-y-2">
                    {pieData.map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-xs text-slate-400">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-medium text-slate-200">{formatCurrency(item.value)}</span>
                          <span className="text-xs text-slate-600 ml-2">{totalExpense > 0 ? ((item.value / totalExpense) * 100).toFixed(0) : 0}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Barras - Receita vs Despesa mensal */}
          {activeTab === 'bar' && (
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-4">Receita vs Despesa (últimos 6 meses)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ left: -10 }}>
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="income" name="Receita" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Linha - Comparação mês a mês */}
          {activeTab === 'line' && (
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-4">Evolução mensal</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlyData} margin={{ left: -10 }}>
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="income" name="Receita" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 4 }} />
                  <Line type="monotone" dataKey="expense" name="Despesa" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} />
                  <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Barras por cartão */}
          {activeTab === 'cards' && (
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-4">Crédito por cartão</h3>
              {cardData.length === 0 ? (
                <p className="text-center text-slate-500 text-sm py-8">Sem gastos de crédito no período</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={cardData} layout="vertical" margin={{ left: 10 }}>
                      <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v.toFixed(0)}`} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-3 space-y-2">
                    {cardData.map(item => (
                      <div key={item.name} className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">{item.name}</span>
                        <span className="text-xs font-bold text-blue-400">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
