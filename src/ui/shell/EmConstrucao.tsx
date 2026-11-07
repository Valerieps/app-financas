// A block the code does not fill yet: it keeps its title and place on the screen and says what it
// will show, so the layout is final before the data exists.
import type { ReactNode } from 'react';
import { strings } from '../../domain/strings';

export function EmConstrucao({
  title,
  hint,
  action,
  tall = false,
  className = '',
}: {
  title: string;
  hint: string;
  action?: ReactNode;
  tall?: boolean;
  className?: string;
}) {
  return (
    <section className={`tile ${className}`} aria-label={title}>
      <div className="tile-head">
        <h2 className="text-strong">{title}</h2>
        {action}
      </div>
      <div className={`wip${tall ? ' wip--tall' : ''}`}>
        <span className="chip">{strings.wip}</span>
        <p className="text-label muted">{hint}</p>
      </div>
    </section>
  );
}
