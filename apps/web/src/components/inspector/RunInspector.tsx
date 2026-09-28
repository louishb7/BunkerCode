import { useState } from 'react';
import type { LabEvent, RunDetail } from '@backendlab/protocol';
import { Link } from 'react-router';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { actionLabel, clock, duration, eventValue, requestLabel, runLabel } from '../../lib/format';
import { Button, StatusBadge } from '../ui';
import { EventPanel, Field, JsonBlock } from './EventPanel';
import { ExecutionFlow, StateChanges } from './ExecutionEvidence';

type View = 'overview' | 'events' | 'runtime' | 'raw';
export function RunInspector({ detail, refresh }: { detail: RunDetail; refresh: () => void }) {
  const [view, setView] = useState<View>('overview');
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>();
  const { run, events, runtime } = detail;
  const find = (type: string) => events.find((event) => event.type === type);
  const request = find('request.received');
  const response = find('response.sent');
  function interval(start: string, end: string): string {
    const a = find(start), b = find(end);
    return a && b ? duration(b.timestamp - a.timestamp) : '—';
  }
  function inspect(event: LabEvent) { setSelectedEvent(event.id); setView('events'); }
  return <div>
    <Link to="/runs" className="mb-5 inline-flex items-center gap-2 text-xs text-text-muted hover:text-text-primary"><ArrowLeft size={13} />Execuções</Link>
    <section aria-label={'Inspector · ' + runLabel(run.id)} className="overflow-hidden rounded-lg border border-border bg-surface">
      <header className="p-5 pb-0 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex flex-wrap items-center gap-3"><h2 className="font-mono text-lg font-medium">{runLabel(run.id)}</h2><StatusBadge status={run.status} /></div><span className="text-xs text-text-muted">{actionLabel(run.action)}</span></div>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 pb-5"><span className="font-mono text-xs">{requestLabel(run)}</span><span className={'font-mono text-xs ' + (run.httpStatus && run.httpStatus >= 400 ? 'text-danger' : 'text-success')}>{run.httpStatus ?? '—'}</span><span className="font-mono text-xs text-text-muted">{duration(run.durationMs)}</span><time dateTime={new Date(run.createdAt).toISOString()} className="text-xs text-text-muted">{clock(run.startedAt ?? run.createdAt)}</time></div>
        <nav aria-label="Visões do Inspector" className="-mx-5 flex overflow-x-auto border-t border-border px-3 sm:-mx-6 sm:px-4">{([['overview', 'Visão geral'], ['events', 'Eventos'], ['runtime', 'Runtime'], ['raw', 'Raw']] as const).map(([id, label]) => <button key={id} onClick={() => setView(id)} aria-pressed={view === id} className={'shrink-0 border-b-2 px-3 py-3.5 text-xs transition-colors ' + (view === id ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary')}>{label}{id === 'events' && <span className="ml-2 font-mono text-[10px] text-text-muted">{events.length}</span>}</button>)}</nav>
      </header>
      <div className="border-t border-border">
        {view === 'overview' && <><div className="grid lg:grid-cols-2"><ExecutionFlow events={events} /><StateChanges events={events} inspect={inspect} /></div>
          <details className="border-t border-border px-5 py-4 sm:px-6"><summary className="text-xs text-text-muted">Request e intervalos detalhados</summary>
            <dl className="mt-4 max-w-3xl"><Field label="Origem HTTP" value={eventValue(request, 'origin')} /><Field label="Destino" value={eventValue(request, 'destination')} /><Field label="Início na API" value={clock(request?.timestamp)} /><Field label="Fim na API" value={clock(response?.timestamp)} /><Field label="HTTP: recebimento → resposta" value={interval('request.received', 'response.sent')} /><Field label="Handler: entrada → conclusão" value={interval('controller.entered', 'controller.completed')} /><Field label="Service: entrada → conclusão" value={interval('service.entered', 'service.completed')} /></dl>
            <p className="mt-4 max-w-2xl text-[11px] leading-relaxed text-text-muted">Timestamps reais do backend, com resolução de 1 ms. O handler inclui o service. Os intervalos não devem ser somados e não medem a latência do navegador.</p>
          </details></>}
        {view === 'events' && <EventPanel key={selectedEvent ?? 'events'} events={events} startedAt={run.startedAt} initialId={selectedEvent} />}
        {view === 'runtime' && <div className="max-w-3xl p-5 sm:p-6"><h3 className="mb-4 text-xs font-medium">Processo da API</h3><dl><Field label="Runtime" value={runtime.engine} /><Field label="Node.js" value={runtime.nodeVersion} /><Field label="PID" value={runtime.pid} /><Field label="Porta da API" value={runtime.apiPort} /></dl><p className="mt-5 text-xs leading-relaxed text-text-muted">OrderDesk e instrumentação compartilham este processo NestJS. A request chega por HTTP a partir do client, sem chamada loopback da API.</p></div>}
        {view === 'raw' && <div className="p-5 sm:p-6"><h3 className="mb-2 text-xs font-medium">Snapshot completo da execução</h3><p className="mb-4 text-[11px] text-text-muted">IDs completos, eventos originais e runtime retornados pela API.</p><JsonBlock value={detail} /></div>}
      </div>
    </section>
    {(run.status === 'pending' || run.status === 'running') && <div className="mt-4 flex items-center gap-4"><p className="text-xs text-text-muted">Esta execução ainda está em andamento.</p><Button onClick={refresh}><RefreshCw size={13} />Atualizar execução</Button></div>}
  </div>;
}
