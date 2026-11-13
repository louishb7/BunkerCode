import { useAuth } from "../auth/Auth";
import { apiFetch, localIdentityScope } from "../auth/session";
import { learningRequest, learningLessonPath } from "../learning/api";
import { SQL_LIMITS, parseSqlSteps } from "@bunkercode/content/sql";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CodeEditor } from "../practice/CodeEditor";
import {
  sqlSessionKey,
  type SqlExercise,
  type SqlResult,
  type SqlLessonTask,
} from "./exercise";
import { SqlRuntime, SqlRuntimeError, sqlRuntimeFeedback } from "./sql-runtime";
import { SqlTable } from "./SqlTable";
import { useSqlTasks } from "./useSqlTasks";
import { SqlTaskProgress, type SqlContinuation } from "./SqlTaskProgress";
import "./sql-lab.css";

// Public formative feedback never authorizes persistent completion.
export function SqlInteraction({
  exercise,
  lessonAppearance = false,
  previewOnly = false,
  lesson,
  tasks,
  continuation,
  taskTarget,
}: {
  exercise: SqlExercise;
  lessonAppearance?: boolean;
  previewOnly?: boolean;
  lesson?: { courseId: string; lessonSlug: string; onCompleted: () => void };
  tasks?: readonly SqlLessonTask[];
  continuation?: SqlContinuation;
  taskTarget?: HTMLElement | null;
}) {
  return (
    <InteractionSession
      key={
        tasks
          ? JSON.stringify(
              tasks.map((task) => [
                task.taskId,
                task.exercise.id,
                task.exercise.version,
              ]),
            )
          : sqlSessionKey(exercise)
      }
      exercise={exercise}
      lessonAppearance={lessonAppearance}
      previewOnly={previewOnly}
      lesson={lesson}
      tasks={tasks}
      continuation={continuation}
      taskTarget={taskTarget}
    />
  );
}

