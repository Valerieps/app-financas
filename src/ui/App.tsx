import { useCallback, useEffect, useState } from 'react';
import type { LockStatusView } from '../application/api-contract';
import { strings } from '../domain/strings';
import { useServices } from './backend-context';
import { Cofre } from './screens/Cofre';
import { Locked } from './screens/Locked';

// Cloudflare Access signs the owner in before the app loads (ADR-007), so there is no login
// screen; a device with a passkey shows the lock until the fingerprint opens it.
export function App() {
  const { backend, deviceLock } = useServices();
  const [status, setStatus] = useState<LockStatusView | null>(null);

  const check = useCallback(() => {
    void deviceLock.status().then((result) => setStatus(result.ok ? result.value : { deviceHasPasskey: false, locked: false }));
  }, [deviceLock]);

  useEffect(check, [check]);
  useEffect(() => backend.onLocked(() => setStatus({ deviceHasPasskey: true, locked: true })), [backend]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [check]);

  if (!status) return null;
  if (status.locked) return <Locked onUnlocked={check} />;

  async function lockNow() {
    await deviceLock.lock();
    check();
  }

  return (
    <div className="app">
      <header className="app-header row space-between align-center">
        <strong>{strings.appName}</strong>
        {status.deviceHasPasskey && (
          <button type="button" className="secondary" onClick={() => void lockNow()}>
            {strings.lock.lockNow}
          </button>
        )}
      </header>
      <main>
        <Cofre onPasskeysChanged={check} />
      </main>
    </div>
  );
}
