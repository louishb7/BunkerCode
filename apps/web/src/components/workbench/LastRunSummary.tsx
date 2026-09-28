import { ArrowUpRight, Activity } from 'lucide-react';
import { Link } from 'react-router';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { duration, requestLabel, runLabel } from '../../lib/format';
import { StatusBadge } from '../ui';

export function LastRunSummary() {
  const { runs, runsError, busy } = useWorkspace();
  const run = runs[0];
  return <section aria-label="Última execução" className="mt-5 border-t border-border px-1 py-5">
    <div className="mb-3 flex items-center gap-2 text-[11px] text-text-muted"><Activity size={14} /><h2>Última execução</h2></div>
    {run ? <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex flex-wrap items-center gap-x-5 gap-y-2"><span className="font-mono text-xs text-text-muted">{runLabel(run.id)}</span><span className="font-mono text-xs">{requestLabel(run)}</span><span className={"font-mono text-xs " + ((run.httpStatus ?? 0) >= 400 ? "text-danger" : "text-success")}>{run.httpStatus ?? '—'}</span><span className="font-mono text-xs text-text-muted">{duration(run.durationMs)}</span><StatusBadge status={run.status} /></div>
      <Link to={'/runs/' + run.id} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">Inspecionar <ArrowUpRight size={14} /></Link>
    </div> : <p className="text-xs text-text-muted">{busy === 'order' ? 'Observando a criação do pedido…' : runsError ? 'As execuções estão indisponíveis no momento.' : 'Uma ação no OrderDesk aparecerá aqui para inspeção.'}</p>}
  </section>;
}