function InteractionSession({
  exercise: configuration,
  lessonAppearance,
  previewOnly,
  lesson,
  tasks: configuredTasks,
  continuation,
  taskTarget,
}: {
  exercise: SqlExercise;
  lessonAppearance: boolean;
  previewOnly: boolean;
  lesson?: { courseId: string; lessonSlug: string; onCompleted: () => void };
  tasks?: readonly SqlLessonTask[];
  continuation?: SqlContinuation;
  taskTarget?: HTMLElement | null;
}) {
  const { user } = useAuth();
  const steps = useRef<string[]>([]);
  const request = useRef<AbortController | null>(null);
  // Snapshot once per explicit identity/version, independent of parent references.
  const [initial] = useState(() => ({
    exercise: configuration,
    tasks: configuredTasks,
  }));
  const progress = useSqlTasks(initial.exercise, initial.tasks);
  const { exercise, tasks } = progress;
  const localAssessment = exercise.mode === "query" && !!exercise.formative;
  const [sql, setSql] = useState(exercise.starterSql);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SqlResult | null>(null);
  const [visualization, setVisualization] = useState<"data" | "result">("data");
  const [executed, setExecuted] = useState<{
    sql: string;
    taskId: string;
  } | null>(null);
  const [message, setMessage] = useState(
    "Os dados iniciais serão carregados ao executar uma consulta.",
  );
  const [table, setTable] = useState(exercise.schema[0]?.name ?? "");
  const [preview, setPreview] = useState<SqlResult | null>(null);
  const [previewMessage, setPreviewMessage] = useState(
    "Selecione uma tabela e veja até 10 registros reais.",
  );
  const [approved, setApproved] = useState<string[] | null>(null);
  const [recoveryError, setRecoveryError] = useState("");
  const tableId = useId();
  const runtime = useRef<SqlRuntime | null>(null);
  const revision = useRef(0);
  const generation = useRef(0);
  const running = useRef(false);
  const helpId = useId();
  const titleId = useId();
  const resultsId = useId();

  useEffect(() => {
    const current = new SqlRuntime(initial.exercise);
    runtime.current = current;
    setSql(initial.exercise.starterSql);
    setResult(null);
    setBusy(false);
    setMessage("Os dados iniciais serão carregados ao executar uma consulta.");
    return () => {
      generation.current++;
      running.current = false;
      current.dispose();
      request.current?.abort();
      runtime.current = null;
    };
  }, [initial]);

  useEffect(() => {
    const reset = () => {
      generation.current++;
      runtime.current?.dispose();
      request.current?.abort();
      steps.current = [];
      running.current = false;
      setBusy(false);
      setApproved(null);
      setSql(progress.restart());
      setExecuted(null);
      setResult(null);
      setPreview(null);
      setMessage(
        "Conta alterada. O banco e a solução desta sessão foram descartados.",
      );
    };
    window.addEventListener("bunkercode-identity-change", reset);
    return () =>
      window.removeEventListener("bunkercode-identity-change", reset);
  }, [initial]);
  useEffect(() => {
    setApproved(null);
    setRecoveryError("");
    if (!user || !lesson || tasks) return;
    const abort = new AbortController();
    const owner = user.id;
    void learningRequest(
      learningLessonPath(lesson.courseId, lesson.lessonSlug) + "/solution",
      abort.signal,
    )
      .then((value) => {
        if (abort.signal.aborted || localIdentityScope() !== owner) return;
        if (!value || typeof value !== "object" || !("solution" in value))
          throw new Error("Solução aprovada incompatível.");
        if (value.solution) {
          const solution = value.solution;
          if (
            typeof solution !== "object" ||
            !("source" in solution) ||
            typeof solution.source !== "string"
          )
            throw new Error("Solução aprovada incompatível.");
          const stored: unknown = JSON.parse(solution.source);
          if (
            !stored ||
            typeof stored !== "object" ||
            !("format" in stored) ||
            stored.format !== 1 ||
            !("steps" in stored)
          )
            throw new Error("Solução aprovada incompatível.");
          setApproved(parseSqlSteps(stored.steps));
        }
      })
      .catch(() => {
        if (!abort.signal.aborted && localIdentityScope() === owner)
          setRecoveryError(
            "Não foi possível consultar a solução aprovada. Recarregue para tentar novamente.",
          );
      });
    return () => abort.abort();
  }, [
    user?.id,
    lesson?.courseId,
    lesson?.lessonSlug,
    exercise.id,
    exercise.version,
    tasks,
  ]);
  const discard = (cancel: boolean) => {
    generation.current++;
    runtime.current?.dispose();
    request.current?.abort();
    steps.current = [];
    running.current = false;
    setBusy(false);
    setResult(null);
    setPreview(null);
    setPreviewMessage(
      "O banco foi descartado. Abra os registros para recriá-lo.",
    );
    setMessage(
      cancel
        ? "Consulta cancelada e ambiente descartado. Os dados iniciais serão recriados na próxima execução."
        : "Banco descartado. Os dados iniciais serão recriados na próxima execução." +
            (tasks
              ? " As consultas e os acertos formativos foram preservados."
              : ""),
    );
  };
  const run = async () => {
    if (running.current || !runtime.current) return;
    if (
      exercise.mode === "mutation" &&
      steps.current.length >= SQL_LIMITS.steps
    ) {
      setMessage(
        "Limite de 20 passos. Reinicie o banco para preparar uma solução menor.",
      );
      return;
    }
    try {
      parseSqlSteps(
        exercise.mode === "mutation" ? [...steps.current, sql] : [sql],
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "SQL acima dos limites.",
      );
      return;
    }
    running.current = true;
    const currentGeneration = ++generation.current;
    const submittedTask = progress.active.current;
    const submittedRevision = revision.current;
    setBusy(true);
    setResult(null);
    setMessage(
      exercise.mode === "mutation"
        ? "Executando comando…"
        : "Executando consulta…",
    );
    try {
      const value = await runtime.current.execute(sql, exercise.formative);
      if (
        exercise.mode === "mutation" &&
        currentGeneration === generation.current
      ) {
        steps.current.push(sql);
        setPreview(null);
        setPreviewMessage(
          "Comando aplicado. Abra os registros para ver o estado atual.",
        );
      }
      if (
        currentGeneration !== generation.current ||
        submittedTask !== progress.active.current
      )
        return;
      if (exercise.mode === "query" && submittedRevision !== revision.current) {
        setMessage(
          "A consulta mudou durante a execução. Execute novamente para ver o resultado atual.",
        );
        return;
      }
      setResult(value);
      setVisualization("result");
      setExecuted({ sql, taskId: submittedTask });
      if (tasks && value.correct === true) {
        const next = progress.complete(submittedTask);
        if (next) {
          revision.current++;
          setSql(progress.select(next.taskId, sql));
          setMessage(
            `Tarefa ${progress.index + 1} concluída. Tarefa ${tasks.findIndex((task) => task.taskId === next.taskId) + 1} ativa; o texto atual ainda não foi executado. O resultado abaixo pertence à tarefa concluída.`,
          );
        } else
          setMessage(
            "Todas as tarefas foram concluídas nesta prática local. Nenhuma conclusão foi registrada na conta.",
          );
        return;
      }
      setMessage(
        exercise.mode === "mutation"
          ? `Comando concluído. ${value.affectedRows ?? 0} ${value.affectedRows === 1 ? "linha afetada" : "linhas afetadas"}. ${steps.current.length} ${steps.current.length === 1 ? "passo" : "passos"} na solução desta sessão.${submittedRevision !== revision.current ? " O texto do editor mudou durante a execução e ainda não foi executado." : ""}`
          : value.correct === true
            ? "Resposta correta nesta prática! Feedback local; nenhuma conclusão foi registrada."
            : value.correct === false
              ? "Consulta executada. Ainda não corresponde ao resultado esperado. Confira colunas, tipos, linhas e ordem."
              : "Consulta concluída.",
      );
    } catch (error: unknown) {
      if (
        currentGeneration !== generation.current ||
        submittedTask !== progress.active.current
      )
        return;
      if (
        exercise.mode === "query" &&
        submittedRevision !== revision.current &&
        error instanceof SqlRuntimeError &&
        !error.discarded
      ) {
        setMessage(
          "A consulta mudou durante a execução. Execute novamente para ver o resultado atual.",
        );
        return;
      }
      if (error instanceof SqlRuntimeError && error.discarded) {
        steps.current = [];
        setPreview(null);
        setPreviewMessage(error.message);
      }
      if (error instanceof SqlRuntimeError)
        setMessage(sqlRuntimeFeedback(error));
      else
        setMessage(
          "Não foi possível executar a consulta. Reinicie o banco e tente novamente.",
        );
    } finally {
      if (currentGeneration === generation.current) {
        running.current = false;
        setBusy(false);
      }
    }
  };
  const assess = async (submit: boolean) => {
    if (tasks) return;
    if (running.current) return;
    if (!user) {
      setMessage(
        "Verificação anônima indisponível nesta instalação. Executar e explorar continuam disponíveis sem login.",
      );
      return;
    }
    if (submit && !lesson) return;
    let submitted: string[];
    try {
      submitted = parseSqlSteps(
        exercise.mode === "mutation" ? steps.current : [sql],
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Execute os passos antes de verificar.",
      );
      return;
    }
    running.current = true;
    setBusy(true);
    const epoch = ++generation.current;
    const edited = revision.current;
    const abort = new AbortController();
    request.current = abort;
    setMessage(
      submit
        ? "Avaliando e registrando conclusão…"
        : "Verificando no servidor isolado…",
    );
    try {
      const response = await apiFetch(
        "/api/sql/" + (submit ? "submit" : "check"),
        {
          method: "POST",
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(45000)]),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exerciseId: exercise.id,
            version: exercise.version,
            steps: submitted,
            ...(lesson
              ? { courseId: lesson.courseId, lessonSlug: lesson.lessonSlug }
              : {}),
          }),
        },
      );
      const value: unknown = await response.json();
      if (epoch !== generation.current) return;
      if (!response.ok)
        throw new Error(
          value &&
            typeof value === "object" &&
            "message" in value &&
            typeof value.message === "string"
            ? value.message
            : "Verificação não confirmada. Tente novamente.",
        );
      if (
        !value ||
        typeof value !== "object" ||
        !("passed" in value) ||
        typeof value.passed !== "boolean"
      )
        throw new Error("Verificação sem confirmação.");
      const editorChanged = edited !== revision.current;
      const mutationNote =
        exercise.mode === "mutation"
          ? ` A avaliação considera somente o estado dos comandos executados.${editorChanged ? " O texto do editor mudou e ainda não foi executado." : ""}`
          : "";
      if (submit && value.passed) {
        if (!("completed" in value) || value.completed !== true)
          throw new Error(
            "Resposta verificada, mas a conclusão não foi confirmada.",
          );
        setApproved(submitted);
        lesson?.onCompleted();
        setMessage(
          exercise.mode === "query" && edited !== revision.current
            ? "A consulta enviada foi aprovada e a conclusão registrada. O texto do editor mudou depois do envio."
            : "Resposta verificada. Conclusão da lição registrada." +
                mutationNote,
        );
      } else if (exercise.mode === "query" && edited !== revision.current)
        setMessage(
          "A consulta mudou durante a verificação. Verifique a versão atual.",
        );
      else
        setMessage(
          (value.passed
            ? "Resposta correta! Verificada no servidor. Nenhuma conclusão foi registrada por esta verificação."
            : exercise.mode === "mutation"
              ? "O estado ainda não corresponde ao esperado. Confira todas as linhas e tabelas."
              : "Ainda não corresponde ao resultado esperado. Confira as colunas e as linhas.") +
            mutationNote,
        );
    } catch (error) {
      if (epoch === generation.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "Serviço indisponível. Nenhuma conclusão confirmada.",
        );
    } finally {
      if (epoch === generation.current) {
        running.current = false;
        setBusy(false);
        request.current = null;
      }
    }
  };
  const restore = async () => {
    if (!approved || running.current || !runtime.current) return;
    if (exercise.mode === "query") {
      revision.current++;
      setResult(null);
      setSql(approved[0]!);
      setMessage(
        "Solução aprovada carregada no editor. Execute para inspecionar.",
      );
      return;
    }
    discard(false);
    running.current = true;
    setBusy(true);
    const epoch = ++generation.current;
    setMessage("Reproduzindo os passos aprovados no banco local…");
    try {
      for (const sql of approved) {
        await runtime.current.execute(sql);
        if (epoch !== generation.current) return;
        steps.current.push(sql);
      }
      setSql(approved.at(-1)!);
      setMessage(
        "Solução aprovada reproduzida. Abra os registros para inspecionar o estado.",
      );
    } catch (error) {
      if (epoch === generation.current) {
        runtime.current.dispose();
        steps.current = [];
        setMessage(
          error instanceof Error
            ? error.message
            : "Falha ao reproduzir solução. Ambiente descartado.",
        );
      }
    } finally {
      if (epoch === generation.current) {
        running.current = false;
        setBusy(false);
      }
    }
  };
  const explore = useCallback(async () => {
    if (running.current || !runtime.current) return;
    running.current = true;
    const currentGeneration = ++generation.current;
    setBusy(true);
    setPreviewMessage("Carregando registros…");
    try {
      const value = await runtime.current.preview(table);
      if (currentGeneration !== generation.current) return;
      setPreview(value);
      setVisualization("data");
      setPreviewMessage(
        value.truncated
          ? "Primeiros 10 registros; há mais linhas."
          : `${value.rows.length} registros na prévia.`,
      );
    } catch (error) {
      if (currentGeneration !== generation.current) return;
      setPreview(null);
      setPreviewMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os registros.",
      );
      if (error instanceof SqlRuntimeError && error.discarded) {
        steps.current = [];
        setResult(null);
        setMessage(error.message);
      }
    } finally {
      if (currentGeneration === generation.current) {
        running.current = false;
        setBusy(false);
      }
    }
  }, [table]);
  useEffect(() => {
    // Only the known sample-table read is automatic; learner SQL requires Run.
    if (lessonAppearance) void explore();
  }, [lessonAppearance, explore]);
  const selectTask = (taskId: string) => {
    if (taskId === progress.active.current) return;
    revision.current++;
    setSql(progress.select(taskId, sql));
    setResult(null);
    setMessage(
      "Tarefa selecionada. O texto atual ainda não foi executado; os acertos anteriores permanecem nesta sessão.",
    );
  };
  const restartTasks = () => {
    discard(false);
    revision.current++;
    setSql(progress.restart());
    setExecuted(null);
    setMessage(
      "Sequência recomeçada: acertos e consultas desta sessão foram apagados; os dados iniciais serão recriados ao executar.",
    );
  };
  if (lessonAppearance) {
    const showingResult = visualization === "result" && !!result;
    const feedback = busy
      ? "Executando…"
      : message.startsWith("Tarefa ") && message.includes("concluída")
        ? message.split(" ativa;")[0] + " ativa. Execute a nova consulta."
        : message.startsWith("Todas as tarefas")
          ? "Todas as tarefas foram concluídas nesta prática."
          : message.startsWith("Consulta alterada")
            ? "Consulta alterada. Execute para atualizar."
            : message.startsWith("Tarefa selecionada")
              ? "Tarefa selecionada."
              : message.startsWith("Os dados iniciais")
                ? "Escreva uma consulta e execute."
                : message.startsWith("Resposta correta")
                  ? "Consulta correta."
                  : message.startsWith("Consulta executada. Ainda")
                    ? "Ainda não corresponde à tarefa. Confira colunas, linhas e ordem."
                    : message;
    const select = (taskId: string) => {
      selectTask(taskId);
      if (window.matchMedia("(max-width: 999px)").matches)
        document.getElementById(titleId)?.scrollIntoView({ block: "start" });
    };
    const panel = (
      <div className="sql-learning-tasks">
        {tasks && (
          <SqlTaskProgress
            tasks={tasks}
            activeId={progress.active.current}
            completed={progress.completed}
            notice=""
            onSelect={select}
            continuation={continuation}
            compact
          />
        )}
        <div className="sql-current-task">
          <h3>{exercise.title}</h3>
          <p>{exercise.instructions}</p>
        </div>
        <p className="sql-practice-scope">
          Prática desta sessão; os acertos não registram conclusão na conta.
        </p>
      </div>
    );
    return (
      <div className="sql-interaction sql-lesson sql-minimal sql-workspace">
        {taskTarget && createPortal(panel, taskTarget)}
        <section
          className="sql-visualization"
          aria-label="Visualização do banco"
          aria-busy={busy}
        >
          <div className="sql-data-toolbar">
            <button
              type="button"
              aria-pressed={!showingResult}
              disabled={busy}
              onClick={() => {
                setVisualization("data");
                void explore();
              }}
            >
              Dados
            </button>
            <button
              type="button"
              aria-pressed={showingResult}
              disabled={busy || !result}
              onClick={() => setVisualization("result")}
            >
              Resultado
            </button>
            {!showingResult && (
              <label>
                Tabela
                <select
                  aria-label="Tabela"
                  value={table}
                  disabled={busy}
                  onChange={(event) => setTable(event.target.value)}
                >
                  {exercise.schema.map((entry) => (
                    <option key={entry.name}>{entry.name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {showingResult ? (
            <>
              <p className="sql-data-caption sql-executed-task">
                {executed && tasks
                  ? `Resultado da tarefa ${tasks.findIndex((task) => task.taskId === executed.taskId) + 1}`
                  : "Resultado da consulta"}{" "}
                · {result.rows.length} linhas
                {result.truncated
                  ? ` (limite de ${exercise.limits.maxRows})`
                  : ""}
              </p>
              {result.fields.length ? (
                <SqlTable result={result} label="Resultado da consulta" />
              ) : (
                <p>{result.affectedRows ?? 0} linhas alteradas.</p>
              )}
            </>
          ) : preview ? (
            <>
              <p className="sql-data-caption">
                {table} · {preview.rows.length} registros
                {preview.truncated ? " (primeiros 10)" : ""}
              </p>
              <SqlTable
                result={preview}
                label={`Registros de ${table}`}
                context="table"
              />
            </>
          ) : (
            <p>{busy ? "Carregando dados…" : previewMessage}</p>
          )}
        </section>
        <section className="sql-query-editor" aria-labelledby={titleId}>
          <h2 id={titleId}>Sua consulta</h2>
          <p id={helpId} className="sr-only">
            Use Tab para indentar; Esc e Tab movem o foco para fora do editor.
          </p>
          <div className="sql-editor">
            <CodeEditor
              code={sql}
              language="sql"
              label="Consulta SQL"
              variant="example"
              lessonAppearance
              keyboardHelpId={helpId}
              onChange={(value) => {
                if (value === sql) return;
                revision.current++;
                setSql(value);
                progress.remember(value);
                setMessage("Consulta alterada. Execute para atualizar.");
              }}
              formatRequest={0}
              onFormatState={() => undefined}
            />
          </div>
          <div className="sql-actions">
            <button
              type="button"
              className="sql-primary"
              aria-disabled={busy}
              onClick={() => void run()}
            >
              {exercise.mode === "mutation"
                ? "Executar comando"
                : "Executar consulta"}
            </button>
            {busy && (
              <button type="button" onClick={() => discard(true)}>
                Cancelar e descartar
              </button>
            )}
          </div>
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sql-feedback"
          >
            {feedback}
          </p>
          {recoveryError && <p role="alert">{recoveryError}</p>}
          <details className="sql-secondary-actions">
            <summary>Opções da prática</summary>
            <button
              type="button"
              onClick={() => {
                revision.current++;
                setSql("");
                progress.remember("");
                setResult(null);
                setMessage(
                  "Consulta limpa; os acertos anteriores foram preservados.",
                );
              }}
            >
              Limpar consulta
            </button>
            <button type="button" onClick={() => discard(false)}>
              Reiniciar banco
            </button>
            {tasks && (
              <button type="button" onClick={restartTasks}>
                Recomeçar tarefas
              </button>
            )}
            {!previewOnly && !localAssessment && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void assess(false)}
              >
                {exercise.mode === "mutation"
                  ? "Verificar estado"
                  : "Verificar resposta"}
              </button>
            )}
            {lesson && user && !tasks && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void assess(true)}
              >
                Submit · concluir lição
              </button>
            )}
            {approved && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void restore()}
              >
                Carregar solução aprovada
              </button>
            )}
          </details>
        </section>
      </div>
    );
  }
  return (
    <div className={`sql-interaction ${lessonAppearance ? "sql-lesson" : ""}`}>
      <p className="sql-notice">
        {tasks ? (
          "Os acertos são locais e valem nesta sessão; não registram conclusão na conta."
        ) : (
          <>
            O banco existe apenas nesta sessão de prática. Cancelar ou reiniciar
            descarta o ambiente.{" "}
            {exercise.mode === "mutation"
              ? "Use um único SELECT, INSERT, UPDATE ou DELETE por execução. Alterações se acumulam nesta sessão descartável. Verificar e Submit reproduzem, em outro banco, os comandos executados com sucesso desde o último reinício (até 20 passos e 16 KiB). O texto ainda não executado não é enviado."
              : "Use uma única consulta SELECT por vez; múltiplos comandos e comandos como EXPLAIN não são aceitos."}
          </>
        )}
      </p>
      <div className="sql-layout">
        <aside className="sql-schema" aria-label="Tabelas disponíveis">
          <details open={!lessonAppearance}>
            <summary>Dados disponíveis</summary>
            <p>{exercise.schemaNote}</p>
            <label htmlFor={tableId}>Tabela</label>
            <select
              id={tableId}
              value={table}
              disabled={busy}
              onChange={(event) => {
                setTable(event.target.value);
                setPreview(null);
                setPreviewMessage("Abra os registros desta tabela.");
              }}
            >
              {exercise.schema.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
            <ul>
              {exercise.schema
                .find((item) => item.name === table)
                ?.columns.map((column) => (
                  <li key={column.name}>
                    <code>{column.name}</code> · {column.type}
                    {column.primaryKey && " · chave primária"}
                    {column.references &&
                      ` · referência a ${column.references}`}
                  </li>
                ))}
            </ul>
            <button
              type="button"
              disabled={busy || !table}
              onClick={() => void explore()}
            >
              Ver registros
            </button>
            <div aria-busy={busy}>
              <p className="sql-preview-status" role="status">
                {previewMessage}
              </p>
              {preview && (
                <SqlTable
                  result={preview}
                  label={`Registros de ${table}`}
                  context="table"
                />
              )}
            </div>
          </details>
          {!tasks && (
            <button type="button" onClick={() => discard(false)}>
              Reiniciar banco
            </button>
          )}
        </aside>
        <div className="sql-workspace">
          {tasks && (
            <SqlTaskProgress
              tasks={tasks}
              activeId={progress.active.current}
              completed={progress.completed}
              notice={progress.notice}
              onSelect={selectTask}
              continuation={continuation}
            />
          )}
          <section className="sql-challenge">
            {tasks && (
              <p className="sql-local-feedback">
                Tarefa {progress.index + 1} de {tasks.length}
                {progress.completed.has(progress.active.current)
                  ? " · já concluída nesta sessão"
                  : ""}
              </p>
            )}
            <h2>{exercise.title}</h2>
            <p className="sql-local-feedback">Objetivo: {exercise.objective}</p>
            <p>{exercise.instructions}</p>
            <p className="sql-local-feedback">
              {tasks ? (
                "Executar compara automaticamente a tarefa ativa neste navegador. A conclusão verificada desta lição ainda não está disponível."
              ) : previewOnly ? (
                "Prévia local do rascunho. Teste a referência e publique pela barra de autoria; esta prévia não registra conclusão."
              ) : localAssessment ? (
                <>
                  Executar compara o resultado automaticamente neste navegador,
                  sem login. O resultado esperado é material didático público.{" "}
                  {lesson && user
                    ? "Submit avalia independentemente no servidor e registra a conclusão quando aprovado."
                    : "O feedback local não salva progresso na conta."}
                </>
              ) : !user ? (
                "Executar e explorar estão disponíveis sem login. A verificação anônima está indisponível nesta instalação."
              ) : (
                <>
                  Executar usa o banco local. Verificar consulta o servidor sem
                  registrar conclusão.
                  {lesson &&
                    user &&
                    " Submit avalia novamente e registra a conclusão quando aprovado."}
                </>
              )}
            </p>
          </section>
          <section aria-labelledby={titleId}>
            <h2 id={titleId}>
              {exercise.mode === "mutation" ? "Seu comando" : "Sua consulta"}
            </h2>
            {recoveryError && <p role="status">{recoveryError}</p>}
            <p id={helpId}>
              Use Tab para indentar; Esc e Tab movem o foco para fora do editor.
            </p>
            <div className="sql-editor">
              <CodeEditor
                code={sql}
                language="sql"
                label="Consulta SQL"
                variant="example"
                lessonAppearance={lessonAppearance}
                siteAppearance={!lessonAppearance}
                keyboardHelpId={helpId}
                onChange={(value) => {
                  if (value === sql) return;
                  revision.current++;
                  setSql(value);
                  progress.remember(value);
                  if (exercise.mode === "query") {
                    setResult(null);
                    setMessage(
                      localAssessment
                        ? "Consulta alterada. Execute novamente para receber feedback do texto atual."
                        : "Consulta alterada. Execute ou verifique novamente.",
                    );
                  } else
                    setMessage(
                      "Texto alterado e ainda não executado. O banco mantém os comandos já executados; verificar considera esse estado, sem aprovar o novo texto.",
                    );
                }}
                formatRequest={0}
                onFormatState={() => undefined}
              />
            </div>
            <div className="sql-actions">
              <button
                type="button"
                className="sql-primary"
                disabled={!tasks && busy}
                aria-disabled={tasks ? busy : undefined}
                onClick={() => void run()}
              >
                {exercise.mode === "mutation"
                  ? "Executar comando"
                  : "Executar consulta"}
              </button>
              {!previewOnly && !localAssessment && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void assess(false)}
                >
                  {exercise.mode === "mutation"
                    ? "Verificar estado"
                    : "Verificar resposta"}
                </button>
              )}
              {approved && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void restore()}
                >
                  {exercise.mode === "query"
                    ? "Carregar solução aprovada"
                    : "Reproduzir solução aprovada"}
                </button>
              )}
              {lesson && user && !tasks && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void assess(true)}
                >
                  Submit · concluir lição
                </button>
              )}
              {busy && (
                <button type="button" onClick={() => discard(true)}>
                  Cancelar e descartar
                </button>
              )}
              {tasks && (
                <button
                  type="button"
                  onClick={() => {
                    revision.current++;
                    setSql("");
                    progress.remember("");
                    setResult(null);
                    setMessage(
                      "Consulta limpa. O banco e os acertos anteriores foram preservados; o texto atual ainda não foi executado.",
                    );
                  }}
                >
                  Limpar consulta
                </button>
              )}
              {tasks && (
                <>
                  <button type="button" onClick={() => discard(false)}>
                    Reiniciar banco
                  </button>
                  <button type="button" onClick={restartTasks}>
                    Recomeçar tarefas
                  </button>
                </>
              )}
            </div>
            {tasks && (
              <p className="sql-local-feedback">
                Reiniciar o banco mantém consultas e acertos. Recomeçar tarefas
                apaga ambos. Reabrir a lição inicia uma nova sequência.
              </p>
            )}
          </section>
          <section aria-labelledby={resultsId} aria-busy={busy}>
            <h2 id={resultsId}>Resultado</h2>
            <p role="status" aria-live="polite" aria-atomic="true">
              {message}
            </p>
            {result && (
              <>
                {tasks && executed && (
                  <div className="sql-executed-task">
                    <p>
                      Resultado da tarefa{" "}
                      {tasks.findIndex(
                        (task) => task.taskId === executed.taskId,
                      ) + 1}
                      :{" "}
                      {
                        tasks.find((task) => task.taskId === executed.taskId)
                          ?.exercise.title
                      }
                      .
                    </p>
                    <details>
                      <summary>SQL desta execução</summary>
                      <pre>{executed.sql}</pre>
                    </details>
                  </div>
                )}
                {result.fields.length > 0 && (
                  <p>
                    {result.rows.length}{" "}
                    {result.rows.length === 1
                      ? "linha exibida"
                      : "linhas exibidas"}
                    {result.truncated
                      ? ` (limite de ${exercise.limits.maxRows}; há mais resultados)`
                      : ""}
                    .
                  </p>
                )}
                <SqlTable result={result} label="Resultado da consulta" />
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
