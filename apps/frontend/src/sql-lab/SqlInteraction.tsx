import { useEffect, useId, useRef, useState } from "react";
import { CodeEditor } from "../practice/CodeEditor";
import { sqlSessionKey, type SqlExercise, type SqlResult } from "./exercise";
import { SqlRuntime, SqlRuntimeError } from "./sql-runtime";
import { SqlTable } from "./SqlTable";
import "./sql-lab.css";

// Callers own lesson framing. No routing, progress, drafts or API dependency.
export function SqlInteraction({
  exercise,
  lessonAppearance = false,
}: {
  exercise: SqlExercise;
  lessonAppearance?: boolean;
}) {
  return (
    <InteractionSession
      key={sqlSessionKey(exercise)}
      exercise={exercise}
      lessonAppearance={lessonAppearance}
    />
  );
}

function InteractionSession({
  exercise: configuration,
  lessonAppearance,
}: {
  exercise: SqlExercise;
  lessonAppearance: boolean;
}) {
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
      runtime.current = null;
    };
  }, [exercise]);

  const discard = (cancel: boolean) => {
    generation.current++;
    runtime.current?.dispose();
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
  const run = async (verify: boolean) => {
    if (running.current || !runtime.current) return;
    running.current = true;
    const currentGeneration = ++generation.current;
    const submittedRevision = revision.current;
    setBusy(true);
    setResult(null);
    setMessage(
      verify
        ? "Verificando resposta…"
        : exercise.mode === "mutation"
          ? "Executando comando…"
          : "Executando consulta…",
    );
    try {
      const value = await (exercise.mode === "mutation" && verify
        ? runtime.current.verifyState()
        : runtime.current.execute(sql, verify));
      if (
        exercise.mode === "mutation" &&
        !verify &&
        currentGeneration === generation.current
      ) {
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
        verify
          ? value.correct
            ? "Resposta correta!"
            : exercise.mode === "mutation"
              ? "O estado ainda não corresponde ao esperado. Confira todas as linhas e tabelas."
              : "Ainda não corresponde ao resultado esperado. Confira as colunas e as linhas."
          : exercise.mode === "mutation"
            ? `Comando concluído. ${value.affectedRows ?? 0} ${value.affectedRows === 1 ? "linha afetada" : "linhas afetadas"}. Verifique o estado quando terminar.`
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
          ? "Use um único SELECT, INSERT, UPDATE ou DELETE por execução. Alterações se acumulam nesta sessão descartável. Verificar estado não executa seu comando novamente."
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
                <SqlTable result={preview} label={`Registros de ${table}`} />
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
              A verificação oferece feedback local e não registra conclusão de
              lição.
            </p>
          </section>
          <section aria-labelledby={titleId}>
            <h2 id={titleId}>
              {exercise.mode === "mutation" ? "Seu comando" : "Sua consulta"}
            </h2>
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
                  }
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
                onClick={() => void run(false)}
              >
                {exercise.mode === "mutation"
                  ? "Executar comando"
                  : "Executar consulta"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(true)}
              >
                {exercise.mode === "mutation"
                  ? "Verificar estado"
                  : "Verificar resposta"}
              </button>
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
