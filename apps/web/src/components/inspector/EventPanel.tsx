import { useState } from 'react';
import type { LabEvent } from '@backendlab/protocol';
import { clock, duration } from '../../lib/format';

export function JsonBlock({ value }: { value: unknown }) {
  return <pre className="max-h-[28rem] overflow-auto rounded-md border border-border bg-shell/70 p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all text-text-primary">{JSON.stringify(value, null, 2)}</pre>;
}
export function Field({ label, value }: { label: string; value: string | number }) {
  return <div className="flex min-w-0 items-baseline justify-between gap-5 py-1.5"><dt className="shrink-0 text-[11px] text-text-muted">{label}</dt><dd className="min-w-0 text-right font-mono text-[11px] break-all text-text-primary">{value}</dd></div>;
}
export function EventPanel({ events, startedAt, initialId }: { events: LabEvent[]; startedAt?: number; initialId?: string }) {
  const [selectedId, setSelectedId] = useState(initialId ?? events.find((event) => event.type === 'order.created')?.id ?? events[0]?.id);
  const selected = events.find((event) => event.id === selectedId) ?? events[0];
  return <div className="grid min-h-96 lg:grid-cols-[minmax(300px,.9fr)_minmax(0,1.1fr)]">
    <div className="border-b border-border lg:border-r lg:border-b-0"><div className="flex justify-between border-b border-border px-5 py-3 text-[10px] uppercase tracking-wider text-text-muted"><span>Sequência observada</span><span>{events.length} eventos</span></div>
      <div className="max-h-[36rem] overflow-y-auto">{events.map((event, index) => <button key={event.id} onClick={() => setSelectedId(event.id)} aria-pressed={selected?.id === event.id}
        className={'grid w-full grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/50 border-l-2 px-4 py-3.5 text-left font-mono text-[11px] transition-colors ' +
          (selected?.id === event.id ? 'border-l-accent bg-accent/8 text-text-primary' : 'border-l-transparent text-text-muted hover:bg-surface-elevated')}>
        <span className="text-[10px] text-text-muted">{String(index + 1).padStart(2, '0')}</span><span className="truncate">{event.type}</span><span className="text-[10px] text-text-muted">{startedAt === undefined ? '—' : '+' + duration(event.timestamp - startedAt)}</span>
      </button>)}</div>
    </div>
    {selected ? <section className="min-w-0 p-5 sm:p-6" aria-label="Detalhes do evento">
      <div className="mb-5"><span className="text-[10px] uppercase tracking-wider text-text-muted">Evento</span><h3 className="mt-2 font-mono text-sm break-all text-accent">{selected.type}</h3></div>
      <dl className="mb-5 border-y border-border py-3"><Field label="Source" value={selected.source} /><Field label="Timestamp" value={clock(selected.timestamp)} /><Field label="Desde início da run" value={startedAt === undefined ? '—' : duration(selected.timestamp - startedAt)} /></dl>
      <h4 className="mb-3 text-xs font-medium">Payload</h4><JsonBlock value={selected.payload ?? {}} />
      <details className="mt-5"><summary className="text-xs text-text-muted">Identity e evento bruto</summary><dl className="my-4"><Field label="Event ID" value={selected.id} /><Field label="Run ID" value={selected.runId} /><Field label="Scenario ID" value={selected.labId} /></dl><JsonBlock value={selected} /></details>
    </section> : <p className="p-6 text-xs text-text-muted">Nenhum evento recebido nesta run.</p>}
  </div>;
}
