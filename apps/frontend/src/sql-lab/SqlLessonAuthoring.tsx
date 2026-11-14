import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { sqlRequest } from "./api";
import { editableSqlDraft, hasSavedSqlDraft } from "./sql-authoring-draft";
import { SqlExercisePicker } from "./SqlExercisePicker";
import {
  SqlDatasetPreview,
  SqlQueryPreview,
  SqlSequencePreview,
} from "./SqlAuthoringPreview";

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
  const [advancedPending, setAdvancedPending] = useState(false);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [showData, setShowData] = useState(false);
  const [showSequence, setShowSequence] = useState(false);
  const [testingTask, setTestingTask] = useState<string | null>(null);
  const [feedbackTask, setFeedbackTask] = useState<string | null>(null);
  const currentSource = useRef(source);
  const actionRunning = useRef(false);
  const pendingOrder = useRef<string[] | null>(null);
  useLayoutEffect(() => {
    currentSource.current = source;
  }, [source]);
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
    if (!pending && !advancedPending && !busy) return;
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
      setFeedbackTask(null);
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
  }, [pending, advancedPending, busy]);
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
          const latest =
            data.published
              .filter((entry) => entry.id === published.id)
              .sort((a, b) => b.version - a.version)[0] ?? published;
          const draft = data.drafts.find(
            (entry) =>
              entry.definition.id === reference.exerciseId &&
              entry.definition.version > latest.version,
          );
          return [
            {
              taskId:
                placement.kind === "sql-task-sequence"
                  ? placement.tasks[index]!.taskId
                  : reference.exerciseId,
              definition: editableSqlDraft(
                draft?.definition ?? latest,
                data.published,
              ),
              revision:
                data.drafts.find(
                  (entry) => entry.definition.id === reference.exerciseId,
                )?.revision ?? null,
              dirty: false,
              attached: true,
            },
          ];
        })
      : [];
    const order = pendingOrder.current;
    pendingOrder.current = null;
    setRows((current) => {
      if (current.some((row) => row.dirty)) return current;
      const next = [
        ...attached,
        ...current.filter(
          (row) =>
            !row.attached &&
            !attached.some(
              (entry) => entry.definition.id === row.definition.id,
            ),
        ),
      ];
      return order
        ? next.sort((a, b) => order.indexOf(a.taskId) - order.indexOf(b.taskId))
        : next;
    });
    const firstReference = placement && sqlExerciseReferences(placement)[0];
    const dataset =
      firstReference &&
      data.published.find(
        (entry) =>
          entry.id === firstReference.exerciseId &&
          entry.version === firstReference.version,
      )?.dataset;
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
    setOpenTask(id);
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
    requestAnimationFrame(() =>
      document.getElementById(`sql-task-title-${id}`)?.focus(),
    );
  }
  async function action(
    work: () => Promise<void>,
    taskId: string | null = null,
  ) {
    if (actionRunning.current) return;
    actionRunning.current = true;
    setFeedbackTask(taskId);
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
      actionRunning.current = false;
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
  function lessonTasks() {
    return placement
      ? sqlExerciseReferences(placement).map((reference, index) => ({
          taskId:
            placement.kind === "sql-task-sequence"
              ? placement.tasks[index]!.taskId
              : reference.exerciseId,
          ...reference,
        }))
      : [];
  }
  function tasksWithPublication(row: EditingTask, published: SqlDefinition) {
    const existing = lessonTasks();
    if (
      existing.some(
        (task) => !rows.some((entry) => entry.taskId === task.taskId),
      )
    )
      throw new Error(
        "Os vínculos da lição mudaram durante a edição. Preserve seu texto e atualize o estado salvo antes de aplicar a publicação.",
      );
    return rows.flatMap((entry) => {
      if (entry.taskId === row.taskId)
        return [
          {
            taskId: row.taskId,
            exerciseId: published.id,
            version: published.version,
          },
        ];
      const reference = existing.find((task) => task.taskId === entry.taskId);
      return reference ? [reference] : [];
    });
  }
  function assertCompatible(
    tasks: ReturnType<typeof lessonTasks>,
    inventory: Inventory,
  ) {
    validateSqlSequenceExercises(
      tasks.map((task) => {
        const definition = inventory.published.find(
          (entry) =>
            entry.id === task.exerciseId && entry.version === task.version,
        );
        const dataset =
          definition &&
          inventory.datasets.find(
            (entry) =>
              entry.id === definition.dataset.id &&
              entry.version === definition.dataset.version,
          );
        if (!definition || !dataset)
          throw new Error(
            "Dados da tarefa indisponíveis. Atualize o estado salvo.",
          );
        return publicSqlExercise(definition, dataset);
      }),
    );
  }
  async function linkPublication(
    index: number,
    published: SqlDefinition,
    inventory: Inventory,
  ) {
    const originalSource = source;
    if (currentSource.current !== originalSource)
      throw new Error(
        "A lição mudou. A publicação foi preservada; tente vincular novamente.",
      );
    const tasks = tasksWithPublication(rows[index]!, published);
    assertCompatible(tasks, inventory);
    const exercises = await Promise.all(
      tasks.map(async (task) => {
        const exercise = parsePublicSqlExercise(
          await sqlRequest(`/exercises/${task.exerciseId}/${task.version}`),
        );
        if (
          exercise.id !== task.exerciseId ||
          exercise.version !== task.version
        )
          throw new Error("A versão recebida não corresponde à tarefa.");
        return exercise;
      }),
    );
    validateSqlSequenceExercises(exercises);
    if (currentSource.current !== originalSource)
      throw new Error(
        "A lição mudou. Use Vincular publicação à lição para recuperar.",
      );
    pendingOrder.current = rows.map((row) => row.taskId);
    if (!onSelect({ kind: "sql-task-sequence", tasks }))
      throw new Error(
        "Tarefa publicada; o vínculo não foi aplicado porque a lição mudou. Use Vincular publicação à lição para recuperar.",
      );
    setRows((current) =>
      current.map((row) => ({
        ...row,
        attached: tasks.some((task) => task.taskId === row.taskId),
      })),
    );
    setMessage(
      "Tarefa publicada e aplicada ao rascunho da lição. Salve a lição para concluir.",
    );
  }
  async function publishTask(index: number) {
    const row = rows[index]!;
    if (!row.revision || row.dirty || !hasSavedDraft(row))
      throw new Error("Salve a tarefa antes de publicar.");
    if (!row.definition.formative)
      throw new Error(
        "Para usar esta tarefa na sequência, autorize explicitamente o resultado esperado público e salve a tarefa.",
      );
    const definition = parseSqlDefinition(row.definition);
    if (!data) throw new Error("Inventário indisponível.");
    // Check integrity before publishing, then recheck the live lesson before linking.
    const planned = { ...definition, status: "published" as const };
    const selectedDataset = data.datasets.find(
      (entry) =>
        entry.id === definition.dataset.id &&
        entry.version === definition.dataset.version,
    );
    if (!selectedDataset) throw new Error("Dataset indisponível.");
    // Drafts have no canonical oracle yet: check mode/dataset without manufacturing one.
    if (definition.mode !== "query")
      throw new Error(
        "Use a biblioteca avançada para atividades de alteração.",
      );
    for (const reference of lessonTasks()) {
      if (reference.taskId === row.taskId) continue;
      const other = data.published.find(
        (entry) =>
          entry.id === reference.exerciseId &&
          entry.version === reference.version,
      );
      if (
        !other ||
        other.dataset.id !== definition.dataset.id ||
        other.dataset.version !== definition.dataset.version
      )
        throw new Error(
          "Todas as tarefas devem usar o mesmo dataset e versão. O rascunho foi preservado.",
        );
    }
    setLessonSqlPlacement(source, {
      kind: "sql-task-sequence",
      tasks: tasksWithPublication(row, planned),
    });
    let published: SqlDefinition;
    try {
      published = parseSqlDefinition(
        await sqlRequest(
          `/authoring/drafts/${row.definition.id}/publish`,
          "POST",
          { revision: row.revision },
        ),
      );
    } catch (failure) {
      throw new Error(
        `Não foi possível confirmar a publicação. O rascunho foi preservado; use Atualizar estado salvo antes de tentar novamente. ${failure instanceof Error ? failure.message : "Serviço indisponível."}`,
      );
    }
    if (
      published.status !== "published" ||
      published.id !== definition.id ||
      published.version !== definition.version
    )
      throw new Error(
        "Publicação sem confirmação válida. Atualize o estado salvo antes de tentar novamente.",
      );
    const next = {
      ...data,
      published: [...data.published, published],
      drafts: data.drafts,
    };
    // Record the durable version before any subsequent request can fail.
    setData(next);
    setRows((current) =>
      current.map((entry) =>
        entry.taskId === row.taskId
          ? {
              ...entry,
              definition: editableSqlDraft(published, next.published),
              revision: row.revision,
              dirty: false,
            }
          : entry,
      ),
    );
    try {
      await linkPublication(index, published, next);
    } catch (failure) {
      throw new Error(
        `Tarefa publicada, mas o vínculo ficou pendente. ${failure instanceof Error ? failure.message : "Use Vincular publicação à lição para recuperar."}`,
      );
    }
  }
  function move(index: number, offset: number) {
    const next = [...rows];
    const other = index + offset;
    if (
      other < 0 ||
      other >= next.length ||
      busy ||
      disabled ||
      advancedPending
    )
      return;
    [next[index], next[other]] = [next[other]!, next[index]!];
    const existing = lessonTasks();
    if (
      existing.some((task) => !next.some((row) => row.taskId === task.taskId))
    ) {
      setFeedbackTask(null);
      setError(
        "Os vínculos da lição mudaram. Preserve sua edição e atualize o estado salvo antes de reordenar.",
      );
      return;
    }
    const tasks = next.flatMap((row) => {
      const reference = existing.find((task) => task.taskId === row.taskId);
      return reference ? [reference] : [];
    });
    pendingOrder.current = next.map((row) => row.taskId);
    if (tasks.length && !onSelect({ kind: "sql-task-sequence", tasks })) {
      pendingOrder.current = null;
      return;
    }
    setRows(next);
    setFeedbackTask(null);
    setError("");
    setMessage(
      "Ordem atualizada no rascunho. Salve a lição; tarefas ainda não publicadas serão vinculadas nessa ordem ao publicar.",
    );
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
                  definition: editableSqlDraft(definition, data.published),
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
    setFeedbackTask(null);
    setError("");
    setMessage(
      "Tarefa retirada do rascunho; o conteúdo reutilizável foi preservado. Salve a lição.",
    );
  }
  const looseDrafts =
    data && prefix
      ? [
          ...data.drafts,
          ...data.published
            .filter(
              (entry) =>
                entry.id.startsWith(prefix) &&
                !data.drafts.some(
                  (draft) => draft.definition.id === entry.id,
                ) &&
                !data.published.some(
                  (other) =>
                    other.id === entry.id && other.version > entry.version,
                ),
            )
            .map((definition) => ({
              definition: editableSqlDraft(definition, data.published),
              revision: null,
            })),
        ].filter(
          (draft) =>
            draft.definition.id.startsWith(prefix) &&
            prefix &&
            !rows.some((row) => row.definition.id === draft.definition.id),
        )
      : [];
  const dataset = data?.datasets.find(
    (entry) => entry.id + "/" + entry.version === datasetKey,
  );
  const latestPublished = (id: string) =>
    data?.published
      .filter((entry) => entry.id === id)
      .sort((a, b) => b.version - a.version)[0];
  const hasSavedDraft = (row: EditingTask) =>
    hasSavedSqlDraft(row.definition, data?.drafts ?? []);
  const taskStatus = (row: EditingTask) => {
    if (row.dirty) return "alterações não salvas";
    const published = latestPublished(row.definition.id);
    const linked = lessonTasks().find((task) => task.taskId === row.taskId);
    if (published && (!linked || published.version > linked.version))
      return hasSavedDraft(row)
        ? "rascunho salvo · publicação anterior sem vínculo"
        : "publicada · vínculo pendente";
    if (hasSavedDraft(row))
      return row.attached
        ? "rascunho salvo · lição usa publicação anterior"
        : "rascunho salvo";
    return row.attached ? "publicada e vinculada" : "nova";
  };
  return (
    <section className="studio-sql-authoring" aria-label="Prática SQL da lição">
      <header>
        <h2>Prática SQL</h2>
        <p>
          Defina as tarefas e confira o que o aluno verá. A publicação é uma
          ação explícita.
        </p>
      </header>
      {data && (
        <>
          <label>
            Dados da prática
            <select
              aria-label="Dados da prática"
              value={datasetKey}
              disabled={
                disabled ||
                busy ||
                advancedPending ||
                !!contentError ||
                !!placement ||
                !!rows.length
              }
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
          <p className="studio-caption">
            Todas as tarefas usam os mesmos dados. Para trocar o dataset, retire
            os vínculos e tarefas desta prática; rascunhos salvos e publicações
            continuam na biblioteca.
          </p>
          <div className="studio-sql-task-actions">
            <button
              type="button"
              aria-expanded={showData}
              disabled={!dataset}
              onClick={() => setShowData(!showData)}
            >
              {showData ? "Fechar dados" : "Inspecionar dados"}
            </button>
            <button
              type="button"
              aria-expanded={showSequence}
              disabled={!rows.length}
              onClick={() => setShowSequence(!showSequence)}
            >
              {showSequence ? "Fechar sequência" : "Prévia da sequência"}
            </button>
          </div>
          {showData && dataset && (
            <SqlDatasetPreview key={datasetKey} dataset={dataset} />
          )}
          {showSequence && <SqlSequencePreview tasks={rows} />}
          <ol className="studio-sql-task-editor">
            {rows.map((row, index) => (
              <li key={row.taskId}>
                <details open={openTask === row.taskId}>
                  <summary
                    onClick={(event) => {
                      event.preventDefault();
                      setOpenTask(openTask === row.taskId ? null : row.taskId);
                    }}
                  >
                    Tarefa {index + 1}: {row.definition.title || "Nova tarefa"}
                    <span className="studio-sql-task-status">
                      {taskStatus(row)}
                    </span>
                  </summary>
                  {row.definition.mode === "query" &&
                  row.definition.assessment.reference.length === 1 ? (
                    <fieldset
                      disabled={
                        disabled || busy || advancedPending || !!contentError
                      }
                    >
                      <label>
                        Título
                        <input
                          id={`sql-task-title-${row.taskId}`}
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
                          className="studio-sql-save"
                          onClick={() =>
                            void action(() => saveTask(index), row.taskId)
                          }
                        >
                          Salvar tarefa
                        </button>
                        <button
                          type="button"
                          disabled={
                            row.dirty || !row.revision || !hasSavedDraft(row)
                          }
                          className="studio-sql-publish"
                          onClick={() =>
                            void action(() => publishTask(index), row.taskId)
                          }
                        >
                          Publicar tarefa
                        </button>
                        <button
                          type="button"
                          aria-expanded={testingTask === row.taskId}
                          onClick={() =>
                            setTestingTask(
                              testingTask === row.taskId ? null : row.taskId,
                            )
                          }
                        >
                          {testingTask === row.taskId
                            ? "Fechar teste local"
                            : "Testar consultas"}
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
                      {latestPublished(row.definition.id) &&
                        latestPublished(row.definition.id)!.version !==
                          lessonTasks().find(
                            (task) => task.taskId === row.taskId,
                          )?.version && (
                          <button
                            type="button"
                            onClick={() =>
                              void action(
                                () =>
                                  linkPublication(
                                    index,
                                    latestPublished(row.definition.id)!,
                                    data!,
                                  ),
                                row.taskId,
                              )
                            }
                          >
                            Vincular publicação à lição
                          </button>
                        )}
                      {openTask === row.taskId &&
                        testingTask === row.taskId &&
                        (() => {
                          const taskDataset = data.datasets.find(
                            (entry) =>
                              entry.id === row.definition.dataset.id &&
                              entry.version === row.definition.dataset.version,
                          );
                          return taskDataset ? (
                            <SqlQueryPreview
                              key={JSON.stringify(row.definition)}
                              definition={row.definition}
                              dataset={taskDataset}
                            />
                          ) : (
                            <p role="alert">Dataset da tarefa indisponível.</p>
                          );
                        })()}
                    </fieldset>
                  ) : (
                    <p>
                      Esta atividade exige o contrato completo e pode ser
                      editada na <a href="/studio/sql">biblioteca avançada</a>.
                    </p>
                  )}
                  {feedbackTask === row.taskId && (
                    <>
                      {busy && <p role="status">Processando tarefa…</p>}
                      {message && <p role="status">{message}</p>}
                      {error && <p role="alert">{error}</p>}
                    </>
                  )}
                </details>
                <div className="studio-sql-task-actions studio-sql-row-actions">
                  <button
                    type="button"
                    aria-label={`Subir tarefa ${index + 1}`}
                    disabled={
                      disabled ||
                      busy ||
                      advancedPending ||
                      !!contentError ||
                      index === 0
                    }
                    onClick={() => move(index, -1)}
                  >
                    Subir
                  </button>
                  <button
                    type="button"
                    aria-label={`Descer tarefa ${index + 1}`}
                    disabled={
                      disabled ||
                      busy ||
                      advancedPending ||
                      !!contentError ||
                      index === rows.length - 1
                    }
                    onClick={() => move(index, 1)}
                  >
                    Descer
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            disabled={
              disabled ||
              busy ||
              advancedPending ||
              !!contentError ||
              rows.length >= 12 ||
              !prefix
            }
            onClick={add}
          >
            Adicionar tarefa SQL
          </button>
          {!!looseDrafts.length && (
            <details>
              <summary>Rascunhos e publicações desta lição</summary>
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
                    setOpenTask(draft.definition.id);
                    setDatasetKey(
                      draft.definition.dataset.id +
                        "/" +
                        draft.definition.dataset.version,
                    );
                    setRows((current) => [
                      ...current,
                      {
                        ...draft,
                        definition: editableSqlDraft(
                          draft.definition,
                          data.published,
                        ),
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
      {!feedbackTask && (
        <>
          {busy && <p role="status">Processando tarefa…</p>}
          {message && <p role="status">{message}</p>}
          {error && <p role="alert">{error}</p>}
        </>
      )}
      {error && (
        <button
          type="button"
          disabled={busy || disabled || pending}
          onClick={() =>
            void action(async () => {
              setData(parseInventory(await sqlRequest("/authoring")));
              setMessage(
                "Estado salvo atualizado. Confira rascunhos e publicações pendentes antes de tentar publicar novamente.",
              );
            })
          }
        >
          Atualizar estado salvo
        </button>
      )}
      {contentError && (
        <p role="alert">
          {contentError} Revise a fonte Markdown antes de alterar as tarefas.
        </p>
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
