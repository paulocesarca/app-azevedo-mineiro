import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getSyncQueueCount, getSyncQueue, clearSyncQueueItem } from '../lib/db';
import { api } from '../lib/api';

interface SyncContextType {
  online: boolean;
  pendingCount: number;
  lastSync: string | null;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType>({
  online: navigator.onLine,
  pendingCount: 0,
  lastSync: null,
  syncNow: async () => {},
});

export function SyncProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(
    localStorage.getItem('last_sync')
  );

  const updatePendingCount = useCallback(async () => {
    const count = await getSyncQueueCount();
    setPendingCount(count);
  }, []);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const queue = await getSyncQueue();
      if (queue.length === 0) return;

      await api.sync.push(queue);

      // Limpa itens sincronizados
      await Promise.all(queue.map(item => clearSyncQueueItem(item.id)));
      await updatePendingCount();

      const now = new Date().toLocaleTimeString('pt-BR');
      setLastSync(now);
      localStorage.setItem('last_sync', now);
    } catch (e) {
      console.warn('Sync falhou:', e);
    }
  }, [updatePendingCount]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      syncNow();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [syncNow, updatePendingCount]);

  return (
    <SyncContext.Provider value={{ online, pendingCount, lastSync, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  return useContext(SyncContext);
}
