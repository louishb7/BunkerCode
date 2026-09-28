import { useEffect } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { Button, EmptyState, ErrorMessage, StatusBadge } from '../components/ui';
import { actionLabel, clock, duration, requestLabel, runLabel } from '../lib/format';

export function RunsPage() {
  const { runs, runsLoading, runsError, refreshRuns } = useWorkspace();
  useEffect(() => { void refreshRuns(); }, [refreshRuns]);
  return <section aria-label="Execuções recentes">
    <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-base font-medium">Execuções recentes</h2><p className="mt-1.5 text-xs text-text-muted">{runs.length} registros em memória · mais recentes primeiro</p></div><Button disabled={runsLoading} onClick={refreshRuns}><RefreshCw size={14} />Atualizar</Button></div>
    {runsError && <div className="mb-4"><ErrorMessage>{runsError}</ErrorMessage></div>}
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      {runs.length ? <table className="w-full whitespace-nowrap text-left text-xs"><caption className="sr-only">Execuções observadas no OrderDesk</caption>
        <thead className="border-b border-border bg-surface-elevated/40 text-[10px] uppercase tracking-wider text-text-muted"><tr>{['Execução / ação', 'Request', 'Resultado', 'Duração', 'Início'].map((title) => <th key={title} className="px-5 py-3.5 font-medium">{title}</th>)}<th className="px-3"><span className="sr-only">Abrir</span></th></tr></thead>
        <tbody>{runs.map((run) => <tr key={run.id} className="group border-b border-border/60 last:border-0 hover:bg-surface-elevated/50">
          <td className="px-5 py-4"><Link to={'/runs/' + run.id} className="font-mono font-medium text-text-primary hover:text-accent">{runLabel(run.id)}</Link><div className="mt-1.5 text-[11px] text-text-muted">{actionLabel(run.action)}</div></td>
          <td className="px-5 py-4 font-mono text-[11px] text-text-muted">{requestLabel(run)}</td>
          <td className="px-5 py-4"><div className="flex items-center gap-2"><span className="font-mono">{run.httpStatus ?? '—'}</span><StatusBadge status={run.status} /></div></td>
          <td className="px-5 py-4 font-mono text-text-muted">{duration(run.durationMs)}</td>
          <td className="px-5 py-4 font-mono text-[11px] text-text-muted"><time dateTime={new Date(run.createdAt).toISOString()} title={new Date(run.createdAt).toLocaleString('pt-BR')}>{clock(run.startedAt ?? run.createdAt)}</time></td>
          <td className="px-3 py-4"><Link to={'/runs/' + run.id} aria-label={'Inspecionar ' + runLabel(run.id)} className="inline-flex p-1 text-text-muted hover:text-accent"><ArrowUpRight size={16} /></Link></td>
        </tr>)}</tbody>
      </table> : <EmptyState title={runsLoading ? 'Carregando execuções…' : runsError ? 'Histórico indisponível' : 'Nenhuma execução registrada nesta sessão.'}><Link to="/" className="text-accent hover:underline">Abrir Workbench</Link></EmptyState>}
    </div>
    <p className="mt-4 text-[11px] text-text-muted">Resetar o OrderDesk preserva esta lista. Reiniciar a API encerra a sessão e apaga o histórico.</p>
  </section>;
}
