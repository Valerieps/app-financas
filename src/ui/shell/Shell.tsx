// The desktop window (docs/rascunhos/arquitetura-desktop.md, "Esqueleto da janela"): the sidebar
// with the Livre do dia, the header with where I am and the month, the module's tabs, the content,
// and the detail panel on the right, which closes with Esc.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { monthKey, shiftMonth, type Month } from '../../domain/month';
import { strings } from '../../domain/strings';
import { Link, navigate } from '../router';
import { Icon } from './Icon';
import { keyAction } from './keys';
import {
  FINANCAS_TABS,
  MODULES,
  SYSTEM_MODULES,
  modulePath,
  panelParentPath,
  showsMonth,
  tabPath,
  withMonth,
  type ModuleId,
  type Route,
} from './routes';

export function Shell({
  route,
  path,
  month,
  monthParam,
  children,
}: {
  route: Route;
  path: string;
  month: Month;
  /** The `mes` in the URL, carried by internal links; null when the URL has none. */
  monthParam: string | null;
  children: ReactNode;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const parent = panelParentPath(route);
  const closePanel = () => {
    if (parent) navigate(withMonth(parent, monthParam));
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = keyAction(event, { searchOpen, panelOpen: parent !== null });
      if (!action) return;
      event.preventDefault();
      if (action === 'open-search') setSearchOpen(true);
      else if (action === 'close-search') setSearchOpen(false);
      else if (parent) navigate(withMonth(parent, monthParam));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, parent, monthParam]);

  return (
    <div className={`shell${parent ? ' shell--panel' : ''}`}>
      <Sidebar route={route} monthParam={monthParam} />
      <div className="shell-main">
        <Header route={route} path={path} month={month} onSearch={() => setSearchOpen(true)} />
        {route.module === 'financas' && <FinancasTabs active={route.tab} monthParam={monthParam} />}
        <main className="shell-content">{children}</main>
      </div>
      {parent && <DetailPanel onClose={closePanel} />}
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

function Sidebar({ route, monthParam }: { route: Route; monthParam: string | null }) {
  const item = (module: ModuleId) => {
    const current = route.module === module;
    const label = strings.shell.modules[module];
    return (
      <Link
        key={module}
        to={module === 'financas' || module === 'inicio' ? withMonth(modulePath(module), monthParam) : modulePath(module)}
        className="sidebar-item"
        aria-current={current ? 'page' : undefined}
        title={label}
      >
        <Icon name={module} />
        <span className="sidebar-label">{label}</span>
      </Link>
    );
  };
  return (
    <aside className="sidebar" aria-label={strings.shell.mainNav}>
      <div className="sidebar-brand">
        <span className="brand-dot" aria-hidden="true" />
        <span className="sidebar-label">{strings.appName}</span>
      </div>
      <nav className="sidebar-nav">{MODULES.map(item)}</nav>
      <div className="grow" />
      <nav className="sidebar-nav sidebar-nav--system" aria-label={strings.shell.systemNav}>
        {SYSTEM_MODULES.map(item)}
      </nav>
      {/* The Livre do dia is not computed yet (phase 3); its place is kept. */}
      <Link to={withMonth('/financas', monthParam)} className="sidebar-livre" aria-label={strings.shell.livre.openOverview}>
        <span className="text-over">{strings.shell.livre.label}</span>
        <span className="text-strong sidebar-label">{strings.wip}</span>
      </Link>
    </aside>
  );
}

function Header({ route, path, month, onSearch }: { route: Route; path: string; month: Month; onSearch: () => void }) {
  const trail =
    route.module === 'not_found'
      ? []
      : route.module === 'financas'
        ? [strings.shell.modules.financas, strings.shell.tabs[route.tab]]
        : [strings.shell.modules[route.module]];
  const goToMonth = (delta: number) => navigate(withMonth(path, monthKey(shiftMonth(month, delta))));
  return (
    <header className="topbar">
      <nav aria-label={strings.shell.youAreHere} className="breadcrumb">
        {trail.map((step, i) =>
          i === trail.length - 1 ? (
            <span key={step} className="breadcrumb-current" aria-current="page">
              {step}
            </span>
          ) : (
            <span key={step} className="muted">
              {step}
              <span aria-hidden="true" className="breadcrumb-sep">
                ›
              </span>
            </span>
          ),
        )}
      </nav>
      <div className="grow" />
      {showsMonth(route) && (
        <div className="month-picker">
          <button type="button" className="icon-button" aria-label={strings.shell.month.previous} onClick={() => goToMonth(-1)}>
            <Icon name="previous" />
          </button>
          <span className="month-label">{strings.shell.month.label(month.year, month.month)}</span>
          <button type="button" className="icon-button" aria-label={strings.shell.month.next} onClick={() => goToMonth(1)}>
            <Icon name="next" />
          </button>
        </div>
      )}
      <button type="button" className="search-button" onClick={onSearch}>
        <Icon name="search" />
        <span className="grow">{strings.shell.search.open}</span>
        <kbd>{strings.shell.search.shortcut}</kbd>
      </button>
    </header>
  );
}

function FinancasTabs({ active, monthParam }: { active: string; monthParam: string | null }) {
  return (
    <nav className="tabbar" aria-label={strings.shell.financasTabs}>
      {FINANCAS_TABS.map((tab) => (
        <Link key={tab} to={withMonth(tabPath(tab), monthParam)} className="tabbar-tab" aria-current={tab === active ? 'page' : undefined}>
          {strings.shell.tabs[tab]}
        </Link>
      ))}
    </nav>
  );
}

function DetailPanel({ onClose }: { onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  return (
    <aside className="detail-panel" aria-label={strings.shell.panel.title}>
      <div className="tile-head">
        <h2 className="text-title">{strings.shell.panel.title}</h2>
        <button ref={close} type="button" className="icon-button" aria-label={strings.shell.panel.close} title={strings.shell.panel.close} onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <div className="wip wip--tall">
        <span className="chip">{strings.wip}</span>
        <p className="text-label muted">{strings.shell.panel.hint}</p>
      </div>
    </aside>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  return (
    <div className="scrim" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={strings.shell.search.title} className="search-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="tile-head">
          <h2 className="text-title">{strings.shell.search.title}</h2>
          <button ref={close} type="button" className="icon-button" aria-label={strings.shell.panel.close} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="wip">
          <span className="chip">{strings.wip}</span>
          <p className="text-label muted">{strings.shell.search.hint}</p>
        </div>
      </div>
    </div>
  );
}
