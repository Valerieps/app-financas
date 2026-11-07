import { useCallback, useEffect, useState } from 'react';
import type { LockStatusView } from '../application/api-contract';
import { monthKey, monthOf, parseMonth, type Month } from '../domain/month';
import { strings } from '../domain/strings';
import { useServices } from './backend-context';
import { Link, useLocation } from './router';
import { Categorias } from './screens/Categorias';
import { Cofre } from './screens/Cofre';
import { Graficos } from './screens/Graficos';
import { LancamentoDetail, Lancamentos } from './screens/Lancamentos';
import { Locked } from './screens/Locked';
import { VisaoGeral } from './screens/VisaoGeral';
import { EmConstrucao } from './shell/EmConstrucao';
import { graficosChart, parseRoute, type Route } from './shell/routes';
import { Shell } from './shell/Shell';

// Cloudflare Access signs the owner in before the app loads (ADR-007), so there is no login
// screen; a device with a passkey shows the lock until the fingerprint opens it.
export function App() {
  const { backend, deviceLock } = useServices();
  const [status, setStatus] = useState<LockStatusView | null>(null);
  const { path, search } = useLocation();

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

  const route = parseRoute(path);
  const parsed = parseMonth(search.get('mes'));
  const monthParam = parsed ? monthKey(parsed) : null;
  const month = parsed ?? monthOf(new Date());

  return (
    <Shell route={route} path={path} month={month} monthParam={monthParam} search={search} panel={<Panel route={route} />}>
      <Screen
        route={route}
        path={path}
        month={month}
        search={search}
        monthParam={monthParam}
        onPasskeysChanged={check}
        onLock={status.deviceHasPasskey ? () => void lockNow() : null}
      />
    </Shell>
  );
}

/** What the detail panel shows for the item in the URL; null keeps it under construction. */
function Panel({ route }: { route: Route }) {
  if (route.module === 'financas' && route.tab === 'lancamentos' && route.detailId) return <LancamentoDetail id={route.detailId} />;
  return null;
}

function Screen({
  route,
  path,
  month,
  search,
  monthParam,
  onPasskeysChanged,
  onLock,
}: {
  route: Route;
  path: string;
  month: Month;
  search: URLSearchParams;
  monthParam: string | null;
  onPasskeysChanged: () => void;
  onLock: (() => void) | null;
}) {
  switch (route.module) {
    case 'financas':
      if (route.tab === 'visao-geral') return <VisaoGeral monthParam={monthParam} />;
      if (route.tab === 'lancamentos') return <Lancamentos month={month} search={search} selectedId={route.detailId ?? null} />;
      if (route.tab === 'graficos')
        return <Graficos chart={graficosChart(path)} month={monthKey(month)} monthParam={monthParam} compareParam={search.get('comparar')} />;
      return <EmConstrucao title={strings.shell.tabs[route.tab]} hint={strings.screens[route.tab]} tall />;
    case 'categorias':
      return <Categorias />;
    case 'cofre':
      return <Cofre onPasskeysChanged={onPasskeysChanged} />;
    case 'ajustes':
      return (
        <div className="stack">
          <EmConstrucao title={strings.shell.modules.ajustes} hint={strings.screens.ajustes} tall />
          {onLock && (
            <div>
              <button type="button" className="secondary" onClick={onLock}>
                {strings.shell.lockNow}
              </button>
            </div>
          )}
        </div>
      );
    case 'not_found':
      return (
        <div className="stack">
          <p>{strings.shell.notFound}</p>
          <Link to="/">{strings.shell.backHome}</Link>
        </div>
      );
    default:
      return <EmConstrucao title={strings.shell.modules[route.module]} hint={strings.screens[route.module]} tall />;
  }
}
