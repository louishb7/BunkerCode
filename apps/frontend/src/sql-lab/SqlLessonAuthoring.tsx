import { useEffect, useState } from "react";
import {
  lessonSqlPlacement,
  validateEditorial,
  setLessonSqlPlacement,
  sqlExerciseReferences,
  type SqlLessonPlacement,
} from "@bunkercode/content";
import {
  parseSqlDefinition,
  parseSqlDataset,
  parsePublicSqlExercise,
  publicSqlExercise,
  sqlObject,
  validateSqlSequenceExercises,
  type SqlDefinition,
  type SqlDataset,
} from "@bunkercode/content/sql";
import type { PublicSqlExercise } from "@bunkercode/content/sql";
import { sqlRequest } from "./api";
import { SqlExercisePicker } from "./SqlExercisePicker";
import { SqlInteraction } from "./SqlInteraction";

interface Inventory {
  published: SqlDefinition[];
  drafts: { definition: SqlDefinition; revision: string }[];
  datasets: SqlDataset[];
}
interface EditingTask {
  taskId: string;
  definition: SqlDefinition;
  revision: string | null;
  dirty: boolean;
  attached: boolean;
}
function parseInventory(value: unknown): Inventory {
  const data = sqlObject(value, ["published", "drafts", "datasets"]);
  if (
    !Array.isArray(data.published) ||
    !Array.isArray(data.drafts) ||
    !Array.isArray(data.datasets)
  )
    throw new Error("Inventário de tarefas inválido.");
  return {
    published: data.published.map(parseSqlDefinition),
    datasets: data.datasets.map(parseSqlDataset),
    drafts: data.drafts.map((value) => {
      const draft = sqlObject(value, ["definition", "revision"]);
      if (typeof draft.revision !== "string")
        throw new Error("Revisão de tarefa inválida.");
      return {
        definition: parseSqlDefinition(draft.definition),
        revision: draft.revision,
      };
    }),
  };
}
function editable(definition: SqlDefinition, data: Inventory): SqlDefinition {
  return {
    ...definition,
    status: "draft",
    version:
      definition.status === "published"
        ? Math.max(
            ...data.published
              .filter((entry) => entry.id === definition.id)
              .map((entry) => entry.version),
          ) + 1
        : definition.version,
    ...(definition.formative ? { formative: { kind: "public-result" } } : {}),
  };
}

