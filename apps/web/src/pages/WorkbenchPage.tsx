import { useCallback, useEffect, useRef, useState } from "react";
import { Code2, FlaskConical, MoreHorizontal, RotateCcw } from "lucide-react";
import type {
  InvestigationContext,
  Run,
  RunDetail,
  Activity,
  ActivitySummary,
  Workbench,
} from "@backendlab/protocol";
import { api } from "../api";
import { Drawer } from "../components/Drawer";
import { SystemSurface } from "../components/SystemSurface";
import { ActivityInspector } from "../components/ActivityInspector";
import { Investigation } from "../components/Investigation";
import { TestTool } from "../components/TestTool";
import { short, type Action } from "../components/shared";

export function WorkbenchPage({
  bench,
  runs,
  busy,
  action,
  refresh,
}: {
  bench: Workbench;
  runs: Run[];
  busy: boolean;
  action: Action;
  refresh: () => Promise<void>;
}) {
  const [panel, setPanel] = useState<
    "code" | "runtime" | "test" | "reset" | "investigation" | null
  >(null);
  const storageKey = `bunkerlab.investigation.v1.${bench.workspace.id}.${bench.system.id}`;
  const [context, setContext] = useState<InvestigationContext | null>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      return value &&
        typeof value.baselineRunId === "string" &&
        typeof value.definitionId === "string" &&
        Array.isArray(value.comparisonRunIds) &&
        Number.isInteger(value.revealed) &&
        value.revealed >= 0 &&
        value.revealed <= 100
        ? value
        : null;
    } catch {
      return null;
    }
  });
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(`${storageKey}.dismissed`) ?? "",
  );
  const [candidate, setCandidate] = useState<RunDetail>();
  const latest = runs.find((run) => run.status !== "running");
  useEffect(() => {
    let active = true;
    if (latest)
      void api
        .run(latest.id)
        .then((detail) => {
          if (active) setCandidate(detail);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [latest?.id, latest?.status]);
  function updateContext(value: InvestigationContext) {
    setContext(value);
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* Mantém contexto em memória. */
    }
  }
  function investigate(detail: RunDetail) {
    const definition = detail.investigations?.find((item) => item.available);
    if (!definition) return;
    if (context?.baselineRunId !== detail.run.id)
      updateContext({
        definitionId: definition.id,
        baselineRunId: detail.run.id,
        comparisonRunIds: [],
        revealed: 0,
      });
    setPanel("investigation");
  }
  const suggestion = candidate?.investigations?.find((item) => item.available);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [inspection, setInspection] = useState("");
  const [showActivities, setShowActivities] = useState(false);
  const [surfaceError, setSurfaceError] = useState("");
  const [revision, setRevision] = useState(0);
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void api
      .open()
      .then(refresh)
      .catch((error) => setSurfaceError(error.message));
  }, [refresh]);
  const loadedVersion = `${bench.runtime.code?.snapshot ?? ""}/${bench.runtime.pid ?? ""}`;
  useEffect(() => {
    setSurfaceError("");
  }, [loadedVersion]);
  const completed = useCallback(() => {
    setRevision((value) => value + 1);
    void refresh();
  }, [refresh]);
  const onActivity = useCallback(
    (activity: Activity) => {
      setActivities((items) =>
        [activity, ...items.filter((item) => item.id !== activity.id)].slice(
          0,
          50,
        ),
      );
      if (activity.error) void refresh();
    },
    [refresh],
  );
  useEffect(() => {
    void api
      .activities()
      .then(setActivities)
      .catch(() => {});
  }, []);
  const latestActivity =
    activities.find((item) => item.method === "POST") ?? activities[0];
  const running = bench.runtime.status === "ready";
  const surfaceBlocked = busy && bench.busy !== "Interação com o sistema";
  const status = {
    ready: "Em execução",
    starting: "Iniciando",
    stopped: "Parado",
    crashed: "Indisponível",
  }[bench.runtime.status];
  const issue = surfaceError || bench.runtime.error;
  const issueSummary =
    issue
      ?.split("\n")
      .find((line) => /(?:Syntax|Type|Reference)?Error:/.test(line)) ??
    issue?.split("\n")[0];
  const changed =
    !!bench.runtime.code &&
    bench.runtime.code.digest !== bench.workingCode.digest;
  async function restart() {
    await action(async () => {
      await api.restart();
      setSurfaceError("");
      setRevision((value) => value + 1);
    }, "Runtime reiniciado.");
  }
  return (
    <div className="workbench">
      <div className="workbench-toolbar">
        <div className="workbench-title">
          <h1>{bench.system.name}</h1>
          <span className={`runtime-state ${running ? "is-running" : ""}`}>
            <i />
            {status}
          </span>
        </div>
        <div className="workbench-tools">
          <button onClick={() => setPanel("code")}>
            <Code2 size={16} />
            <span>Abrir código</span>
          </button>
          <button
            onClick={() => setPanel("test")}
            disabled={!bench.experiments.length}
          >
            <FlaskConical size={16} />
            <span>Testar</span>
          </button>
          <button disabled={busy} onClick={() => void restart()}>
            <RotateCcw size={16} />
            <span>Reiniciar</span>
          </button>
          <details className="toolbar-menu">
            <summary aria-label="Mais opções">
              <MoreHorizontal size={20} />
            </summary>
            <div>
              <button onClick={() => setPanel("runtime")}>
                Detalhes do runtime
              </button>
              <button onClick={() => setPanel("reset")}>Resetar estado</button>
            </div>
          </details>
        </div>
      </div>
      {changed && (
        <div className="code-change">
          <span>Alterações ainda não aplicadas</span>
          <button disabled={busy} onClick={() => void restart()}>
            Aplicar e reiniciar
          </button>
        </div>
      )}
      <div className="investigation-entry">
        {context && (
          <button
            className="text-button"
            onClick={() => setPanel("investigation")}
          >
            Retomar investigação
          </button>
        )}
        {suggestion &&
          candidate &&
          candidate.run.id !== dismissed &&
          candidate.run.id !== context?.baselineRunId &&
          !context?.comparisonRunIds.includes(candidate.run.id) && (
            <>
              <span>{suggestion.observation}</span>
              <button onClick={() => investigate(candidate)}>Investigar</button>
              <button
                className="text-button"
                onClick={() => {
                  setDismissed(candidate.run.id);
                  try {
                    localStorage.setItem(
                      `${storageKey}.dismissed`,
                      candidate.run.id,
                    );
                  } catch {
                    /* Sessão atual. */
                  }
                }}
              >
                Dispensar
              </button>
            </>
          )}
      </div>
      <section className="surface-space" aria-label="Sistema em execução">
        {running && !surfaceError && bench.system.surface ? (
          <>
            {!surfaceBlocked && (
              <SystemSurface
                surface={bench.system.surface}
                generation={`${loadedVersion}/${revision}`}
                disabled={false}
                onActivity={onActivity}
                onFailure={setSurfaceError}
              />
            )}
            {surfaceBlocked && (
              <div className="surface-busy">
                {bench.busy ?? "Aplicando alteração…"}
              </div>
            )}
          </>
        ) : (
          <div className="surface-unavailable">
            <h2>
              {bench.system.name}{" "}
              {bench.runtime.status === "starting"
                ? "está iniciando…"
                : "não está disponível."}
            </h2>
            {issue ? (
              <pre>{issueSummary}</pre>
            ) : (
              <p>
                {busy
                  ? "Preparando o runtime…"
                  : "Inicie o runtime para usar o sistema."}
              </p>
            )}
            <div>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void restart()}
              >
                <RotateCcw size={16} />
                {issue ? "Tentar reiniciar" : "Iniciar sistema"}
              </button>
              <button onClick={() => setPanel("runtime")}>Ver logs</button>
            </div>
          </div>
        )}
      </section>
      <div className="activity-bar">
        <button
          className="activity-toggle"
          onClick={() => setShowActivities(!showActivities)}
        >
          Atividade{activities.length ? ` · ${activities.length}` : ""}
        </button>
        {latestActivity ? (
          <>
            <code>
              {latestActivity.method} {latestActivity.path}
            </code>
            <span
              className={
                latestActivity.status === null || latestActivity.status >= 400
                  ? "negative"
                  : ""
              }
            >
              {latestActivity.status ?? "Sem resposta"}
            </span>
            <span className="subtle">
              {latestActivity.durationMs?.toFixed(1)} ms
            </span>
            <button
              className="text-button"
              onClick={() => setInspection(latestActivity.id)}
            >
              Inspecionar
            </button>
          </>
        ) : (
          <span className="subtle">Nenhuma interação nesta sessão.</span>
        )}
      </div>
      {showActivities && (
        <div className="activity-history">
          {activities.map((item) => (
            <button key={item.id} onClick={() => setInspection(item.id)}>
              <code>
                {item.method} {item.path}
              </code>
              <span>{item.status ?? "Sem resposta"}</span>
              <span>{item.durationMs?.toFixed(1)} ms</span>
            </button>
          ))}
        </div>
      )}
      {inspection && (
        <ActivityInspector id={inspection} close={() => setInspection("")} />
      )}
      {panel === "investigation" && context && (
        <Investigation
          bench={bench}
          context={context}
          update={updateContext}
          close={() => setPanel(null)}
          busy={busy}
          action={action}
          completed={completed}
        />
      )}
      {panel === "test" && (
        <TestTool
          bench={bench}
          busy={busy}
          close={() => setPanel(null)}
          completed={completed}
          investigate={investigate}
        />
      )}
      {panel === "code" && (
        <Drawer title="Abrir código" close={() => setPanel(null)}>
          <p>Abra esta pasta no VS Code ou no editor de sua preferência.</p>
          <div className="code-path">
            <code>{bench.codePath}</code>
          </div>
          <button
            className="primary"
            onClick={() =>
              void action(
                () => navigator.clipboard.writeText(bench.codePath),
                "Caminho copiado.",
              )
            }
          >
            Copiar caminho
          </button>
          <p className="subtle">
            Salve os arquivos e use Aplicar e reiniciar para carregar a mudança.
          </p>
        </Drawer>
      )}
      {panel === "runtime" && (
        <Drawer title="Detalhes do runtime" close={() => setPanel(null)}>
          <dl>
            <dt>Status</dt>
            <dd>{status}</dd>
            <dt>PID</dt>
            <dd>{bench.runtime.pid ?? "—"}</dd>
            <dt>Porta</dt>
            <dd>{bench.runtime.port ?? "—"}</dd>
            <dt>Código carregado</dt>
            <dd>
              <code>{short(bench.runtime.code?.digest)}</code>
            </dd>
            <dt>Código salvo</dt>
            <dd>
              <code>{short(bench.workingCode.digest)}</code>
            </dd>
          </dl>
          <h3>Logs do processo</h3>
          <pre>
            {bench.runtime.logs.join("\n") || "Nenhuma saída capturada."}
          </pre>
          {issue && <pre>{issue}</pre>}
        </Drawer>
      )}
      {panel === "reset" && (
        <Drawer title="Resetar estado" close={() => setPanel(null)}>
          <p>
            Isso restaura o estado de runtime. Código, checkpoints e histórico
            não serão alterados.
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await api.reset();
                setRevision((value) => value + 1);
                setSurfaceError("");
                setPanel(null);
              }, "Estado de runtime restaurado.")
            }
          >
            Confirmar reset
          </button>
        </Drawer>
      )}
    </div>
  );
}
