import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';
import { api } from '../lib/api';
import { Bell, LogOut, RefreshCw, Wifi, WifiOff, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

export default function Settings() {
  const { user, logout } = useAuth();
  const { online, pendingCount, lastSync, syncNow } = useSync();
  const [notifStatus, setNotifStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [syncing, setSyncing] = useState(false);

  const handleEnableNotifications = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      alert('Notificações não suportadas neste dispositivo');
      return;
    }
    setNotifStatus('requesting');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setNotifStatus('denied'); return; }

      const reg = await navigator.serviceWorker.ready;
      const vapidKey = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/vapid-public-key`).then(r => r.json());

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey.publicKey),
      });

      await api.notifications.subscribe(sub);
      setNotifStatus('granted');
    } catch (e) {
      setNotifStatus('denied');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    await syncNow();
    setSyncing(false);
  };

  return (
    <div className="px-4 pt-3 space-y-4 max-w-lg mx-auto">
      <h1 className="text-lg font-bold text-slate-100">Configurações</h1>

      {/* Perfil */}
      <div className="card flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-slate-200">{user?.name}</p>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </div>
      </div>

      {/* Sincronização */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Sincronização</h2>
          <div className="flex items-center gap-1.5">
            {online
              ? <Wifi className="w-4 h-4 text-green-400" />
              : <WifiOff className="w-4 h-4 text-yellow-400" />}
            <span className={clsx('text-xs', online ? 'text-green-400' : 'text-yellow-400')}>
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {pendingCount > 0 && (
          <div className="flex items-center justify-between bg-indigo-900/30 rounded-xl px-3 py-2">
            <p className="text-xs text-indigo-300">{pendingCount} item(s) aguardando sincronização</p>
            <button onClick={handleSync} disabled={syncing || !online} className="btn-primary text-xs py-1.5 px-3">
              <RefreshCw className={clsx('w-3 h-3 inline mr-1', syncing && 'animate-spin')} />
              Sincronizar
            </button>
          </div>
        )}

        {lastSync && (
          <p className="text-xs text-slate-600 flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            Última sincronização: {lastSync}
          </p>
        )}

        {pendingCount === 0 && (
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            Todos os dados sincronizados
          </p>
        )}
      </div>

      {/* Notificações */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Notificações Push</h2>
        <p className="text-xs text-slate-500">
          Receba alertas quando um membro da família registrar gastos e avisos de fechamento de cartão.
        </p>

        {notifStatus === 'granted' ? (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle className="w-4 h-4" />
            Notificações ativadas!
          </div>
        ) : notifStatus === 'denied' ? (
          <p className="text-xs text-red-400">Permissão negada. Habilite nas configurações do navegador.</p>
        ) : (
          <button
            onClick={handleEnableNotifications}
            disabled={notifStatus === 'requesting'}
            className="btn-primary flex items-center gap-2"
          >
            <Bell className="w-4 h-4" />
            {notifStatus === 'requesting' ? 'Aguardando permissão…' : 'Ativar notificações'}
          </button>
        )}
      </div>

      {/* Logout */}
      <button onClick={logout} className="btn-danger w-full flex items-center justify-center gap-2">
        <LogOut className="w-4 h-4" />
        Sair da conta
      </button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