export function SqlLessonAuthoring({
  courseId,
  lessonSlug,
  source,
  disabled,
  onSelect,
  onPendingChange,
}: {
  courseId: string;
  lessonSlug: string;
  source: string;
  disabled: boolean;
  onSelect: (placement: SqlLessonPlacement | null) => boolean;
  onPendingChange: (pending: boolean) => void;
}) {
  const [data, setData] = useState<Inventory | null>(null);
  const [prefix, setPrefix] = useState("");
  const [rows, setRows] = useState<EditingTask[]>([]);
  const [datasetKey, setDatasetKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PublicSqlExercise | null>(null);
  const [advancedPending, setAdvancedPending] = useState(false);
  let placement: SqlLessonPlacement | null = null;
  let contentError = "";
  try {
    placement = lessonSqlPlacement(source);
    if (validateEditorial(source))
      contentError =
        "Esta lição já possui prática JavaScript. Use uma lição sem essa prática para adicionar SQL.";
  } catch (failure) {
    contentError =
      failure instanceof Error ? failure.message : "Prática SQL inválida.";
  }
  const referencesMissing =
    !!data &&
    !!placement &&
    sqlExerciseReferences(placement).some(
      (reference) =>
        !data.published.some(
          (entry) =>
            entry.id === reference.exerciseId &&
            entry.version === reference.version,
        ),
    );
  if (referencesMissing)
    contentError =
      "Uma tarefa vinculada não foi encontrada. Nenhum vínculo será alterado até corrigir a fonte.";
  const placementKey = JSON.stringify(placement);
  const pending = rows.some((row) => row.dirty);
  useEffect(() => {
    onPendingChange(pending || advancedPending || busy);
  }, [pending, advancedPending, busy, onPendingChange]);
  useEffect(() => {
    if (!pending && !busy) return;
    const protect = (event: BeforeUnloadEvent) => event.preventDefault();
    const protectLink = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === "_blank" ||
        (link.hash && link.pathname === location.pathname)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setError(
        busy
          ? "Aguarde a operação da tarefa terminar."
          : "Salve ou retire as tarefas alteradas antes de sair da lição.",
      );
    };
    window.addEventListener("beforeunload", protect);
    document.addEventListener("click", protectLink, true);
    return () => {
      window.removeEventListener("beforeunload", protect);
      document.removeEventListener("click", protectLink, true);
    };
  }, [pending, busy]);
  useEffect(() => {
    const abort = new AbortController();
    void Promise.all([
      sqlRequest("/authoring", "GET", undefined, abort.signal),
      crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify([courseId, lessonSlug])),
      ),
    ])
      .then(([value, digest]) => {
        if (abort.signal.aborted) return;
        setData(parseInventory(value));
        setPrefix(
          "lesson-" +
            Array.from(new Uint8Array(digest))
              .map((byte) => byte.toString(16).padStart(2, "0"))
              .join("")
              .slice(0, 32) +
            "-",
        );
      })
      .catch((failure: unknown) => {
        if (!abort.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Não foi possível carregar as tarefas.",
          );
      });
    return () => abort.abort();
  }, [courseId, lessonSlug]);
  useEffect(() => {
    if (!data) return;
    const placement: SqlLessonPlacement | null = JSON.parse(placementKey);
    const attached = placement
      ? sqlExerciseReferences(placement).flatMap((reference, index) => {
          const published = data.published.find(
            (entry) =>
              entry.id === reference.exerciseId &&
              entry.version === reference.version,
          );
          if (!published) return [];
          const draft = data.drafts.find(
            (entry) =>
              entry.definition.id === reference.exerciseId &&
              entry.definition.version > published.version,
          );
          return [
            {
              taskId:
                placement.kind === "sql-task-sequence"
                  ? placement.tasks[index]!.taskId
                  : reference.exerciseId,
              definition: editable(draft?.definition ?? published, data),
              revision: draft?.revision ?? null,
              dirty: false,
              attached: true,
            },
          ];
        })
      : [];
    setRows((current) =>
      current.some((row) => row.dirty)
        ? current
        : [
            ...attached,
            ...current.filter(
              (row) =>
                !row.attached &&
                !attached.some(
                  (entry) => entry.definition.id === row.definition.id,
                ),
            ),
          ],
    );
    const dataset = attached[0]?.definition.dataset;
    if (dataset) setDatasetKey(dataset.id + "/" + dataset.version);
    else
      setDatasetKey((current) =>
        data.datasets.some(
          (entry) => entry.id + "/" + entry.version === current,
        )
          ? current
          : data.datasets.at(-1)
            ? data.datasets.at(-1)!.id + "/" + data.datasets.at(-1)!.version
            : "",
      );
  }, [data, placementKey]);
  function change(index: number, patch: Partial<SqlDefinition>) {
    setRows((current) =>
      current.map((row, position) => {
        if (position !== index) return row;
        const definition = { ...row.definition, ...patch } as SqlDefinition;
        if (definition.formative === undefined) delete definition.formative;
        return { ...row, definition, dirty: true };
      }),
    );
    setMessage("");
    setError("");
  }
  function add() {
    const dataset = data?.datasets.find(
      (entry) => entry.id + "/" + entry.version === datasetKey,
    );
    if (!dataset || !prefix) return;
    const id = prefix + crypto.randomUUID().replaceAll("-", "").slice(0, 20);
    setRows((current) => [
      ...current,
      {
        taskId: id,
        revision: null,
        dirty: true,
        attached: false,
        definition: {
          format: 1,
          id,
          version: 1,
          status: "draft",
          title: "",
          objective: "",
          instructions: "",
          starterSql: "SELECT * FROM " + dataset.tables[0]!.name + ";",
          mode: "query",
          dataset: { id: dataset.id, version: dataset.version },
          assessment: { reference: [""], orderMatters: false },
        },
      },
    ]);
  }
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível concluir a operação. Seu texto foi preservado.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveTask(index: number) {
    const row = rows[index]!;
    const saved = sqlObject(
      await sqlRequest("/authoring/drafts", "PUT", {
        definition: parseSqlDefinition(row.definition),
        revision: row.revision,
      }),
      ["definition", "revision"],
    );
    if (typeof saved.revision !== "string")
      throw new Error("Salvamento sem confirmação.");
    const draft = {
      definition: parseSqlDefinition(saved.definition),
      revision: saved.revision,
    };
    setRows((current) =>
      current.map((entry, position) =>
        position === index ? { ...entry, ...draft, dirty: false } : entry,
      ),
    );
    setData((current) =>
      current
        ? {
            ...current,
            drafts: [
              ...current.drafts.filter(
                (entry) => entry.definition.id !== draft.definition.id,
              ),
              draft,
            ],
          }
        : current,
    );
    setMessage(
      "Tarefa salva como rascunho. Publique para usar as alterações na lição.",
    );
  }
  async function publishTask(index: number) {
    const row = rows[index]!;
    if (
      !row.attached &&
      placement &&
      sqlExerciseReferences(placement).length >= 12
    )
      throw new Error("A lição já possui o limite de 12 tarefas.");
    if (!row.revision || row.dirty)
      throw new Error("Salve a tarefa antes de publicar.");
    if (!row.definition.formative)
      throw new Error(
        "Para usar esta tarefa na sequência, autorize explicitamente o resultado esperado público e salve a tarefa.",
      );
    // Check the lesson boundary before the irreversible version publication.
    setLessonSqlPlacement(
      source,
      placement ?? {
        kind: "sql",
        exerciseId: row.definition.id,
        version: row.definition.version,
      },
    );
    const published = parseSqlDefinition(
      await sqlRequest(
        `/authoring/drafts/${row.definition.id}/publish`,
        "POST",
        { revision: row.revision },
      ),
    );
    const references = placement ? sqlExerciseReferences(placement) : [];
    const tasks = references.map((reference, position) => ({
      taskId:
        placement?.kind === "sql-task-sequence"
          ? placement.tasks[position]!.taskId
          : reference.exerciseId,
      exerciseId: reference.exerciseId,
      version:
        (placement?.kind === "sql-task-sequence"
          ? placement.tasks[position]!.taskId
          : reference.exerciseId) === row.taskId
          ? published.version
          : reference.version,
    }));
    if (!tasks.some((task) => task.taskId === row.taskId))
      tasks.push({
        taskId: row.taskId,
        exerciseId: published.id,
        version: published.version,
      });
    const exercises = await Promise.all(
      tasks.map(async (task) =>
        parsePublicSqlExercise(
          await sqlRequest(`/exercises/${task.exerciseId}/${task.version}`),
        ),
      ),
    );
    validateSqlSequenceExercises(exercises);
    if (!onSelect({ kind: "sql-task-sequence", tasks }))
      throw new Error(
        "A tarefa foi publicada, mas o vínculo não pôde ser aplicado. Seu rascunho foi preservado.",
      );
    setData(parseInventory(await sqlRequest("/authoring")));
    setMessage(
      "Tarefa publicada e aplicada ao rascunho da lição. Salve a lição para concluir.",
    );
  }
  function previewTask(index: number) {
    try {
      const definition = parseSqlDefinition(rows[index]!.definition);
      const dataset = data?.datasets.find(
        (entry) =>
          entry.id === definition.dataset.id &&
          entry.version === definition.dataset.version,
      );
      if (!dataset) throw new Error("Dados da tarefa indisponíveis.");
      setPreview(publicSqlExercise(definition, dataset));
      setError("");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Prévia indisponível.",
      );
    }
  }
  function discardEdit(index: number) {
    const row = rows[index]!;
    if (
      !data ||
      !window.confirm("Descartar as alterações ainda não salvas desta tarefa?")
    )
      return;
    const draft = data.drafts.find(
      (entry) => entry.definition.id === row.definition.id,
    );
    const reference =
      placement &&
      sqlExerciseReferences(placement).find(
        (entry) => entry.exerciseId === row.definition.id,
      );
    const published =
      reference &&
      data.published.find(
        (entry) =>
          entry.id === reference.exerciseId &&
          entry.version === reference.version,
      );
    const definition = draft?.definition ?? published;
    setRows((current) =>
      definition
        ? current.map((entry, position) =>
            position === index
              ? {
                  ...entry,
                  definition: editable(definition, data),
                  revision: draft?.revision ?? null,
                  dirty: false,
                }
              : entry,
          )
        : current.filter((_, position) => position !== index),
    );
    setError("");
    setMessage("Edição descartada; o vínculo da lição foi preservado.");
  }
  function remove(index: number) {
    const row = rows[index]!;
    if (
      !window.confirm(
        "Retirar esta tarefa da lição? O conteúdo reutilizável será preservado.",
      )
    )
      return;
    if (row.attached && placement) {
      const tasks = sqlExerciseReferences(placement)
        .map((reference, position) => ({
          taskId:
            placement.kind === "sql-task-sequence"
              ? placement.tasks[position]!.taskId
              : reference.exerciseId,
          exerciseId: reference.exerciseId,
          version: reference.version,
        }))
        .filter((task) => task.taskId !== row.taskId);
      if (!onSelect(tasks.length ? { kind: "sql-task-sequence", tasks } : null))
        return;
    }
    setRows((current) => current.filter((_, position) => position !== index));
  }
  const looseDrafts =
    data?.drafts.filter(
      (draft) =>
        draft.definition.id.startsWith(prefix) &&
        prefix &&
        !rows.some((row) => row.definition.id === draft.definition.id),
    ) ?? [];
  return (
    <section className="studio-sql-authoring" aria-label="Prática SQL da lição">
      <header>
        <h2>Prática SQL</h2>
        <p>
          Crie tarefas para esta lição. Salvar a explicação preserva a prática.
        </p>
      </header>
      {data && (
        <>
          <label>
            Dados da prática
            <select
              aria-label="Dados da prática"
              value={datasetKey}
              disabled={disabled || busy || !!placement || !!rows.length}
              onChange={(event) => setDatasetKey(event.target.value)}
            >
              {data.datasets.map((dataset) => (
                <option
                  key={dataset.id + "/" + dataset.version}
                  value={dataset.id + "/" + dataset.version}
                >
                  {dataset.title} · revisão {dataset.version}
                </option>
              ))}
            </select>
          </label>
          <ol className="studio-sql-task-editor">
            {rows.map((row, index) => (
              <li key={row.taskId}>
                <details open={!row.attached}>
                  <summary>
                    Tarefa {index + 1}: {row.definition.title || "Nova tarefa"}
                    {row.dirty
                      ? " · alterações não salvas"
                      : row.revision
                        ? " · rascunho salvo"
                        : row.attached
                          ? " · publicada"
                          : " · nova"}
                  </summary>
                  {row.definition.mode === "query" ? (
                    <fieldset disabled={disabled || busy || !!contentError}>
                      <label>
                        Título
                        <input
                          aria-label={`Título da tarefa ${index + 1}`}
                          value={row.definition.title}
                          onChange={(event) =>
                            change(index, {
                              title: event.target.value,
                              objective: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Instrução
                        <textarea
                          aria-label={`Instrução da tarefa ${index + 1}`}
                          value={row.definition.instructions}
                          rows={2}
                          onChange={(event) =>
                            change(index, { instructions: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        SQL inicial
                        <textarea
                          aria-label={`SQL inicial da tarefa ${index + 1}`}
                          value={row.definition.starterSql}
                          rows={2}
                          onChange={(event) =>
                            change(index, { starterSql: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Consulta esperada
                        <textarea
                          aria-label={`Consulta esperada da tarefa ${index + 1}`}
                          value={row.definition.assessment.reference[0] ?? ""}
                          rows={2}
                          onChange={(event) =>
                            change(index, {
                              assessment: {
                                reference: [event.target.value],
                                orderMatters:
                                  row.definition.mode === "query" &&
                                  row.definition.assessment.orderMatters,
                              },
                            })
                          }
                        />
                      </label>
                      <label className="studio-sql-order">
                        <input
                          type="checkbox"
                          aria-label={`Ordem das linhas da tarefa ${index + 1}`}
                          checked={row.definition.assessment.orderMatters}
                          onChange={(event) =>
                            change(index, {
                              assessment: {
                                reference: row.definition.assessment.reference,
                                orderMatters: event.target.checked,
                              },
                            })
                          }
                        />
                        A ordem das linhas faz parte da resposta
                      </label>
                      <label className="studio-sql-order">
                        <input
                          type="checkbox"
                          aria-label={`Publicar resultado esperado da tarefa ${index + 1}`}
                          checked={!!row.definition.formative}
                          onChange={(event) =>
                            change(index, {
                              formative: event.target.checked
                                ? { kind: "public-result" }
                                : undefined,
                            })
                          }
                        />
                        Permitir comparação local: o resultado esperado ficará
                        público. A consulta de referência permanece privada.
                      </label>
                      <div className="studio-sql-task-actions">
                        <button
                          type="button"
                          disabled={!row.dirty}
                          onClick={() => void action(() => saveTask(index))}
                        >
                          Salvar tarefa
                        </button>
                        <button
                          type="button"
                          disabled={row.dirty || !row.revision}
                          onClick={() => void action(() => publishTask(index))}
                        >
                          Publicar tarefa
                        </button>
                        <button
                          type="button"
                          onClick={() => previewTask(index)}
                        >
                          Prévia da tarefa
                        </button>
                        <button
                          type="button"
                          disabled={!row.dirty}
                          onClick={() => discardEdit(index)}
                        >
                          Descartar edição
                        </button>
                        <button type="button" onClick={() => remove(index)}>
                          Retirar tarefa
                        </button>
                      </div>
                    </fieldset>
                  ) : (
                    <p>
                      Esta atividade de alteração é mantida na{" "}
                      <a href="/studio/sql">biblioteca avançada</a>.
                    </p>
                  )}
                </details>
              </li>
            ))}
          </ol>
          <button
            type="button"
            disabled={
              disabled || busy || !!contentError || rows.length >= 12 || !prefix
            }
            onClick={add}
          >
            Adicionar tarefa SQL
          </button>
          {!!looseDrafts.length && (
            <details>
              <summary>Rascunhos salvos desta lição</summary>
              {looseDrafts.map((draft) => (
                <button
                  type="button"
                  key={draft.definition.id}
                  disabled={
                    busy ||
                    disabled ||
                    rows.length >= 12 ||
                    (!!rows[0] &&
                      (rows[0].definition.dataset.id !==
                        draft.definition.dataset.id ||
                        rows[0].definition.dataset.version !==
                          draft.definition.dataset.version))
                  }
                  onClick={() => {
                    setDatasetKey(
                      draft.definition.dataset.id +
                        "/" +
                        draft.definition.dataset.version,
                    );
                    setRows((current) => [
                      ...current,
                      {
                        ...draft,
                        taskId: draft.definition.id,
                        dirty: false,
                        attached: false,
                      },
                    ]);
                  }}
                >
                  Continuar “{draft.definition.title}”
                </button>
              ))}
            </details>
          )}
        </>
      )}
      {busy && <p role="status">Processando tarefa…</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {contentError && (
        <p role="alert">
          {contentError} Revise a fonte Markdown antes de alterar as tarefas.
        </p>
      )}
      {preview && (
        <section aria-label="Prévia da tarefa SQL">
          <h3>Prévia do rascunho</h3>
          <p>
            Execute para inspecionar os dados. Esta prévia não avalia a resposta
            nem publica a tarefa.
          </p>
          <button type="button" onClick={() => setPreview(null)}>
            Fechar prévia da tarefa
          </button>
          <SqlInteraction exercise={preview} previewOnly />
        </section>
      )}
      <details>
        <summary>Biblioteca e vínculos avançados</summary>
        <SqlExercisePicker
          source={source}
          disabled={disabled || busy || pending}
          onSelect={onSelect}
          onPendingChange={setAdvancedPending}
        />
        <a href="/studio/sql">Abrir biblioteca de exercícios e dados</a>
      </details>
    </section>
  );
}
