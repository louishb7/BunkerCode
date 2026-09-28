import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowRight, Check, X } from "lucide-react";
import type { RunDetail } from "@backendlab/protocol";
import { date, short, Empty, Version, Status } from "../components/shared";
import { api } from "../api";
export function Inspector() {
  const { id } = useParams();
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("evidence");
  const [requestId, setRequestId] = useState("");
  useEffect(() => {
    let active = true;
    let timer: number;
    setDetail(null);
    setError("");
    setRequestId("");
    async function load() {
      try {
        const next = await api.run(id!);
        if (active) {
          setDetail(next);
          if (next.run.status === "running")
            timer = window.setTimeout(load, 600);
        }
      } catch (cause) {
        if (active) setError(String(cause));
      }
    }
    void load();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [id]);
  if (error) return <Empty>{error}</Empty>;
  if (!detail) return <Empty>Carregando evidências…</Empty>;
  const { run, requests, evidence } = detail;
  const firstViolation = evidence.find(
    (event) => event.type === "invariant.violated",
  );
  const filtered = requestId
    ? evidence.filter(
        (event) =>
          event.requestId === requestId ||
          event.payload.requestId === requestId,
      )
    : evidence;
  return (
    <>
      <Link className="back-link" to="/runs">
        ← Histórico
      </Link>
      <div className="page-heading">
        <div>
          <h1>
            Run #{run.number} <Status status={run.status} />
          </h1>
          <p>
            {date(run.createdAt)} · <Version run={run} />
          </p>
        </div>
        <Link className="button" to="/">
          Voltar ao sistema <ArrowRight size={16} />
        </Link>
      </div>
      {run.error && (
        <div role="alert" className="alert error">
          {run.error}
        </div>
      )}
      <div className="run-metrics">
        {[
          ["Requests", run.config.clients],
          ["Concorrência", run.config.concurrency],
          ["Aceitos", run.result?.accepted ?? "—"],
          ["Rejeitados", run.result?.rejected ?? "—"],
          ["Erros", run.result?.errors ?? "—"],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong
              className={
                typeof value === "number" && value < 0 ? "negative" : ""
              }
            >
              {value}
            </strong>
          </div>
        ))}
      </div>
      {run.result?.observations && (
        <div className="result-facts">
          {run.result.observations.map((item) => (
            <p key={item.key}>
              <strong>
                {item.label}:{" "}
                {item.before !== undefined ? `${item.before} → ` : ""}
                {item.value}
              </strong>
              {item.note && <span className="negative"> · {item.note}</span>}
            </p>
          ))}
        </div>
      )}
      <details className="panel assertions">
        <summary>Avaliações e regras desta execução</summary>
        <div className="section-title">
          <h2>Avaliações</h2>
          <span className="subtle">
            {run.durationMs !== undefined
              ? `${run.durationMs.toFixed(1)} ms · duração total`
              : "Execução em andamento"}
          </span>
        </div>
        {run.result ? (
          run.result.assertions.map((assertion) => (
            <div className="assertion" key={assertion.name}>
              {assertion.passed ? (
                <Check className="positive" size={16} />
              ) : (
                <X className="negative" size={16} />
              )}
              <strong>{assertion.name}</strong>
              <span>
                Esperado <code>{JSON.stringify(assertion.expected)}</code>
              </span>
              <span>
                Observado <code>{JSON.stringify(assertion.actual)}</code>
              </span>
            </div>
          ))
        ) : (
          <p>
            As invariantes são avaliadas após o workload e a leitura do estado
            final.
          </p>
        )}
      </details>
      {firstViolation && (
        <div className="violation">
          <X size={18} />
          <div>
            <strong>
              Primeira violação observada no evento #{firstViolation.sequence}
            </strong>
            <p>Abra a request para inspecionar os eventos relacionados.</p>
          </div>
          <button
            onClick={() => {
              setRequestId(firstViolation.requestId ?? "");
              setTab("evidence");
            }}
          >
            Inspecionar request
          </button>
        </div>
      )}
      <div className="tabs" role="tablist">
        {[
          ["evidence", `Evidências (${evidence.length})`],
          ["requests", `Requests (${requests.length})`],
          ["state", "Estado e versão"],
        ].map(([key, label]) => (
          <button
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "active" : ""}
            key={key}
            onClick={() => setTab(key!)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "evidence" && (
        <section className="panel evidence-panel">
          <div className="section-title">
            <div>
              <h2>Sequência observada</h2>
              <p>
                Ordem de coleta no laboratório. Timestamps são os instantes
                reais de emissão.
              </p>
            </div>
            {requestId && (
              <button onClick={() => setRequestId("")}>
                Limpar filtro · {short(requestId)}
              </button>
            )}
          </div>
          <div className="evidence-list">
            {filtered.map((event) => (
              <details
                key={event.sequence}
                className={
                  event.type === "invariant.violated"
                    ? "event violation-event"
                    : "event"
                }
              >
                <summary>
                  <code className="event-number">{event.sequence}</code>
                  <code className="event-time">
                    +{event.timestamp - run.createdAt}ms
                  </code>
                  <strong>{event.type}</strong>
                  <span className="event-source">{event.source}</span>
                  <code>{short(event.requestId)}</code>
                </summary>
                <div className="event-detail">
                  {event.requestId && (
                    <button onClick={() => setRequestId(event.requestId!)}>
                      Filtrar esta request
                    </button>
                  )}
                  <pre>{JSON.stringify(event.payload, null, 2)}</pre>
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
      {tab === "requests" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Início</th>
                <th>Duração</th>
                <th>HTTP</th>
                <th>Resposta real</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => {
                        setRequestId(request.id);
                        setTab("evidence");
                      }}
                    >
                      <code>{short(request.id)}</code>
                    </button>
                  </td>
                  <td>+{request.startedAt - run.createdAt} ms</td>
                  <td>{request.durationMs.toFixed(1)} ms</td>
                  <td>{request.status ?? "Erro"}</td>
                  <td>
                    <details>
                      <summary>Inspecionar</summary>
                      <pre>
                        {JSON.stringify(request.error ?? request.body, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "state" && (
        <section className="panel">
          <h2>Proveniência do código</h2>
          <dl>
            <dt>Commit base ao carregar o runtime</dt>
            <dd>
              <code>{run.code.commit}</code>
            </dd>
            <dt>SHA-256 do código</dt>
            <dd>
              <code>{run.code.digest}</code>
            </dd>
            <dt>Snapshot em .bunkerlab</dt>
            <dd>
              <code>{run.code.snapshot}</code>
            </dd>
            <dt>Modificado ao carregar</dt>
            <dd>{run.code.dirty ? "Sim" : "Não"}</dd>
          </dl>
          <div className="two-columns">
            <div>
              <h3>Estado inicial</h3>
              <pre>{JSON.stringify(run.initialState ?? null, null, 2)}</pre>
            </div>
            <div>
              <h3>Estado final</h3>
              <pre>{JSON.stringify(run.finalState ?? null, null, 2)}</pre>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
