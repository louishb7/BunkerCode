import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { sqlRequest } from "./api";
import {
  parsePublicSqlExercise,
  parseSqlReferenceSummary,
  validateSqlSequenceExercises,
  type SqlReferenceSummary,
} from "@bunkercode/content/sql";
import {
  lessonSqlPlacement,
  parseSqlPlacement,
  SQL_TASK_LIMIT,
  type SqlLessonPlacement,
  type SqlTaskReference,
} from "@bunkercode/content";

type EditingTask = SqlTaskReference & { key: string };
const editable = (task: SqlTaskReference): EditingTask => ({
  ...task,
  key: crypto.randomUUID(),
});
const referencesOnly = (tasks: readonly EditingTask[]): SqlTaskReference[] =>
  tasks.map(({ taskId, exerciseId, version }) => ({
    taskId,
    exerciseId,
    version,
  }));
const referenceKey = (reference: { id: string; version: number }) =>
  reference.id + "/" + reference.version;

export function SqlExercisePicker({
  disabled,
  source,
  onSelect,
  onPendingChange,
}: {
  disabled: boolean;
  source: string;
  onSelect: (reference: SqlLessonPlacement) => boolean;
  onPendingChange: (pending: boolean) => void;
}) {
  const [references, setReferences] = useState<SqlReferenceSummary[]>([]);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const validation = useRef<AbortController | null>(null);
  const currentSource = useRef(source);
  useLayoutEffect(() => {
    currentSource.current = source;
  }, [source]);
  let placement: SqlLessonPlacement | null = null;
  let contentError = "";
  try {
    placement = lessonSqlPlacement(source);
  } catch (failure) {
    contentError =
      failure instanceof Error ? failure.message : "Bloco SQL inválido.";
  }
  const placementKey = JSON.stringify(placement);
  const initial = useMemo(() => {
    const value =
      placementKey === "null"
        ? null
        : parseSqlPlacement(JSON.parse(placementKey));
    return (
      value?.kind === "sql-task-sequence"
        ? value.tasks
        : value
          ? [
              {
                taskId: value.exerciseId,
                exerciseId: value.exerciseId,
                version: value.version,
              },
            ]
          : []
    ).map(editable);
  }, [placementKey]);
  const [draft, setDraft] = useState<{
    key: string;
    tasks: EditingTask[];
  } | null>(null);
  const currentDraft = draft?.key === placementKey ? draft : null;
  const sequence = !!currentDraft || placement?.kind === "sql-task-sequence";
  const tasks = currentDraft?.tasks ?? initial;
  const pending =
    sequence &&
    (placement?.kind !== "sql-task-sequence" ||
      JSON.stringify(referencesOnly(tasks)) !==
        JSON.stringify(placement.tasks));
  const blocked = disabled || checking || !!contentError;
  const options = sequence
    ? references.filter(
        (reference) => reference.mode === "query" && reference.formative,
      )
    : references;
  const update = (tasks: EditingTask[]) => {
    setDraft({ key: placementKey, tasks });
    setError("");
  };
  useEffect(() => {
    onPendingChange(pending);
  }, [pending, onPendingChange]);
  useEffect(
    () => () => {
      validation.current?.abort();
      onPendingChange(false);
    },
    [onPendingChange],
  );
  useEffect(() => {
    if (!pending) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [pending]);
  useEffect(() => {
    const abort = new AbortController();
    void sqlRequest("/references", "GET", undefined, abort.signal)
      .then((value) => {
        if (!Array.isArray(value)) throw new Error("Lista SQL inválida.");
        if (!abort.signal.aborted)
          setReferences(value.map(parseSqlReferenceSummary));
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError(
            "Não foi possível consultar atividades publicadas. Recarregue para tentar novamente.",
          );
      });
    return () => abort.abort();
  }, []);
  async function apply() {
    if (blocked) return;
    const abort = new AbortController();
    validation.current = abort;
    setChecking(true);
    setError("");
    try {
      const value = parseSqlPlacement({
        kind: "sql-task-sequence",
        tasks: referencesOnly(tasks),
      });
      const exercises = await Promise.all(
        tasks.map(async (task) => {
          const exercise = parsePublicSqlExercise(
            await sqlRequest(
              `/exercises/${task.exerciseId}/${task.version}`,
              "GET",
              undefined,
              AbortSignal.any([abort.signal, AbortSignal.timeout(10000)]),
            ),
          );
          if (
            exercise.id !== task.exerciseId ||
            exercise.version !== task.version
          )
            throw new Error("Versão recebida não corresponde à tarefa.");
          return exercise;
        }),
      );
      validateSqlSequenceExercises(exercises);
      if (currentSource.current !== source)
        throw new Error(
          "O Markdown mudou durante a validação. Seu texto foi preservado; aplique as tarefas novamente.",
        );
      if (!abort.signal.aborted && onSelect(value)) setDraft(null);
    } catch (failure) {
      if (!abort.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "Revise as tarefas antes de aplicar.",
        );
    } finally {
      if (!abort.signal.aborted) setChecking(false);
    }
  }
  function move(index: number, offset: number) {
    const next = [...tasks];
    const other = index + offset;
    if (other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other]!, next[index]!];
    update(next);
  }
  return (
    <section className="studio-sql-picker" aria-label="Vincular atividade SQL">
      <label>
        Atividade SQL publicada
        <select
          aria-label="Atividade SQL publicada"
          value=""
          disabled={
            blocked ||
            !options.length ||
            (sequence && tasks.length >= SQL_TASK_LIMIT)
          }
          onChange={(event) => {
            const reference = references.find(
              (reference) => referenceKey(reference) === event.target.value,
            );
            if (!reference) return;
            if (!sequence) {
              onSelect({
                kind: "sql",
                exerciseId: reference.id,
                version: reference.version,
              });
              return;
            }
            const taskId = tasks.some((task) => task.taskId === reference.id)
              ? reference.id.slice(0, 68) + "-v" + reference.version
              : reference.id;
            update([
              ...tasks,
              editable({
                taskId,
                exerciseId: reference.id,
                version: reference.version,
              }),
            ]);
          }}
        >
          <option value="">
            {sequence
              ? "Selecionar para adicionar uma tarefa…"
              : "Selecionar para inserir ou substituir…"}
          </option>
          {options.map((reference) => (
            <option
              key={referenceKey(reference)}
              value={referenceKey(reference)}
            >
              {reference.title} · {reference.id} · v{reference.version}
            </option>
          ))}
        </select>
      </label>
      {!sequence && (
        <button
          type="button"
          disabled={blocked}
          onClick={() => update(initial)}
        >
          Criar sequência de tarefas
        </button>
      )}
      {sequence && (
        <div className="studio-sql-sequence">
          <p>
            Sequência de consultas · até {SQL_TASK_LIMIT} tarefas. Selecione
            exercícios publicados com feedback local e o mesmo dataset/versão.
            IDs permanecem iguais ao reordenar.
          </p>
          <ol>
            {tasks.map((task, index) => (
              <li key={task.key}>
                <div className="studio-sql-task-fields">
                  <label>
                    ID da tarefa {index + 1}
                    <input
                      aria-label={`ID da tarefa ${index + 1}`}
                      maxLength={80}
                      value={task.taskId}
                      disabled={blocked}
                      onChange={(event) =>
                        update(
                          tasks.map((row) =>
                            row.key === task.key
                              ? { ...row, taskId: event.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Exercício da tarefa {index + 1}
                    <select
                      aria-label={`Exercício da tarefa ${index + 1}`}
                      value={task.exerciseId + "/" + task.version}
                      disabled={blocked}
                      onChange={(event) => {
                        const selected = references.find(
                          (reference) =>
                            referenceKey(reference) === event.target.value,
                        );
                        if (selected)
                          update(
                            tasks.map((row) =>
                              row.key === task.key
                                ? {
                                    ...row,
                                    exerciseId: selected.id,
                                    version: selected.version,
                                  }
                                : row,
                            ),
                          );
                      }}
                    >
                      {!options.some(
                        (reference) =>
                          reference.id === task.exerciseId &&
                          reference.version === task.version,
                      ) && (
                        <option
                          value={task.exerciseId + "/" + task.version}
                          disabled
                        >
                          {task.exerciseId} · v{task.version} · escolha uma
                          versão com feedback local
                        </option>
                      )}
                      {options.map((reference) => (
                        <option
                          key={referenceKey(reference)}
                          value={referenceKey(reference)}
                        >
                          {reference.title} · v{reference.version}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="studio-sql-task-actions">
                  <button
                    type="button"
                    aria-label={`Subir tarefa ${index + 1}`}
                    disabled={blocked || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    Subir
                  </button>
                  <button
                    type="button"
                    aria-label={`Descer tarefa ${index + 1}`}
                    disabled={blocked || index === tasks.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    Descer
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover tarefa ${index + 1}`}
                    disabled={blocked}
                    onClick={() =>
                      update(tasks.filter((row) => row.key !== task.key))
                    }
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {!tasks.length && (
            <p>Adicione ao menos uma tarefa pelo seletor acima.</p>
          )}
          <div className="studio-sql-task-actions">
            <button
              type="button"
              disabled={blocked || !pending}
              onClick={() => void apply()}
            >
              {checking ? "Validando tarefas…" : "Aplicar tarefas ao rascunho"}
            </button>
            {pending && (
              <button
                type="button"
                disabled={blocked}
                onClick={() => {
                  setDraft(null);
                  setError("");
                }}
              >
                Descartar mudanças nas tarefas
              </button>
            )}
          </div>
          {pending && (
            <p role="status">
              Aplique ou descarte as mudanças nas tarefas antes de abrir a
              prévia ou salvar a lição.
            </p>
          )}
        </div>
      )}
      {contentError && (
        <p role="alert">
          {contentError} Corrija o bloco bunker-sql na fonte Markdown.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
