import { useState, type FormEvent } from 'react';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { useQuery } from '../use-query';

export function Home() {
  const { backend } = useServices();
  const itemsQuery = useQuery('items', {}, ['items']);
  const statusQuery = useQuery('status', {}, ['status', 'items']);

  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAddItem(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await backend.command('item.create', { title: title.trim() });
      if (result.ok) {
        setTitle('');
      } else {
        setError(strings.genericError);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteItem(id: string) {
    const result = await backend.command('item.delete', { id });
    if (!result.ok) {
      setError(strings.genericError);
    }
  }

  const items = itemsQuery.data ?? [];

  return (
    <section className="stack">
      <header>
        <h1>{strings.home.title}</h1>
        <p className="muted">{strings.home.subtitle}</p>
        {statusQuery.data && (
          <p className="badge">
            {statusQuery.data.itemCount} {statusQuery.data.itemCount === 1 ? 'item' : 'itens'} cadastrados
          </p>
        )}
      </header>

      <form className="row" onSubmit={handleAddItem}>
        <label className="grow">
          <input
            required
            placeholder={strings.home.itemPlaceholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSubmitting}
          />
        </label>
        <button type="submit" disabled={isSubmitting || !title.trim()}>
          {strings.home.add}
        </button>
      </form>

      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}

      <div className="card">
        {items.length === 0 ? (
          <p className="muted">{strings.home.empty}</p>
        ) : (
          <ul className="item-list">
            {items.map((item) => (
              <li key={item.id} className="row space-between">
                <div>
                  <strong>{item.title}</strong>
                  <br />
                  <small className="muted">{new Date(item.createdAt).toLocaleString()}</small>
                </div>
                <button
                  type="button"
                  className="secondary danger"
                  onClick={() => void handleDeleteItem(item.id)}
                >
                  {strings.home.delete}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card webhook-box">
        <h3>{strings.home.webhookCard}</h3>
        <p className="muted">{strings.home.webhookDesc}</p>
        <pre>
          <code>{`curl -X POST /api/webhook \\
  -H "Authorization: Bearer <SEU_WEBHOOK_SECRET>" \\
  -H "Content-Type: application/json" \\
  -d '{"topic":"item.create","data":{"title":"Nova nota"}}'`}</code>
        </pre>
      </div>
    </section>
  );
}
