import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  Layers3,
  Play,
  Radio,
  RotateCcw,
  Waves,
  Zap,
} from "lucide-react";
import type { LabDefinition, LabEvent, LabRun } from "@backendlab/protocol";
import { api } from "./api";

function formatElapsed(value: number): string {
  return `+${value} ms`;
}
function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour12: false,
    fractionalSecondDigits: 3,
  });
}

type Stage = "idle" | "active" | "completed";
const mapNodes = [
  {
    label: "Client",
    detail: "HTTP caller",
    enter: "client.request.started",
    done: "client.response.received",
    icon: Code2,
  },
  {
    label: "HTTP / NestJS",
    detail: "Request boundary",
    enter: "request.received",
    done: "response.sent",
    icon: Waves,
  },
  {
    label: "Controller",
    detail: "Route handler",
    enter: "controller.entered",
    done: "controller.completed",
    icon: Layers3,
  },
  {
    label: "Service",
    detail: "Business operation",
    enter: "service.entered",
    done: "service.completed",
    icon: Zap,
  },
  {
    label: "Response",
    detail: "HTTP result",
    enter: "controller.completed",
    done: "response.sent",
    icon: ArrowRight,
  },
];

function nodeStage(events: LabEvent[], enter: string, done: string): Stage {
  if (events.some((event) => event.type === done)) return "completed";
  if (events.some((event) => event.type === enter)) return "active";
  return "idle";
}

