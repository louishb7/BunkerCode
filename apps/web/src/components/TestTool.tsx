import { useEffect, useState } from "react";
import { Link } from "react-router";
import type {
  ExperimentConfig,
  RunDetail,
  Workbench,
} from "@backendlab/protocol";
import { api } from "../api";
import { Drawer } from "./Drawer";
export function TestTool({
  bench,
  busy,
  close,
  completed,
}: {
  bench: Workbench;
  busy: boolean;
  close: () => void;
  completed: () => void;
}) {
  const definition = bench.experiments[0];
  const [config, setConfig] = useState<ExperimentConfig>(
    definition?.defaults ?? { clients: 20, concurrency: 20 },
  );
  const [detail, setDetail] = useState<RunDetail>();
  const [runId, setRunId] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!runId) return;
    let active = true;
    let timer: number;
    async function poll() {
      try {
        const next = await api.run(runId);
        if (!active) return;
        setDetail(next);
        if (next.run.status === "running") timer = window.setTimeout(poll, 500);
        else completed();
      } catch (cause) {
        if (active) setError(String(cause));
      }
    }
    void poll();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [runId, completed]);
  async function start() {
    setError("");
    setStarting(true);
    setDetail(undefined);
    try {
      const run = await api.start(definition!.id, config);
      setRunId(run.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setStarting(false);
    }
  }
  return (
    <Drawer title={`Testar ${bench.system.name}`} close={close}>
      {!definition ? (
        <p>Nenhuma ferramenta disponível para este sistema.</p>
      ) : (
        <>
          <h3>Concorrência</h3>
          <p>Execute a mesma operação com várias requests.</p>
          <form
            className="test-form"
            onSubmit={(event) => {
              event.preventDefault();
              void start();
            }}
          >
            <label>
              Operação
              <input
                readOnly
                value={definition.operationLabel ?? definition.name}
              />
            </label>
            {definition.fields?.map((field) => (
              <label key={field.key}>
                {field.label}
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  required
                  value={config[field.key]}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      [field.key]: Number(event.target.value),
                    })
                  }
                />
              </label>
            ))}
            <p className="subtle">
              Prepara um novo estado de runtime para esta execução. Código e
              histórico são preservados.
            </p>
            <button
              className="primary"
              disabled={
                busy ||
                starting ||
                (!!runId && !detail) ||
                detail?.run.status === "running"
              }
            >
              {starting || detail?.run.status === "running"
                ? "Executando…"
                : "Executar teste"}
            </button>
          </form>
          {error && (
            <p role="alert" className="negative">
              {error}
            </p>
          )}
          {detail && detail.run.status !== "running" && (
            <section className="test-result">
              <h3>Observado nesta execução</h3>
              {detail.run.result ? (
                <>
                  <div className="observation">
                    <strong>{detail.run.result.accepted}</strong>
                    <span>respostas de sucesso</span>
                  </div>
                  <div className="observation">
                    <strong>{detail.run.result.rejected}</strong>
                    <span>rejeitadas</span>
                  </div>
                  {detail.run.result.observations?.map((observation) => (
                    <div key={observation.key}>
                      <div className="observation">
                        <strong>
                          {observation.before !== undefined
                            ? `${observation.before} → `
                            : ""}
                          {observation.value}
                        </strong>
                        <span>{observation.label}</span>
                      </div>
                      {observation.note && (
                        <p className="negative">{observation.note}</p>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <p className="negative">
                  {detail.run.error ?? "Execução interrompida."}
                </p>
              )}
              <Link className="button" to={`/runs/${detail.run.id}`}>
                Investigar Run #{detail.run.number}
              </Link>
            </section>
          )}
        </>
      )}
    </Drawer>
  );
}
