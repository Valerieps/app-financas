import { useEffect, useState } from 'react';
import type { AuthStatusView } from '../application/api-contract';
import { strings } from '../domain/strings';
import { useLiveStatus, useServices } from './backend-context';
import { Home } from './screens/Home';
import { Unlock } from './screens/Unlock';

export function App() {
  const { backend, live } = useServices();
  const [authStatus, setAuthStatus] = useState<AuthStatusView | null>(null);
  const [loading, setLoading] = useState(true);

  async function checkAuth() {
    setLoading(true);
    try {
      const result = await backend.authStatus();
      if (result.ok) {
        setAuthStatus(result.value);
      } else {
        setAuthStatus({ configured: false, authenticated: false });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void checkAuth();
  }, []);

  const authenticated = authStatus?.authenticated ?? false;

  useEffect(() => {
    if (!authenticated) return;
    live.start();
    return () => live.stop();
  }, [live, authenticated]);

  if (loading && !authStatus) {
    return null;
  }

  if (!authenticated) {
    return (
      <Unlock
        configured={authStatus?.configured ?? false}
        onUnlocked={() => void checkAuth()}
      />
    );
  }

  async function handleLock() {
    await backend.lock();
    await checkAuth();
  }

  return (
    <div className="app">
      <header className="app-header row space-between">
        <div className="row align-center">
          <strong>{strings.appName}</strong>
          <LiveIndicator />
        </div>
        <button type="button" className="secondary" onClick={() => void handleLock()}>
          {strings.auth.lock}
        </button>
      </header>
      <OfflineNotice />
      <main>
        <Home />
      </main>
    </div>
  );
}

function LiveIndicator() {
  const status = useLiveStatus();
  return (
    <span
      className={`status-dot ${status}`}
      title={status === 'online' ? strings.nav.liveConnected : strings.nav.liveDisconnected}
    />
  );
}

function OfflineNotice() {
  const status = useLiveStatus();
  if (status !== 'offline') return null;
  return (
    <aside className="offline-banner" role="status">
      {strings.offline}
    </aside>
  );
}
