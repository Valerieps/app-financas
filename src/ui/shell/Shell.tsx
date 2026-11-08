// The desktop window (docs/rascunhos/arquitetura-desktop.md, "Esqueleto da janela"): the sidebar
// with the Livre do dia, the header with where I am and the month, the module's tabs, the content,
// and the detail panel on the right, which closes with Esc.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { monthKey, shiftMonth, type Month } from '../../domain/month';
import { strings } from '../../domain/strings';
import { Link, navigate } from '../router';
import { Icon } from './Icon';
import { keyAction } from './keys';
import {
  clampSidebarWidth,
  loadSidebarState,
  saveSidebarState,
  SIDEBAR_DEFAULT,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  SIDEBAR_STEP,
  type SidebarState,
} from './sidebarState';
import {
  FINANCAS_TABS,
  MODULES,
  SYSTEM_MODULES,
  modulePath,
  panelParentPath,
  showsMonth,
  tabPath,
  withMonth,
  withQuery,
  type ModuleId,
  type Route,
} from './routes';

export function Shell({
  route,
  path,
  month,
  monthParam,
  search,
  panel,
  children,
}: {
  route: Route;
  path: string;
  month: Month;
  /** The `mes` in the URL, carried by internal links; null when the URL has none. */
  monthParam: string | null;
  /** The URL's query: the month and the list's filters, kept when the month or the panel changes. */
  search: URLSearchParams;
  /** What the detail panel shows; without it, the panel says it is under construction. */
  panel?: ReactNode;
  children: ReactNode;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const parent = panelParentPath(route);
  const query = search.toString();
  const closePanel = () => {
    if (parent) navigate(withQuery(parent, new URLSearchParams(query)));
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = keyAction(event, { searchOpen, panelOpen: parent !== null });
      if (!action) return;
      event.preventDefault();
      if (action === 'open-search') setSearchOpen(true);
      else if (action === 'close-search') setSearchOpen(false);
      else if (parent) navigate(withQuery(parent, new URLSearchParams(query)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, parent, query]);

  const [sidebar, setSidebar] = useState(loadSidebarState);
  const update = (next: SidebarState) => {
    setSidebar(next);
    saveSidebarState(next);
  };
  const narrow = useNarrow();
  const collapsed = narrow || sidebar.collapsed;
  const style = collapsed ? undefined : ({ '--sidebar-width': `${sidebar.width}px` } as CSSProperties);

  return (
    <div className={`shell${parent ? ' shell--panel' : ''}${collapsed ? ' shell--collapsed' : ''}`} style={style}>
      <Sidebar
        route={route}
        monthParam={monthParam}
        collapsed={collapsed}
        canToggle={!narrow}
        width={sidebar.width}
        onToggle={() => update({ ...sidebar, collapsed: !sidebar.collapsed })}
        onResize={(width) => update({ collapsed: false, width: clampSidebarWidth(width) })}
      />
      <div className="shell-main">
        <Header route={route} path={path} search={search} month={month} onSearch={() => setSearchOpen(true)} />
        {route.module === 'financas' && <FinancasTabs active={route.tab} monthParam={monthParam} />}
        <main className="shell-content">{children}</main>
      </div>
      {parent && <DetailPanel onClose={closePanel}>{panel}</DetailPanel>}
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

/** Below 1024px the sidebar is always icons only (the same width as the CSS media query). */
function useNarrow(): boolean {
  const query = '(max-width: 1023px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setNarrow(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

function ResizeHandle({ width, onResize }: { width: number; onResize: (width: number) => void }) {
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const left = handle.parentElement?.getBoundingClientRect().left ?? 0;
    const move = (e: PointerEvent) => onResize(e.clientX - left);
    const stop = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
      handle.removeEventListener('pointercancel', stop);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') onResize(width - SIDEBAR_STEP);
    else if (event.key === 'ArrowRight') onResize(width + SIDEBAR_STEP);
    else return;
    event.preventDefault();
  };
  return (
    <div
      className="sidebar-resize"
      role="separator"
      aria-orientation="vertical"
      aria-label={strings.shell.sidebar.resize}
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onResize(SIDEBAR_DEFAULT)}
    />
  );
}

function Sidebar({
  route,
  monthParam,
  collapsed,
  canToggle,
  width,
  onToggle,
  onResize,
}: {
  route: Route;
  monthParam: string | null;
  collapsed: boolean;
  canToggle: boolean;
  width: number;
  onToggle: () => void;
  onResize: (width: number) => void;
}) {
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
        <span className="brand-lights" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="sidebar-label">{strings.appName}</span>
        {canToggle && (
          <button
            type="button"
            className="icon-button sidebar-toggle"
            aria-label={collapsed ? strings.shell.sidebar.expand : strings.shell.sidebar.collapse}
            title={collapsed ? strings.shell.sidebar.expand : strings.shell.sidebar.collapse}
            aria-expanded={!collapsed}
            onClick={onToggle}
          >
            <Icon name="sidebar" />
          </button>
        )}
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
      {canToggle && !collapsed && <ResizeHandle width={width} onResize={onResize} />}
    </aside>
  );
}

function Header({ route, path, search, month, onSearch }: { route: Route; path: string; search: URLSearchParams; month: Month; onSearch: () => void }) {
  const trail =
    route.module === 'not_found'
      ? []
      : route.module === 'financas'
        ? [strings.shell.modules.financas, strings.shell.tabs[route.tab]]
        : [strings.shell.modules[route.module]];
  const goToMonth = (delta: number) => navigate(withQuery(path, search, { mes: monthKey(shiftMonth(month, delta)) }));
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

function DetailPanel({ onClose, children }: { onClose: () => void; children?: ReactNode }) {
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
      {children ?? (
        <div className="wip wip--tall">
          <span className="chip">{strings.wip}</span>
          <p className="text-label muted">{strings.shell.panel.hint}</p>
        </div>
      )}
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
