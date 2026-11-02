import { useState } from 'react';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';

export function Locked({ onUnlocked }: { onUnlocked: () => void }) {
  const { deviceLock } = useServices();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unlock() {
    setBusy(true);
    setError(null);
    const result = await deviceLock.unlock();
    setBusy(false);
    if (result.ok) onUnlocked();
    else setError(result.error === 'cancelled' ? strings.lock.cancelled : strings.genericError);
  }

  return (
    <main className="app unlock-screen">
      <div className="card stack">
        <h1>{strings.lock.title}</h1>
        <p className="muted">{strings.lock.subtitle}</p>
        <button type="button" onClick={() => void unlock()} disabled={busy} autoFocus>
          {strings.lock.unlock}
        </button>
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
