import { useEffect, useState, type FormEvent } from 'react';
import type { PasskeyView } from '../../application/api-contract';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { useQuery } from '../use-query';

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

// The "Aparelhos" section of the Cofre screen (docs/spec/acesso.md): register, list and delete passkeys.
export function Aparelhos({ onChanged }: { onChanged: () => void }) {
  const { backend, deviceLock } = useServices();
  const passkeys = useQuery('passkeys', {}, ['passkeys']);
  const [supported, setSupported] = useState(false);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void deviceLock.supported().then(setSupported);
  }, [deviceLock]);

  const list = passkeys.data ?? [];
  const thisDeviceHasOne = list.some((passkey) => passkey.thisDevice);

  async function registerHere(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await deviceLock.register(label.trim() || strings.aparelhos.labelPlaceholder);
    setBusy(false);
    if (!result.ok) {
      setError(result.error === 'cancelled' ? strings.lock.cancelled : strings.genericError);
      return;
    }
    setLabel('');
    passkeys.reload();
    onChanged();
  }

  async function remove(passkey: PasskeyView) {
    if (!window.confirm(strings.aparelhos.confirmRemove(passkey.label))) return;
    const result = await backend.command('passkey.delete', { id: passkey.id });
    if (!result.ok) setError(strings.genericError);
    onChanged();
  }

  return (
    <section className="tile">
      <header>
        <h2 className="text-title">{strings.aparelhos.title}</h2>
        <p className="muted">{strings.aparelhos.subtitle}</p>
      </header>

      {list.length === 0 && !passkeys.loading && <p className="muted">{strings.aparelhos.empty}</p>}
      {list.map((passkey) => (
        <div key={passkey.id} className="row space-between align-center">
          <div>
            <strong>{passkey.label}</strong>
            {passkey.thisDevice && <span className="badge">{strings.aparelhos.thisDevice}</span>}
            <br />
            <small className="muted">
              {strings.aparelhos.createdAt(dateTime(passkey.createdAt))}
              {passkey.lastUsedAt && ` · ${strings.aparelhos.lastUsedAt(dateTime(passkey.lastUsedAt))}`}
            </small>
          </div>
          <button type="button" className="secondary danger" onClick={() => void remove(passkey)}>
            {strings.aparelhos.remove}
          </button>
        </div>
      ))}

      {!thisDeviceHasOne &&
        (supported ? (
          <form className="stack" onSubmit={(event) => void registerHere(event)}>
            <label>
              <span className="muted">{strings.aparelhos.labelField}</span>
              <input value={label} maxLength={60} placeholder={strings.aparelhos.labelPlaceholder} onChange={(e) => setLabel(e.target.value)} />
            </label>
            <button type="submit" disabled={busy}>
              {strings.aparelhos.register}
            </button>
          </form>
        ) : (
          <p className="muted">{strings.aparelhos.unsupported}</p>
        ))}

      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
