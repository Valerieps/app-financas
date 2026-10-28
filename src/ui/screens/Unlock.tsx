import { useState, type FormEvent } from 'react';
import { isValidPin, normalizePin } from '../../domain/pin';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';

export function Unlock({ configured, onUnlocked }: { configured: boolean; onUnlocked: () => void }) {
  const { backend } = useServices();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const cleanPin = normalizePin(pin);
    if (!isValidPin(cleanPin)) {
      setError(strings.auth.invalidPin);
      return;
    }

    if (!configured && cleanPin !== normalizePin(confirmPin)) {
      setError('Os PINs digitados não conferem.');
      return;
    }

    setLoading(true);
    try {
      const result = configured ? await backend.unlock(cleanPin) : await backend.setupPin(cleanPin);
      if (result.ok) {
        onUnlocked();
      } else {
        setError(configured ? strings.auth.wrongPin : strings.genericError);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app unlock-screen">
      <div className="card">
        <h1>{strings.appName}</h1>
        <p className="muted">{strings.auth.tagline}</p>

        <h2>{configured ? strings.auth.unlockTitle : strings.auth.setupTitle}</h2>
        <p className="muted">{configured ? strings.auth.unlockSubtitle : strings.auth.setupSubtitle}</p>

        <form onSubmit={handleSubmit} className="stack">
          <label>
            <span className="muted">{strings.auth.pinLabel}</span>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              required
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              disabled={loading}
            />
          </label>

          {!configured && (
            <label>
              <span className="muted">Confirme o PIN</span>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                required
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="••••"
                disabled={loading}
              />
            </label>
          )}

          <button type="submit" disabled={loading || pin.length < 4}>
            {loading ? 'Aguarde...' : configured ? strings.auth.submitUnlock : strings.auth.submitSetup}
          </button>
        </form>

        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