export function LabScreen({
  lab,
  onBack,
}: {
  lab: LabDefinition;
  onBack: () => void;
}) {
  const [hypothesis, setHypothesis] = useState("");
  const [events, setEvents] = useState<LabEvent[]>([]);
  const [run, setRun] = useState<LabRun | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<
    "idle" | "starting" | "running" | "completed" | "failed"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const source = useRef<EventSource | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current += 1;
      source.current?.close();
    },
    [],
  );

  async function start() {
    if (phase === "running" || phase === "starting") return;
    const attempt = ++generation.current;
    source.current?.close();
    setEvents([]);
    setRun(null);
    setSelectedId(null);
    setError(null);
    setPhase("starting");
    try {
      const created = await api.createRun(lab.id);
      if (generation.current !== attempt) {
        void api.abandonRun(lab.id, created.id);
        return;
      }
      setRun(created);
      const stream = new EventSource(api.eventsUrl(lab.id, created.id));
      source.current = stream;
      let started = false;
      let terminal = false;
      stream.onopen = () => {
        if (generation.current !== attempt || started) return;
        started = true;
        api
          .startRun(lab.id, created.id)
          .then((active) => {
            if (generation.current === attempt && !terminal) {
              setRun(active);
              setPhase("running");
            }
          })
          .catch((cause: unknown) => {
            if (generation.current !== attempt) return;
            setError(
              cause instanceof Error
                ? cause.message
                : "Não foi possível iniciar a request.",
            );
            setPhase("failed");
            stream.close();
            void api.abandonRun(lab.id, created.id);
          });
      };
      stream.onmessage = (message) => {
        if (generation.current !== attempt) return;
        const event = JSON.parse(message.data) as LabEvent;
        setEvents((current) =>
          current.some((item) => item.id === event.id)
            ? current
            : [...current, event],
        );
        if (event.type === "run.completed" || event.type === "run.failed") {
          terminal = true;
          stream.close();
          api
            .run(lab.id, created.id)
            .then(({ run: completed }) => {
              if (generation.current === attempt) {
                setRun(completed);
                setPhase(
                  completed.status === "completed" ? "completed" : "failed",
                );
              }
            })
            .catch(() => {
              if (generation.current === attempt)
                setPhase(
                  event.type === "run.completed" ? "completed" : "failed",
                );
            });
        }
      };
      stream.onerror = () => {
        if (
          generation.current === attempt &&
          stream.readyState !== EventSource.CLOSED
        ) {
          setError("Conexão de eventos interrompida.");
          setPhase("failed");
          stream.close();
          void api.abandonRun(lab.id, created.id);
        }
      };
    } catch (cause) {
      if (generation.current !== attempt) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível iniciar a execução.",
      );
      setPhase("idle");
    }
  }

  function reset() {
    generation.current += 1;
    source.current?.close();
    source.current = null;
    if (run && (run.status === "pending" || run.status === "running"))
      void api.abandonRun(lab.id, run.id);
    setEvents([]);
    setRun(null);
    setSelectedId(null);
    setPhase("idle");
    setError(null);
  }

  const selected =
    events.find((event) => event.id === selectedId) ?? events.at(-1);
  const firstTimestamp = events[0]?.timestamp ?? 0;
  const isRunning = phase === "running" || phase === "starting";

  return (
    <div className="lab-page">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={15} /> BACK TO CURRICULUM
      </button>
      <div className="lab-header">
        <div>
          <div className="lab-meta">
            <span>LAB / 001</span>
            <span className="meta-slash">/</span>
            <span>EXECUTION</span>
            <span className="badge badge-observe">OBSERVE</span>
            <span className="badge badge-real">
              <span className="status-dot" /> REAL EXECUTION
            </span>
          </div>
          <h1>
            Request Lifecycle<span className="title-period">.</span>
          </h1>
          <p>{lab.question}</p>
        </div>
        <div className="lab-header-symbol">
          001<span>↗</span>
        </div>
      </div>
      <div className="lab-intro-grid">
        <section className="hypothesis-card">
          <div className="card-label">
            <CircleHelp size={17} /> 01 / HYPOTHESIS
          </div>
          <label htmlFor="hypothesis">Sua hipótese</label>
          <p>
            Antes de executar, descreva a ordem em que você espera que o sistema
            trabalhe.
          </p>
          <textarea
            id="hypothesis"
            value={hypothesis}
            onChange={(event) => setHypothesis(event.target.value)}
            placeholder="Acho que primeiro..."
            rows={3}
          />
          <span className="field-note">LOCAL ONLY · NÃO É SALVA</span>
        </section>
        <section className="controls-card">
          <div className="card-label">
            <Play size={16} /> 02 / EXPERIMENT CONTROL
          </div>
          <div className="controls-card-body">
            <div className="control-status">
              <span
                className={`run-light ${isRunning ? "pulsing" : phase === "completed" ? "finished" : ""}`}
              />
              <div>
                <strong>
                  {phase === "idle"
                    ? "Pronto para executar"
                    : phase === "starting"
                      ? "Iniciando execução"
                      : phase === "running"
                        ? "Execução em andamento"
                        : phase === "completed"
                          ? "Execução concluída"
                          : "Execução falhou"}
                </strong>
                <small>
                  {run
                    ? `RUN ${run.id.slice(0, 8).toUpperCase()}`
                    : "Nenhuma run ativa"}
                </small>
              </div>
            </div>
            <div className="control-actions">
              <button
                className="run-button"
                onClick={start}
                disabled={isRunning}
              >
                <Play size={15} fill="currentColor" />{" "}
                {isRunning ? "RUNNING..." : "RUN REQUEST"}
              </button>
              <button className="reset-button" onClick={reset}>
                <RotateCcw size={15} /> RESET
              </button>
            </div>
          </div>
          {error && <div className="inline-error">{error}</div>}
        </section>
      </div>
      <div className="observatory-heading">
        <div>
          <span className="eyebrow-line" /> OBSERVATORY
        </div>
        <span>
          <span className={`status-dot ${isRunning ? "pulsing" : ""}`} />{" "}
          {isRunning
            ? "STREAMING LIVE EVENTS"
            : events.length
              ? `${events.length} EVENTS CAPTURED`
              : "AWAITING EXECUTION"}
        </span>
      </div>
      <section className="map-panel">
        <div className="panel-head">
          <div>
            <h2>System Map</h2>
            <p>Os estados respondem aos eventos recebidos da execução.</p>
          </div>
          <span className="panel-index">01 / MAP</span>
        </div>
        <div className="system-map">
          {mapNodes.map((node, index) => {
            const Icon = node.icon;
            const stage = nodeStage(events, node.enter, node.done);
            return (
              <div className="map-fragment" key={node.label}>
                <div className={`map-node ${stage}`}>
                  <span className="map-node-index">0{index + 1}</span>
                  <div className="map-node-icon">
                    <Icon size={22} strokeWidth={1.7} />
                  </div>
                  <strong>{node.label}</strong>
                  <small>{node.detail}</small>
                  <span className="map-node-state">
                    {stage === "completed" ? (
                      <>
                        <Check size={12} /> COMPLETED
                      </>
                    ) : stage === "active" ? (
                      <>
                        <span className="status-dot" /> ACTIVE
                      </>
                    ) : (
                      "IDLE"
                    )}
                  </span>
                </div>
                {index < mapNodes.length - 1 && (
                  <div
                    className={`map-connector ${stage === "completed" ? "lit" : ""}`}
                  >
                    <span />
                    <ArrowRight size={16} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="map-caption">
          <Radio size={15} /> Cada transição acima foi observada em uma request
          HTTP real.
        </div>
      </section>
      <div className="observation-grid">
        <section className="timeline-panel">
          <div className="panel-head">
            <div>
              <h2>Event Timeline</h2>
              <p>Sequência cronológica da run.</p>
            </div>
            <span className="panel-index">02 / EVENTS</span>
          </div>
          <div className="timeline-list">
            {events.length === 0 ? (
              <div className="empty-state">
                <Clock3 size={27} />
                <strong>Nenhum evento ainda</strong>
                <span>Execute a request para observar o fluxo.</span>
              </div>
            ) : (
              events.map((event, index) => (
                <button
                  className={`timeline-row ${selected?.id === event.id ? "row-selected" : ""}`}
                  key={event.id}
                  onClick={() => setSelectedId(event.id)}
                >
                  <span className="timeline-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="timeline-mark" />
                  <span className="timeline-type">{event.type}</span>
                  <span className="timeline-elapsed">
                    {formatElapsed(event.timestamp - firstTimestamp)}
                  </span>
                  <ChevronRight size={14} />
                </button>
              ))
            )}
          </div>
        </section>
        <section className="inspector-panel">
          <div className="panel-head">
            <div>
              <h2>Event Inspector</h2>
              <p>Selecione um evento para inspecionar.</p>
            </div>
            <span className="panel-index">03 / INSPECT</span>
          </div>
          {selected ? (
            <div className="inspector-body">
              <div className="inspector-type">
                <span className="inspector-label">EVENT TYPE</span>
                <strong>{selected.type}</strong>
              </div>
              <div className="inspector-fields">
                <div>
                  <span>SOURCE</span>
                  <strong>{selected.source}</strong>
                </div>
                <div>
                  <span>ELAPSED</span>
                  <strong>
                    {formatElapsed(selected.timestamp - firstTimestamp)}
                  </strong>
                </div>
                <div>
                  <span>TIMESTAMP</span>
                  <strong>{formatTime(selected.timestamp)}</strong>
                </div>
                <div>
                  <span>RUN ID</span>
                  <strong className="id-value" title={selected.runId}>
                    {selected.runId}
                  </strong>
                </div>
                <div>
                  <span>LAB ID</span>
                  <strong>{selected.labId}</strong>
                </div>
              </div>
              <div className="payload-head">
                PAYLOAD <span>JSON</span>
              </div>
              <pre className="payload-box">
                {JSON.stringify(selected.payload ?? {}, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="empty-state inspector-empty">
              <CircleHelp size={28} />
              <strong>Nada para inspecionar</strong>
              <span>Os detalhes aparecerão quando um evento chegar.</span>
            </div>
          )}
        </section>
      </div>
      {run && (phase === "completed" || phase === "failed") && (
        <section className="summary-panel">
          <div>
            <span className="section-mini">RUN SUMMARY</span>
            <h2>
              {phase === "completed" ? "Request completed." : "Request failed."}
            </h2>
          </div>
          <div className="summary-stat">
            <span>STATUS</span>
            <strong
              className={phase === "completed" ? "success-text" : "error-text"}
            >
              {run.status.toUpperCase()}
            </strong>
          </div>
          <div className="summary-stat">
            <span>HTTP STATUS</span>
            <strong>{run.httpStatus ?? "—"}</strong>
          </div>
          <div className="summary-stat">
            <span>DURATION</span>
            <strong>
              {run.durationMs ?? "—"}
              <small> ms</small>
            </strong>
          </div>
          <div className="summary-stat">
            <span>EVENTS</span>
            <strong>{events.length}</strong>
          </div>
        </section>
      )}
    </div>
  );
}
