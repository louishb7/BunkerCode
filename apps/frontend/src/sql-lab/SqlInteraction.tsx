import { useAuth } from "../auth/Auth";
import { apiFetch, localIdentityScope } from "../auth/session";
import { learningRequest, learningLessonPath } from "../learning/api";
import { SQL_LIMITS, parseSqlSteps } from "@bunkercode/content/sql";
import { useEffect, useId, useRef, useState } from "react";
import { CodeEditor } from "../practice/CodeEditor";
import { sqlSessionKey, type SqlExercise, type SqlResult } from "./exercise";
import { SqlRuntime, SqlRuntimeError } from "./sql-runtime";
import { SqlTable } from "./SqlTable";
import "./sql-lab.css";

// Local execution stays separate from explicit server checks and submission.
export function SqlInteraction({
  exercise,
  lessonAppearance = false,
  previewOnly = false,
  lesson,
}: {
  exercise: SqlExercise;
  lessonAppearance?: boolean;
  previewOnly?: boolean;
  lesson?: { courseId: string; lessonSlug: string; onCompleted: () => void };
}) {
  return (
    <InteractionSession
      key={sqlSessionKey(exercise)}
      exercise={exercise}
      lessonAppearance={lessonAppearance}
      previewOnly={previewOnly}
      lesson={lesson}
    />
  );
}

function InteractionSession({
  exercise: configuration,
  lessonAppearance,
  previewOnly,
  lesson,
}: {
  exercise: SqlExercise;
  lessonAppearance: boolean;
  previewOnly: boolean;
  lesson?: { courseId: string; lessonSlug: string; onCompleted: () => void };
}) {
  const { user } = useAuth();
  const steps = useRef<string[]>([]);
  const request = useRef<AbortController | null>(null);
  // Snapshot once per explicit identity/version, independent of parent references.
  const [exercise] = useState(() => configuration);
  const [sql, setSql] = useState(exercise.starterSql);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SqlResult | null>(null);
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
    const current = new SqlRuntime(exercise);
    runtime.current = current;
    setSql(exercise.starterSql);
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
  }, [exercise]);

  useEffect(() => {
    const reset = () => {
      generation.current++;
      runtime.current?.dispose();
      request.current?.abort();
      steps.current = [];
      running.current = false;
      setBusy(false);
      setApproved(null);
      setSql(exercise.starterSql);
      setResult(null);
      setPreview(null);
      setMessage(
        "Conta alterada. O banco e a solução desta sessão foram descartados.",
      );
    };
    window.addEventListener("bunkercode-identity-change", reset);
    return () =>
      window.removeEventListener("bunkercode-identity-change", reset);
  }, [exercise]);
  useEffect(() => {
    setApproved(null);
    setRecoveryError("");
    if (!user || !lesson) return;
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
        : "Banco descartado. Os dados iniciais serão recriados na próxima execução.",
    );
  };
  const run = async () => {
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
    if (running.current || !runtime.current) return;
    running.current = true;
    const currentGeneration = ++generation.current;
    const submittedRevision = revision.current;
    setBusy(true);
    setResult(null);
    setMessage(
      exercise.mode === "mutation"
        ? "Executando comando…"
        : "Executando consulta…",
    );
    try {
      const value = await runtime.current.execute(sql);
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
      if (currentGeneration !== generation.current) return;
      if (exercise.mode === "query" && submittedRevision !== revision.current) {
        setMessage(
          "A consulta mudou durante a execução. Execute novamente para ver o resultado atual.",
        );
        return;
      }
      setResult(value);
      setMessage(
        exercise.mode === "mutation"
          ? `Comando concluído. ${value.affectedRows ?? 0} ${value.affectedRows === 1 ? "linha afetada" : "linhas afetadas"}. ${steps.current.length} ${steps.current.length === 1 ? "passo" : "passos"} na solução desta sessão.${submittedRevision !== revision.current ? " O texto do editor mudou durante a execução e ainda não foi executado." : ""}`
          : "Consulta concluída.",
      );
    } catch (error: unknown) {
      if (currentGeneration !== generation.current) return;
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
        setMessage(
          error.discarded
            ? error.message
            : `Erro SQL${error.code ? ` (${error.code})` : ""}: ${error.message}`,
        );
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
  const explore = async () => {
    if (running.current || !runtime.current) return;
    running.current = true;
    const currentGeneration = ++generation.current;
    setBusy(true);
    setPreviewMessage("Carregando registros…");
    try {
      const value = await runtime.current.preview(table);
      if (currentGeneration !== generation.current) return;
      setPreview(value);
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
  };
  return (
    <div className={`sql-interaction ${lessonAppearance ? "sql-lesson" : ""}`}>
      <p className="sql-notice">
        O banco existe apenas nesta sessão de prática. Cancelar ou reiniciar
        descarta o ambiente.{" "}
        {exercise.mode === "mutation"
          ? "Use um único SELECT, INSERT, UPDATE ou DELETE por execução. Alterações se acumulam nesta sessão descartável. Verificar e Submit reproduzem, em outro banco, os comandos executados com sucesso desde o último reinício (até 20 passos e 16 KiB). O texto ainda não executado não é enviado."
          : "Use uma única consulta SELECT por vez; múltiplos comandos e comandos como EXPLAIN não são aceitos."}
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
          <button type="button" onClick={() => discard(false)}>
            Reiniciar banco
          </button>
        </aside>
        <div className="sql-workspace">
          <section className="sql-challenge">
            <h2>{exercise.title}</h2>
            <p className="sql-local-feedback">Objetivo: {exercise.objective}</p>
            <p>{exercise.instructions}</p>
            <p className="sql-local-feedback">
              {previewOnly ? (
                "Prévia local do rascunho. Teste a referência e publique pela barra de autoria; esta prévia não registra conclusão."
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
                  revision.current++;
                  setSql(value);
                  if (exercise.mode === "query") {
                    setResult(null);
                    setMessage(
                      "Consulta alterada. Execute ou verifique novamente.",
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
                disabled={busy}
                onClick={() => void run()}
              >
                {exercise.mode === "mutation"
                  ? "Executar comando"
                  : "Executar consulta"}
              </button>
              {!previewOnly && (
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
              {lesson && user && (
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
            </div>
          </section>
          <section aria-labelledby={resultsId} aria-busy={busy}>
            <h2 id={resultsId}>Resultado</h2>
            <p role="status" aria-live="polite">
              {message}
            </p>
            {result && (
              <>
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
