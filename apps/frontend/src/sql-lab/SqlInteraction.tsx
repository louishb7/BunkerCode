import { useEffect, useId, useRef, useState } from "react";
import { CodeEditor } from "../practice/CodeEditor";
import type { SqlExercise, SqlResult } from "./exercise";
import { SqlRuntime, SqlRuntimeError } from "./sql-runtime";
import "./sql-lab.css";

// Callers own lesson framing. No routing, progress, drafts or API dependency.
export function SqlInteraction({ exercise }: { exercise: SqlExercise }) {
  return <InteractionSession key={exercise.id} exercise={exercise} />;
}

function InteractionSession({ exercise }: { exercise: SqlExercise }) {
  const [sql, setSql] = useState(exercise.starterSql);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SqlResult | null>(null);
  const [message, setMessage] = useState(
    "Os dados iniciais serão carregados ao executar uma consulta.",
  );
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
    setMessage(verify ? "Verificando resposta…" : "Executando consulta…");
    try {
      const value = await runtime.current.execute(sql, verify);
      if (currentGeneration !== generation.current) return;
      if (submittedRevision !== revision.current) {
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
            : "Ainda não corresponde ao resultado esperado. Confira as colunas e as linhas."
          : "Consulta concluída.",
      );
    } catch (error: unknown) {
      if (currentGeneration !== generation.current) return;
      if (
        submittedRevision !== revision.current &&
        error instanceof SqlRuntimeError &&
        !error.discarded
      ) {
        setMessage(
          "A consulta mudou durante a execução. Execute novamente para ver o resultado atual.",
        );
        return;
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
  return (
    <div className="sql-interaction">
      <p className="sql-notice">
        O banco existe apenas nesta página. Cancelar ou reiniciar descarta o
        ambiente. Use uma única consulta SELECT por vez; múltiplos comandos e
        comandos como EXPLAIN não são aceitos.
      </p>
      <div className="sql-layout">
        <aside className="sql-schema" aria-label="Tabelas disponíveis">
          <h2>Dados disponíveis</h2>
          <p>{exercise.schemaNote}</p>
          {exercise.schema.map((table) => (
            <div key={table.name}>
              <h3>{table.name}</h3>
              <ul>
                {table.columns.map((column) => (
                  <li key={column.name}>
                    <code>{column.name}</code> · {column.type}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <button type="button" onClick={() => discard(false)}>
            Reiniciar banco
          </button>
        </aside>
        <div className="sql-workspace">
          <section className="sql-challenge">
            <h2>{exercise.title}</h2>
            <p>{exercise.instructions}</p>
            <p className="sql-local-feedback">
              A verificação oferece feedback local e não registra conclusão de
              lição.
            </p>
          </section>
          <section aria-labelledby={titleId}>
            <h2 id={titleId}>Sua consulta</h2>
            <p id={helpId}>
              Use Tab para indentar; Esc e Tab movem o foco para fora do editor.
            </p>
            <div className="sql-editor">
              <CodeEditor
                code={sql}
                language="sql"
                label="Consulta SQL"
                variant="example"
                siteAppearance
                keyboardHelpId={helpId}
                onChange={(value) => {
                  revision.current++;
                  setSql(value);
                  setResult(null);
                  setMessage(
                    "Consulta alterada. Execute ou verifique novamente.",
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
                onClick={() => void run(false)}
              >
                Executar consulta
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(true)}
              >
                Verificar resposta
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
                {result.rows.length === 0 && (
                  <p>Nenhuma linha corresponde à consulta.</p>
                )}
                {result.fields.length > 0 && (
                  <div
                    className="sql-table-scroll"
                    role="region"
                    aria-label="Resultado da consulta"
                    tabIndex={0}
                  >
                    <table>
                      <thead>
                        <tr>
                          {result.fields.map((field, index) => (
                            <th key={index} scope="col">
                              {field}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, index) => (
                          <tr key={index}>
                            {row.map((value, column) => (
                              <td key={column}>
                                {value === null ? (
                                  <em>NULL</em>
                                ) : typeof value === "object" ? (
                                  JSON.stringify(value)
                                ) : (
                                  String(value)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
