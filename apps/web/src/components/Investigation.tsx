import { useEffect, useState } from "react";
import { Link } from "react-router";
import type {
  InvestigationContext,
  InvestigationView,
  RunDetail,
  Workbench,
} from "@backendlab/protocol";
import { api } from "../api";
import { Drawer } from "./Drawer";
import type { Action } from "./shared";

export function Investigation({
  bench,
  context,
  update,
  close,
  busy,
  action,
  completed,
}: {
  bench: Workbench;
  context: InvestigationContext;
  update: (context: InvestigationContext) => void;
  close: () => void;
  busy: boolean;
  action: Action;
  completed: () => void;
}) {
  const [baseline, setBaseline] = useState<RunDetail>();
  const [comparison, setComparison] = useState<RunDetail>();
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const latestId = context.comparisonRunIds.at(-1);
  useEffect(() => {
    let active = true;
    void api
      .run(context.baselineRunId)
      .then((detail) => {
        if (active) setBaseline(detail);
      })
      .catch((cause) => {
        if (active) setError(String(cause));
      });
    return () => {
      active = false;
    };
  }, [context.baselineRunId]);
  useEffect(() => {
    if (!latestId) return;
    let active = true;
    let timer: number;
    async function poll() {
      try {
        const detail = await api.run(latestId!);
        if (!active) return;
        setComparison(detail);
        if (detail.run.status === "running")
          timer = window.setTimeout(poll, 500);
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
  }, [latestId, completed]);
  const definition = baseline?.investigations?.find(
    (item) => item.id === context.definitionId,
  );
  const after = comparison?.investigations?.find(
    (item) => item.id === context.definitionId,
  );
  const changed =
    bench.applyRequired ||
    bench.runtime.code?.digest !== bench.workingCode.digest;
  const revealed =
    context.guidanceRevision === definition?.guidanceRevision
      ? context.revealed
      : Math.min(context.revealed, 4);
  const [activeHint, setActiveHint] = useState<number | null>(null);
  const pending =
    starting ||
    comparison?.run.status === "running" ||
    (!!latestId && comparison?.run.id !== latestId);
  async function rerun() {
    if (!baseline) return;
    setStarting(true);
    setError("");
    try {
      const run = await api.start(
        baseline.run.experimentId,
        baseline.run.config,
      );
      setComparison(undefined);
      update({
        ...context,
        comparisonRunIds: [...context.comparisonRunIds, run.id],
      });
    } catch (cause) {
      setError(String(cause));
    } finally {
      setStarting(false);
    }
  }
  const reveal = () => {
    setActiveHint(revealed - 2);
    update({
      ...context,
      guidanceRevision: definition?.guidanceRevision,
      revealed: revealed + 1,
    });
  };
  return (
    <Drawer title={definition?.title ?? "Investigação"} close={close}>
      {error && (
        <p className="negative" role="alert">
          {error}
        </p>
      )}
      {!definition ? (
        <p>
          {baseline
            ? "A orientação desta Run não está disponível. O histórico continua acessível."
            : "Carregando evidências…"}
        </p>
      ) : (
        <>
          <p className="subtle">
            Referência inicial · Run #{baseline!.run.number}
          </p>
          <p>{definition.observation}</p>
          <Facts definition={definition} />
          {revealed === 0 && (
            <button className="primary" onClick={reveal}>
              Ver como isso aconteceu
            </button>
          )}
          {revealed >= 1 && (
            <section className="investigation-section">
              <h3>Evidência selecionada</h3>
              <p>{definition.evidenceNote}</p>
              {definition.evidenceTable && (
                <table className="evidence-comparison">
                  <thead>
                    <tr>
                      <th>Request</th>
                      {definition.evidenceTable.columns.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {definition.evidenceTable.rows.map((row) => (
                      <tr key={row.label}>
                        <th>{row.label}</th>
                        {row.cells.map((cell, index) => (
                          <td key={index} title={`Evento #${cell.sequence}`}>
                            {cell.value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <details className="evidence-source">
                <summary>Eventos de origem</summary>
                <ol className="focused-evidence">
                  {definition.evidence.map((item) => {
                    const event = baseline!.evidence.find(
                      (event) => event.sequence === item.sequence,
                    );
                    return (
                      event && (
                        <li key={item.sequence} data-sequence={event.sequence}>
                          <small>Evento #{event.sequence}</small>
                          <span>{item.label}</span>
                          <details>
                            <summary>Identificação</summary>
                            <code>{event.requestId}</code>
                            <pre>{JSON.stringify(event.payload, null, 2)}</pre>
                          </details>
                        </li>
                      )
                    );
                  })}
                </ol>
                <p className="subtle">
                  Ordem recebida pelo Lab; não representa um relógio global das
                  operações no banco.
                </p>
              </details>
              <Link to={`/runs/${baseline!.run.id}`}>
                Abrir Inspector completo
              </Link>
              <p className="investigation-question">{definition.question}</p>
              {revealed === 1 && (
                <button onClick={reveal}>Localizar no código</button>
              )}
            </section>
          )}
          {revealed >= 2 && (
            <section className="investigation-section">
              <h3>Onde observar no código</h3>
              {definition.files.map((file) => (
                <div key={file.path}>
                  <code>
                    {file.path} · {file.symbol}
                  </code>
                  <p>{file.description}</p>
                  <a
                    className="button"
                    href={`vscode://file${encodeURI(`${bench.codePath}/${file.path}`)}`}
                  >
                    Abrir código no VS Code
                  </a>
                  <details>
                    <summary>Caminho do arquivo</summary>
                    <code className="code-path">
                      {bench.codePath}/{file.path}
                    </code>
                    <button
                      onClick={() =>
                        void action(
                          () =>
                            navigator.clipboard.writeText(
                              `${bench.codePath}/${file.path}`,
                            ),
                          "Caminho copiado.",
                        )
                      }
                    >
                      Copiar caminho
                    </button>
                  </details>
                </div>
              ))}
              {bench.runtime.code?.digest !== baseline!.run.code.digest && (
                <p className="subtle">
                  O runtime atual usa outra versão. A evidência acima pertence
                  ao snapshot da baseline.
                </p>
              )}
              <div className="investigation-checkpoint">
                {context.checkpointId ? (
                  <p>Checkpoint da tentativa salvo.</p>
                ) : (
                  <button
                    disabled={busy || pending}
                    onClick={() =>
                      void action(async () => {
                        const checkpoint = await api.checkpoint(
                          `${definition.checkpointName} · Run #${baseline!.run.number}`,
                        );
                        update({ ...context, checkpointId: checkpoint.id });
                      }, "Checkpoint da tentativa salvo.")
                    }
                  >
                    Salvar checkpoint antes da tentativa
                  </button>
                )}
                <small>
                  Opcional. Salva os arquivos atuais, não o banco ou o snapshot
                  da baseline.
                </small>
              </div>
              {definition.hints
                .slice(0, Math.max(0, revealed - 2))
                .map((hint, index) => (
                  <details
                    className="investigation-hint"
                    key={hint.title}
                    open={
                      activeHint === null
                        ? index === revealed - 3
                        : index === activeHint
                    }
                  >
                    <summary
                      onClick={(event) => {
                        event.preventDefault();
                        const current =
                          activeHint === null ? revealed - 3 : activeHint;
                        setActiveHint(current === index ? -1 : index);
                      }}
                    >
                      {hint.title}
                    </summary>
                    <p>{hint.text}</p>
                  </details>
                ))}
              {revealed - 2 < definition.hints.length && (
                <button onClick={reveal}>
                  {revealed < 4
                    ? `Pedir pista ${revealed - 1}`
                    : definition.hints[revealed - 2]!.title}
                </button>
              )}
              <div className="investigation-section">
                {changed || bench.runtime.status !== "ready" ? (
                  <>
                    <p>
                      {changed
                        ? "Alterações ainda não aplicadas"
                        : "Runtime indisponível. Aplique o código para tentar iniciar."}
                    </p>
                    <button
                      disabled={busy || pending}
                      onClick={() =>
                        void action(async () => {
                          await api.restart();
                          completed();
                        }, "Código salvo carregado. Runtime reiniciado.")
                      }
                    >
                      Aplicar e reiniciar
                    </button>
                  </>
                ) : (
                  <p className="subtle">
                    O sistema está executando o código salvo.
                  </p>
                )}
              </div>
            </section>
          )}
          <section className="investigation-section">
            <h3>Repetir nas mesmas condições</h3>
            <p className="subtle">
              O teste prepara novamente o mesmo estado inicial.
            </p>
            <details>
              <summary>Condições da referência</summary>
              <dl>
                {Object.entries(baseline!.run.config).map(([key, value]) => (
                  <div key={key}>
                    <dt>
                      {bench.experiments
                        .find((item) => item.id === baseline!.run.experimentId)
                        ?.fields?.find((field) => field.key === key)?.label ??
                        key}
                    </dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </details>
            {changed && (
              <p className="subtle">
                Aplique o código salvo antes de comparar uma nova versão.
              </p>
            )}
            <button
              disabled={
                busy || pending || changed || bench.runtime.status !== "ready"
              }
              onClick={() => void rerun()}
            >
              {pending ? "Executando…" : "Executar novamente"}
            </button>
          </section>
          {comparison && !pending && comparison.run.status !== "running" && (
            <section
              className="investigation-section"
              aria-label="Comparação da investigação"
            >
              <h3>Antes e depois</h3>
              <p>
                Run #{baseline!.run.number} → Run #{comparison.run.number}
              </p>
              {after ? (
                <>
                  <table className="investigation-comparison">
                    <thead>
                      <tr>
                        <th>Observação</th>
                        <th>Antes</th>
                        <th>Depois</th>
                      </tr>
                    </thead>
                    <tbody>
                      {definition.facts.map((fact) => (
                        <tr key={fact.key}>
                          <td>{fact.label}</td>
                          <td>{fact.value}</td>
                          <td>
                            {after.facts.find((item) => item.key === fact.key)
                              ?.value ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p>{after.observation}</p>
                  {!!after.concerns?.length && (
                    <div className="comparison-concerns">
                      <h4>Outros comportamentos nesta tentativa</h4>
                      {after.concerns.map((concern) => (
                        <p key={concern}>{concern}</p>
                      ))}
                    </div>
                  )}
                  <p className="subtle">
                    Uma execução não prova que o comportamento será o mesmo em
                    todas as condições.
                  </p>
                </>
              ) : (
                <p className="negative">
                  {comparison.run.error ??
                    "Esta execução não produziu observações suficientes para comparar."}
                </p>
              )}
              <p className="subtle">
                {comparison.run.code.digest === baseline!.run.code.digest
                  ? "Mesmo código da referência inicial."
                  : "Código diferente da referência inicial."}{" "}
                {context.comparisonRunIds.length} tentativa(s) nesta
                investigação.
              </p>
              <Link to={`/runs/${comparison.run.id}`}>
                Inspecionar nova Run
              </Link>
            </section>
          )}
        </>
      )}
    </Drawer>
  );
}
function Facts({ definition }: { definition: InvestigationView }) {
  return (
    <dl className="investigation-facts">
      {definition.facts.map((fact) => (
        <div key={fact.key}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
