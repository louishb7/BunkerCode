import { ArrowRight, Circle, CornerDownRight } from 'lucide-react';
import type { LabEvent } from '@backendlab/protocol';
import { eventValue } from '../../lib/format';

export function ExecutionFlow({ events }: { events: LabEvent[] }) {
  const find = (type: string) => events.find((event) => event.type === type);
  const request = find('request.received');
  const controller = find('controller.entered');
  const service = find('service.entered');
  const response = find('response.sent');
  const steps = request ? [
    { title: eventValue(request, 'origin') === window.location.origin ? 'Browser' : 'HTTP client', detail: 'Origem da request' },
    { title: 'HTTP / NestJS', detail: eventValue(request, 'method') + ' ' + eventValue(request, 'path') },
    ...(controller ? [{ title: eventValue(controller, 'handler'), detail: find('controller.failed') ? 'Handler · falhou' : 'Handler' }] : []),
    ...(service ? [{ title: eventValue(service, 'operation'), detail: find('service.failed') ? 'Service · falhou' : 'Service' }] : []),
    ...(response ? [{ title: 'Response', detail: 'HTTP ' + eventValue(response, 'statusCode') }] : []),
  ] : [];
  return <section className="p-5 sm:p-6"><h3 className="mb-6 text-xs font-medium">Fluxo da execução</h3>
    {steps.length ? <ol>{steps.map((step, index) => <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0">
      {index < steps.length - 1 && <span className="absolute top-5 bottom-0 left-2.5 border-l border-border" aria-hidden="true" />}
      <span className="relative z-1 flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-muted"><Circle size={6} /></span>
      <div className="min-w-0"><p className="font-mono text-xs break-words">{step.title}</p><p className="mt-1 text-[10px] break-all text-text-muted">{step.detail}</p></div>
    </li>)}</ol> : <p className="text-xs text-text-muted">A request ainda não foi recebida pela API.</p>}
  </section>;
}

export function StateChanges({ events, inspect }: { events: LabEvent[]; inspect: (event: LabEvent) => void }) {
  const stock = events.find((event) => event.type === 'stock.updated');
  const order = events.find((event) => event.type === 'order.created');
  const beforeStock = stock?.payload?.previousStock, afterStock = stock?.payload?.stock;
  const beforeOrders = order?.payload?.previousOrderCount, afterOrders = order?.payload?.orderCount;
  const changes = [
    ...(stock && typeof beforeStock === 'number' && typeof afterStock === 'number' ? [{ label: 'Estoque', before: beforeStock, after: afterStock, event: stock }] : []),
    ...(order && typeof beforeOrders === 'number' && typeof afterOrders === 'number' ? [{ label: 'Pedidos', before: beforeOrders, after: afterOrders, event: order }] : []),
  ];
  return <section className="border-t border-border p-5 sm:p-6 lg:border-t-0 lg:border-l"><h3 className="text-xs font-medium">Mudanças de estado</h3><p className="mt-2 text-[11px] leading-relaxed text-text-muted">Antes e depois desta ação, registrados no backend.</p>
    {changes.length ? <div className="mt-6 divide-y divide-border">{changes.map((change) => <div key={change.label} className="py-5 first:pt-0">
      <div className="flex items-center justify-between gap-4"><span className="text-xs text-text-muted">{change.label}</span><div className="flex items-center gap-4 font-mono text-xl"><span className="text-text-muted">{change.before}</span><ArrowRight size={15} className="text-text-muted" /><span className="text-accent">{change.after}</span></div></div>
      <button onClick={() => inspect(change.event)} className="mt-4 inline-flex items-center gap-1.5 font-mono text-[10px] text-text-muted hover:text-accent"><CornerDownRight size={12} />{change.event.type}</button>
    </div>)}</div> : <p className="mt-8 text-xs leading-relaxed text-text-muted">Nenhuma mudança de domínio registrada nesta execução.</p>}
    {order && !changes.some((change) => change.event.id === order.id) && <button className="mt-5 text-xs text-accent" onClick={() => inspect(order)}>Inspecionar pedido criado →</button>}
    <p className="mt-5 border-t border-border pt-4 text-[10px] leading-relaxed text-text-muted">Evidência histórica. Um reset ou uma nova ação pode ter alterado o estado atual do OrderDesk.</p>
  </section>;
}
