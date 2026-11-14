import { useEffect, useRef, useState } from "react";
import { equivalentResults } from "@bunkercode/content/sql-comparison";
import {
  publicSqlExercise,
  type SqlDataset,
  type SqlDefinition,
} from "@bunkercode/content/sql";
import type { SqlResult } from "./exercise";
import { SqlRuntime, SqlRuntimeError, sqlRuntimeFeedback } from "./sql-runtime";
import { SqlTable } from "./SqlTable";
import { SqlTaskInstruction, SqlTaskProgress } from "./SqlTaskProgress";
import "./sql-lab.css";

// This is only a local view model: no learner state, canonical oracle or progress writes.
export function SqlSequencePreview({
  tasks,
}: {
  tasks: { taskId: string; definition: SqlDefinition }[];
}) {
  const [active, setActive] = useState(tasks[0]?.taskId ?? "");
  const [completed, setCompleted] = useState<ReadonlySet<string>>(new Set());
  const current = tasks.find((task) => task.taskId === active) ?? tasks[0];
  const visibleCompleted = new Set(
    [...completed].filter((id) => tasks.some((task) => task.taskId === id)),
  );
  if (!current) return <p>Adicione uma tarefa para ver a sequência.</p>;
  return (
    <section
      className="studio-sql-preview"
      aria-label="Prévia da sequência SQL"
    >
      <p>
        Estados simulados para conferir a aparência. Nenhum progresso é gravado.
      </p>
      <div className="sql-learning-tasks">
        <SqlTaskProgress
          tasks={tasks.map((task) => ({
            taskId: task.taskId,
            exercise: { title: task.definition.title || "Nova tarefa" },
          }))}
          activeId={current.taskId}
          completed={visibleCompleted}
          notice=""
          onSelect={setActive}
          compact
        />
        <SqlTaskInstruction
          title={current.definition.title || "Nova tarefa"}
          instructions={
            current.definition.instructions ||
            "Escreva a instrução desta tarefa."
          }
        />
      </div>
      <label className="studio-sql-order">
        <input
          type="checkbox"
          checked={completed.has(current.taskId)}
          onChange={(event) => {
            const next = new Set(completed);
            if (event.target.checked) next.add(current.taskId);
            else next.delete(current.taskId);
            setCompleted(next);
          }}
        />
        Simular tarefa ativa concluída
      </label>
    </section>
  );
}

const failureText = (failure: unknown) =>
  failure instanceof SqlRuntimeError
    ? sqlRuntimeFeedback(failure)
    : failure instanceof Error
      ? failure.message
      : "Não foi possível executar a consulta.";

export function SqlDatasetPreview({ dataset }: { dataset: SqlDataset }) {
  const [samples, setSamples] = useState<Record<string, SqlResult>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    // Public dataset projection, using the same seed and restrictions as the learner.
    const runtime = new SqlRuntime(
      publicSqlExercise(
        {
          format: 1,
          id: dataset.id,
          version: dataset.version,
          status: "draft",
          title: dataset.title,
          objective: "",
          instructions: "",
          starterSql: "",
          mode: "query",
          dataset: { id: dataset.id, version: dataset.version },
          assessment: { reference: [], orderMatters: false },
        },
        dataset,
      ),
    );
    void (async () => {
      try {
        for (const table of dataset.tables) {
          const sample = await runtime.preview(table.name);
          if (!active) return;
          setSamples((current) => ({ ...current, [table.name]: sample }));
        }
      } catch (failure) {
        if (active) setError(failureText(failure));
      } finally {
        runtime.dispose();
      }
    })();
    return () => {
      active = false;
      runtime.dispose();
    };
  }, [dataset]);
  return (
    <section aria-label="Dados da prática SQL" className="studio-sql-data">
      <p>
        Até 10 registros reais por tabela, em um banco descartável no navegador.
      </p>
      {dataset.tables.map((table) => (
        <section key={table.name} aria-label={`Tabela ${table.name}`}>
          <h3>{table.name}</h3>
          <p>
            {table.columns
              .map(
                (column) =>
                  `${column.name} (${column.type}${column.primaryKey ? ", chave primária" : ""}${column.nullable ? ", aceita NULL" : ""})`,
              )
              .join(" · ")}
          </p>
          {table.columns
            .filter((column) => column.references)
            .map((column) => (
              <p key={column.name}>
                {column.name} → {column.references!.table}.
                {column.references!.column}
              </p>
            ))}
          {samples[table.name] ? (
            <SqlTable
              result={samples[table.name]!}
              label={`Amostra de ${table.name}`}
              context="table"
            />
          ) : (
            !error && <p role="status">Carregando {table.name}…</p>
          )}
        </section>
      ))}
      {error && (
        <p role="alert">
          {error} Feche e reabra os dados para tentar novamente.
        </p>
      )}
    </section>
  );
}

