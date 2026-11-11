import { useEffect, useRef, useState } from "react";
import { Page } from "../courses/Page";
import { CodeEditor } from "../practice/CodeEditor";
import "./sql-lab.css";

type Result = {
  fields: string[];
  rows: unknown[][];
  truncated: boolean;
  correct?: boolean;
};
type Reply = Result & { id: number; error?: string };
const initialSql = "SELECT * FROM customers;";
const queryTimeoutMs = 15000;
const initializationTimeoutMs = 60000;

export default function SqlLab() {
  const [sql, setSql] = useState(initialSql);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState(
    "O banco de exemplo será iniciado ao executar uma consulta.",
  );
  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequence = useRef(0);
  const running = useRef(false);
  const revision = useRef(0);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    worker.current?.terminate();
    worker.current = null;
    running.current = false;
    sequence.current++;
  };
  useEffect(() => () => stop(), []);
  const run = (submit: boolean) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setResult(null);
    setMessage(submit ? "Verificando resposta…" : "Executando consulta…");
    const id = ++sequence.current;
    const submittedRevision = revision.current;
    const initializing = !worker.current;
    const current =
      worker.current ??
      new Worker(new URL("./sql.worker.ts", import.meta.url), {
        type: "module",
      });
    worker.current = current;
    const fail = (text: string) => {
      stop();
      setBusy(false);
      setMessage(text);
    };
    current.onerror = () =>
      fail(
        "O laboratório falhou. O banco foi descartado; tente executar novamente.",
      );
    current.onmessageerror = () =>
      fail(
        "Não foi possível ler o resultado. O banco foi descartado; tente novamente.",
      );
    current.onmessage = (event: MessageEvent<Reply>) => {
      if (event.data.id !== sequence.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      running.current = false;
      setBusy(false);
      if (revision.current !== submittedRevision) {
        setMessage(
          "A consulta mudou durante a execução. Execute novamente para ver o resultado atual.",
        );
        return;
      }
      if (event.data.error) setMessage(`Erro SQL: ${event.data.error}`);
      else {
        setResult(event.data);
        setMessage(
          submit
            ? event.data.correct
              ? "Resposta correta!"
              : "Ainda não corresponde ao resultado esperado. Confira as colunas e as linhas."
            : "Consulta concluída.",
        );
      }
    };
    timer.current = setTimeout(
      () =>
        fail(
          "O tempo limite terminou. O banco foi descartado; tente uma consulta menor.",
        ),
      initializing ? initializationTimeoutMs : queryTimeoutMs,
    );
    current.postMessage({ id, sql, submit });
  };
  const reset = () => {
    stop();
    setBusy(false);
    setResult(null);
    setMessage(
      "Banco descartado. Os dados iniciais serão recriados na próxima consulta.",
    );
  };
  return (
    <Page title="Laboratório SQL" className="sql-lab">
      <header>
        <h1>Laboratório SQL</h1>
        <p>
          Explore uma loja fictícia com consultas SELECT. Os dados existem
          apenas neste navegador e são descartados ao sair ou reiniciar.
        </p>
      </header>
      <div className="sql-layout">
        <aside className="sql-schema" aria-label="Tabelas disponíveis">
          <h2>Dados disponíveis</h2>
          <p>
            As tabelas são relacionadas por <code>orders.customer_id</code> e{" "}
            <code>customers.id</code>.
          </p>
          <h3>customers</h3>
          <ul>
            <li>
              <code>id</code> · número
            </li>
            <li>
              <code>name</code> · texto
            </li>
            <li>
              <code>city</code> · texto
            </li>
          </ul>
          <h3>orders</h3>
          <ul>
            <li>
              <code>id</code> · número
            </li>
            <li>
              <code>customer_id</code> · número
            </li>
            <li>
              <code>total</code> · valor
            </li>
            <li>
              <code>note</code> · texto ou NULL
            </li>
          </ul>
          <button type="button" onClick={reset}>
            Reiniciar banco
          </button>
        </aside>
        <div className="sql-workspace">
          <section className="sql-challenge">
            <h2>Desafio</h2>
            <p>
              Retorne todas as colunas dos clientes de Recife. A ordem das
              linhas não importa.
            </p>
          </section>
          <section aria-labelledby="sql-editor-title">
            <h2 id="sql-editor-title">Sua consulta</h2>
            <p id="editor-keyboard-help">
              Use Tab para indentar; Esc e Tab movem o foco para fora do editor.
            </p>
            <div className="sql-editor">
              <CodeEditor
                code={sql}
                language="sql"
                label="Consulta SQL"
                variant="example"
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
              <button type="button" disabled={busy} onClick={() => run(false)}>
                Executar consulta
              </button>
              <button type="button" disabled={busy} onClick={() => run(true)}>
                Verificar resposta
              </button>
              {busy && (
                <button type="button" onClick={reset}>
                  Cancelar
                </button>
              )}
            </div>
          </section>
          <section aria-labelledby="sql-results-title">
            <h2 id="sql-results-title">Resultado</h2>
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
                    ? " (limite de 100; há mais resultados)"
                    : ""}
                  .
                </p>
                {result.rows.length > 0 && (
                  <div className="sql-table-scroll">
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
    </Page>
  );
}
