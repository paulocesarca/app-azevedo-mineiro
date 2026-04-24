const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro de rede' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// Auth
export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: { id: string; name: string; email: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (name: string, email: string, password: string) =>
      request<{ token: string; user: { id: string; name: string; email: string } }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      }),
    me: () => request<{ id: string; name: string; email: string }>('/auth/me'),
    users: () => request<{ id: string; name: string; email: string }[]>('/auth/users'),
  },

  transactions: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<import('../types').Transaction[]>(`/transactions${qs}`);
    },
    pending: () =>
      request<import('../types').Transaction[]>('/transactions/pending'),
    create: (data: Record<string, unknown>) =>
      request<{ parent_id: string; transactions: { id: string; date: string; installment_number: number }[] }>(
        '/transactions',
        { method: 'POST', body: JSON.stringify(data) }
      ),
    update: (id: string, data: Record<string, unknown>) =>
      request<import('../types').Transaction>(`/transactions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    markPaid: (id: string) =>
      request<import('../types').Transaction>(`/transactions/${id}/pay`, { method: 'PATCH' }),
    markUnpaid: (id: string) =>
      request<import('../types').Transaction>(`/transactions/${id}/unpay`, { method: 'PATCH' }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/transactions/${id}`, { method: 'DELETE' }),
    deleteGroup: (parentId: string) =>
      request<{ success: boolean }>(`/transactions/group/${parentId}`, { method: 'DELETE' }),
    installmentsByCard: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<import('../types').Transaction[]>(`/transactions/installments/by-card${qs}`);
    },
  },

  categories: {
    list: () => request<import('../types').Category[]>('/categories'),
    create: (data: { name: string; parent_id?: string }) =>
      request<import('../types').Category>('/categories', { method: 'POST', body: JSON.stringify(data) }),
    cards: () => request<import('../types').Card[]>('/categories/cards'),
    createCard: (data: { name: string; closing_day: number; color?: string }) =>
      request<import('../types').Card>('/categories/cards', { method: 'POST', body: JSON.stringify(data) }),
  },

  budget: {
    list: (month?: string) => {
      const qs = month ? `?month=${month}` : '';
      return request<import('../types').Budget[]>(`/budget${qs}`);
    },
    summary: (month: string) =>
      request<import('../types').Budget[]>(`/budget/summary?month=${month}`),
    upsert: (data: { category_id: string; month: string; amount: number }) =>
      request<import('../types').Budget>('/budget', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/budget/${id}`, { method: 'DELETE' }),
  },

  notifications: {
    subscribe: (subscription: PushSubscription) =>
      request('/notifications/subscribe', {
        method: 'POST',
        body: JSON.stringify({ subscription }),
      }),
    sendClosingReminder: () =>
      request('/notifications/closing-reminder', { method: 'POST' }),
  },

  investments: {
    list: () => request<import('../types').Investment[]>('/investments'),
    create: (data: Record<string, unknown>) =>
      request<import('../types').Investment>('/investments', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<import('../types').Investment>(`/investments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateValue: (id: string, value: number, note?: string, date?: string) =>
      request<import('../types').Investment>(`/investments/${id}/update-value`, {
        method: 'PATCH',
        body: JSON.stringify({ value, note, date }),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/investments/${id}`, { method: 'DELETE' }),
  },

  sync: {
    status: () => request<{ online: boolean; server_time: string }>('/sync/status'),
    push: (operations: unknown[]) =>
      request('/sync', { method: 'POST', body: JSON.stringify({ operations }) }),
  },
};
