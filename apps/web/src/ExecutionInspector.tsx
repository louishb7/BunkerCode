import { useState } from "react";
import type { LabEvent, RunDetail } from "@backendlab/protocol";

type View = "request" | "events" | "runtime";

function clock(value?: number): string {
  return value === undefined ? "—" : new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, fractionalSecondDigits: 3,
  });
}
function value(event: LabEvent | undefined, key: string): string {
  const field = event?.payload?.[key];
  return typeof field === "string" || typeof field === "number" ? String(field) : "—";
}
function Field({ label, content }: { label: string; content: string | number }) {
  return <div className="field"><dt>{label}</dt><dd>{content}</dd></div>;
}
function EventDetail({ event, startedAt }: { event: LabEvent; startedAt?: number }) {
  return <div className="event-detail">
    <h3>{event.type}</h3>
    <h4>Identity</h4>
    <dl><Field label="Source" content={event.source} /><Field label="Event ID" content={event.id} />
      <Field label="Run ID" content={event.runId} /><Field label="Scenario ID" content={event.labId} /></dl>
    <h4>Timing</h4>
    <dl><Field label="Timestamp" content={clock(event.timestamp)} />
      <Field label="Desde início da run" content={startedAt === undefined ? "—" : event.timestamp - startedAt + " ms"} /></dl>
    <h4>Data</h4>
    <pre>{JSON.stringify(event.payload ?? {}, null, 2)}</pre>
    <details className="raw-event"><summary>Evento completo · JSON</summary><pre>{JSON.stringify(event, null, 2)}</pre></details>
  </div>;
}

export function ExecutionInspector({ detail }: { detail: RunDetail }) {
  const [view, setView] = useState<View>("request");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { run, events, runtime } = detail;
  const eventOf = (type: string) => events.find((event) => event.type === type);
  const request = eventOf("request.received");
  const response = eventOf("response.sent");
  const controller = eventOf("controller.entered");
  const service = eventOf("service.entered");
  const selected = events.find((event) => event.id === selectedId) ?? events.find((event) => event.type === "order.created") ?? events.at(-1);
  function interval(start: string, end: string): string {
    const a = eventOf(start), b = eventOf(end);
    return a && b ? b.timestamp - a.timestamp + " ms" : "—";
  }
  return <section className="execution-inspector" id="execution-inspector" aria-label="Inspeção da última execução">
    <div className="inspector-heading"><h2>Última criação de pedido</h2><span>{run.status}</span></div>
    <nav className="inspector-tabs" aria-label="Evidências da execução">
      {([["request", "Request e fluxo"], ["events", "Eventos"], ["runtime", "Runtime"]] as const).map(([id, label]) =>
        <button key={id} className={view === id ? "selected" : ""} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}
    </nav>
    {view === "request" && <div className="request-inspection">
      <h3 className="request-path">{request ? value(request, "method") + " " + value(request, "path") : "Request não recebida pela API"}</h3>
      <dl className="request-summary"><Field label="Status HTTP" content={run.httpStatus ?? "—"} />
        <Field label="Na API" content={interval("request.received", "response.sent")} />
        <Field label="Início" content={clock(request?.timestamp)} /><Field label="Fim" content={clock(response?.timestamp)} /></dl>
      {request && <div className="call-flow">
        <h3>Fluxo observado</h3>
        <div>Navegador → HTTP / NestJS</div>
        {controller && <div className="call-child">└─ {value(controller, "handler")}</div>}
        {service && <div className="call-grandchild">└─ {value(service, "operation")}</div>}
      </div>}
      <details className="request-more"><summary>Metadata e intervalos</summary>
        <dl><Field label="Origem HTTP" content={value(request, "origin")} /><Field label="Destino" content={value(request, "destination")} />
          <Field label="Handler (inclui service)" content={interval("controller.entered", "controller.completed")} />
          <Field label="Service" content={interval("service.entered", "service.completed")} />
          <Field label="Run ID" content={run.id} /></dl>
        <p className="muted">Intervalos entre timestamps reais do backend, com resolução de 1 ms. Não medem o tempo de rede do navegador. Handler e service são aninhados.</p>
      </details>
    </div>}
    {view === "events" && <div className="events-layout">
      <div className="event-list">{events.map((event, index) => <button key={event.id}
        className={"event-row " + (selected?.id === event.id ? "selected" : "")} onClick={() => setSelectedId(event.id)}>
        <span>{String(index + 1).padStart(2, "0")}</span><strong>{event.type}</strong>
        <span>{run.startedAt === undefined ? "—" : "+" + (event.timestamp - run.startedAt) + " ms"}</span>
      </button>)}</div>
      {selected && <EventDetail event={selected} startedAt={run.startedAt} />}
    </div>}
    {view === "runtime" && <div className="runtime-inspection">
      <h3>Processo da API</h3><dl><Field label="Runtime" content={runtime.engine} /><Field label="Node.js" content={runtime.nodeVersion} />
        <Field label="PID" content={runtime.pid} /><Field label="Porta" content={runtime.apiPort} /></dl>
      <p className="muted">Pedidos, estoque e instrumentação compartilham este processo NestJS. O client desta operação é o navegador; a API não faz uma chamada loopback.</p>
    </div>}
  </section>;
}
