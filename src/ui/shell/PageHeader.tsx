// The header of a screen outside a module (Regras, Categorias, Cofre): the same title size and
// place on every screen, and one line on what the screen is for.
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="page-header">
      <h1 className="text-title">{title}</h1>
      {subtitle && <p className="muted">{subtitle}</p>}
    </header>
  );
}