export function SqlQueryPreview({
  definition,
  dataset,
}: {
  definition: SqlDefinition;
  dataset: SqlDataset;
}) {
  const [candidate, setCandidate] = useState(definition.starterSql);
  const [expected, setExpected] = useState<SqlResult | null>(null);
  const [result, setResult] = useState<SqlResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const runtime = useRef<SqlRuntime | null>(null);
  const operation = useRef(0);
  useEffect(
    () => () => {
      operation.current++;
      runtime.current?.dispose();
    },
    [],
  );
  async function execute(compare: boolean) {
    if (runtime.current) return;
    const generation = ++operation.current;
    setBusy(true);
    setError("");
    setMessage("");
    setExpected(null);
    setResult(null);
    const current = new SqlRuntime(publicSqlExercise(definition, dataset));
    runtime.current = current;
    try {
      const reference = definition.assessment.reference;
      if (
        definition.mode !== "query" ||
        reference.length !== 1 ||
        !reference[0]?.trim()
      )
        throw new Error(
          "Preencha uma única consulta SELECT esperada para testar aqui. Outros contratos continuam na biblioteca avançada.",
        );
      const target = await current.execute(reference[0]);
      if (generation !== operation.current) return;
      setExpected(target);
      if (target.truncated)
        throw new Error(
          "A consulta esperada excedeu o limite de 100 linhas; reduza o resultado antes de publicar.",
        );
      if (compare) {
        const actual = await current.execute(candidate);
        if (generation !== operation.current) return;
        setResult(actual);
        setMessage(
          equivalentResults(actual, target, definition.assessment.orderMatters)
            ? "A consulta candidata retornou o resultado esperado neste teste local."
            : "A consulta candidata executou, mas o resultado difere do esperado. Confira colunas, tipos, linhas e ordem.",
        );
      } else
        setMessage(
          "Consulta esperada executada com sucesso neste teste local.",
        );
    } catch (failure) {
      if (generation === operation.current) setError(failureText(failure));
    } finally {
      current.dispose();
      if (generation === operation.current) {
        runtime.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <section
      aria-label="Teste local da tarefa SQL"
      className="studio-sql-query-preview"
    >
      <p>
        Testa as consultas neste dataset descartável. O teste local não valida a
        publicação, não publica a tarefa e não registra progresso. A publicação
        ainda exige avaliação independente no runner.
      </p>
      <div className="studio-sql-task-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => void execute(false)}
        >
          Testar consulta esperada
        </button>
        {busy && (
          <button
            type="button"
            onClick={() => {
              operation.current++;
              runtime.current?.dispose();
              runtime.current = null;
              setBusy(false);
              setMessage("Teste cancelado; o banco foi descartado.");
            }}
          >
            Cancelar teste
          </button>
        )}
      </div>
      <label>
        Consulta candidata
        <textarea
          aria-label="Consulta candidata"
          value={candidate}
          rows={3}
          disabled={busy}
          onChange={(event) => {
            setCandidate(event.target.value);
            setResult(null);
            setMessage("");
            setError("");
          }}
        />
      </label>
      <button
        type="button"
        disabled={busy || !candidate.trim()}
        onClick={() => void execute(true)}
      >
        Comparar com resultado esperado
      </button>
      {busy && <p role="status">Executando no navegador…</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {expected && (
        <section aria-label="Resultado esperado local">
          <h4>Resultado esperado</h4>
          <SqlTable result={expected} label="Resultado da consulta esperada" />
          <p>
            {expected.rows.length} linhas
            {expected.truncated ? " (resultado truncado)" : ""}.
          </p>
        </section>
      )}
      {result && (
        <section aria-label="Resultado candidato local">
          <h4>Resultado candidato</h4>
          <SqlTable result={result} label="Resultado da consulta candidata" />
          <p>
            {result.rows.length} linhas
            {result.truncated ? " (resultado truncado)" : ""}.
          </p>
        </section>
      )}
    </section>
  );
}
