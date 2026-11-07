// Finanças › Visão geral (docs/rascunhos/arquitetura-desktop.md): the month's answer at a glance,
// top to bottom, every block a shortcut. None of its data exists yet (Livre do dia, termômetro and
// importância come with phases 2 and 3; metas and caixinhas have no spec yet), so each block keeps
// its place and says it is under construction.
import { strings } from '../../domain/strings';
import { Link } from '../router';
import { EmConstrucao } from '../shell/EmConstrucao';
import { tabPath, withMonth } from '../shell/routes';

export function VisaoGeral({ monthParam }: { monthParam: string | null }) {
  const text = strings.visaoGeral;
  const link = (to: string, label: string) => (
    <Link to={withMonth(to, monthParam)} className="text-label">
      {label}
    </Link>
  );
  return (
    <div className="overview">
      <div className="overview-answer">
        <EmConstrucao className="overview-livre" title={text.livre.title} hint={text.livre.hint} tall />
        <EmConstrucao title={text.hoje.title} hint={text.hoje.hint} action={link(tabPath('gastos'), text.hoje.link)} />
      </div>
      <div className="overview-pair">
        <EmConstrucao title={text.mes.title} hint={text.mes.hint} />
        <EmConstrucao title={text.termometro.title} hint={text.termometro.hint} />
      </div>
      <div className="overview-pair">
        <EmConstrucao title={text.revisar.title} hint={text.revisar.hint} action={link(tabPath('gastos'), text.revisar.link)} />
        <EmConstrucao title={text.metas.title} hint={text.metas.hint} action={link(tabPath('metas'), text.metas.link)} />
      </div>
      <EmConstrucao title={text.caixinhas.title} hint={text.caixinhas.hint} action={link(tabPath('caixinhas'), text.caixinhas.link)} />
    </div>
  );
}
