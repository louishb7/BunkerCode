import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Page } from "../courses/Page";
import { sqlRequest } from "./api";
import {
  parseSqlDataset,
  parseSqlDefinition,
  publicSqlExercise,
  sqlObject,
  type SqlDataset,
  type SqlDefinition,
  type PublicSqlExercise,
} from "@bunkercode/content/sql";
import { SqlInteraction } from "./SqlInteraction";
import "./sql-lab.css";
interface Draft {
  definition: SqlDefinition;
  revision: string;
}
interface Inventory {
  drafts: Draft[];
  published: SqlDefinition[];
  datasets: SqlDataset[];
}
function inventory(value: unknown): Inventory {
  const v = sqlObject(value, ["drafts", "published", "datasets"]);
  if (
    !Array.isArray(v.drafts) ||
    !Array.isArray(v.published) ||
    !Array.isArray(v.datasets)
  )
    throw new Error("Inventário SQL inválido.");
  return {
    drafts: v.drafts.map((value) => {
      const d = sqlObject(value, ["definition", "revision"]);
      if (typeof d.revision !== "string") throw new Error("Revisão inválida.");
      return {
        definition: parseSqlDefinition(d.definition),
        revision: d.revision,
      };
    }),
    published: v.published.map(parseSqlDefinition),
    datasets: v.datasets.map(parseSqlDataset),
  };
}
const emptyDataset: SqlDataset = {
  format: 1,
  id: "novo-dataset",
  version: 1,
  title: "Dados fictícios — exemplo inicial",
  tables: [
    {
      name: "items",
      columns: [
        {
          name: "id",
          type: "integer",
          nullable: false,
          primaryKey: true,
          references: null,
        },
        {
          name: "name",
          type: "text",
          nullable: false,
          primaryKey: false,
          references: null,
        },
      ],
      rows: [[1, "Exemplo"]],
    },
  ],
};
export default function SqlAuthoring() {
  const [data, setData] = useState<Inventory | null>(null);
  const [draft, setDraft] = useState<SqlDefinition | null>(null);
  const [revision, setRevision] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PublicSqlExercise | null>(null);
  const [datasetText, setDatasetText] = useState(
    JSON.stringify(emptyDataset, null, 2),
  );
  const load = async () => {
    const next = inventory(await sqlRequest("/authoring"));
    setData(next);
    return next;
  };
  useEffect(() => {
    const abort = new AbortController();
    void sqlRequest("/authoring", "GET", undefined, abort.signal)
      .then((value) => setData(inventory(value)))
      .catch((e: unknown) => {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : "Studio indisponível.");
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const leave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  function choose(
    definition: SqlDefinition | null,
    currentRevision: string | null = null,
  ) {
    if (
      dirty &&
      !window.confirm("Descartar as alterações não salvas deste exercício?")
    )
      return;
    const published =
      definition && data?.published.filter((d) => d.id === definition.id);
    const next = definition
      ? {
          ...definition,
          status: "draft" as const,
          version:
            definition.status === "published"
              ? Math.max(...(published ?? []).map((d) => d.version)) + 1
              : definition.version,
        }
      : {
          format: 1 as const,
          id: "",
          version: 1,
          status: "draft" as const,
          title: "",
          objective: "",
          instructions: "",
          starterSql: "SELECT * FROM customers;",
          mode: "query" as const,
          dataset: {
            id: data?.datasets[0]?.id ?? "",
            version: data?.datasets[0]?.version ?? 1,
          },
          assessment: {
            reference: ["SELECT id, name FROM customers"],
            orderMatters: false,
          },
        };
    setDraft(next);
    setRevision(currentRevision);
    setDirty(!definition || definition.status === "published");
    setPreview(null);
    setError("");
    setMessage(
      "Rascunho em edição. Salve explicitamente para gravar o arquivo.",
    );
  }
  function change(patch: Partial<SqlDefinition>) {
    if (draft) {
      setDraft({ ...draft, ...patch });
      setDirty(true);
      setPreview(null);
      setMessage("Alterações não salvas.");
    }
  }
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível concluir. Seu texto continua no editor.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!draft) return;
    const value = sqlObject(
      await sqlRequest("/authoring/drafts", "PUT", {
        definition: parseSqlDefinition(draft),
        revision,
      }),
      ["definition", "revision"],
    );
    if (typeof value.revision !== "string")
      throw new Error("Revisão não confirmada.");
    setDraft(parseSqlDefinition(value.definition));
    setRevision(value.revision);
    setDirty(false);
    await load();
    setMessage("Rascunho salvo no arquivo. Ainda não está publicado.");
  }
  function showPreview() {
    if (!draft || !data) return;
    try {
      const definition = parseSqlDefinition(draft);
      const dataset = data.datasets.find(
        (d) => d.id === draft.dataset.id && d.version === draft.dataset.version,
      );
      if (!dataset) throw new Error("Selecione um dataset publicado.");
      setPreview(publicSqlExercise(definition, dataset));
      setError("");
      setMessage(
        "Prévia do rascunho. Nenhuma publicação ou conclusão foi feita.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prévia inválida.");
    }
  }
  const publishedVersion =
    !!draft &&
    !!data?.published.some(
      (d) => d.id === draft.id && d.version === draft.version,
    );
  return (
    <Page title="Studio · Atividades SQL" className="sql-lab sql-authoring">
      <header>
        <p className="eyebrow">Studio</p>
        <h1>Atividades SQL</h1>
        <p>
          Crie uma versão, teste a referência e publique. Os arquivos são a
          fonte canônica; o Studio não faz commits.
        </p>
        <Link to="/courses">Voltar aos cursos</Link>
      </header>
      {error && <p role="alert">{error} O texto em edição foi preservado.</p>}
      <p role="status">{busy ? "Processando…" : message}</p>
      {!data ? (
        <p>Carregando acervo…</p>
      ) : (
        <>
          <section className="sql-challenge">
            <h2>Acervo versionado</h2>
            <div className="sql-actions">
              <button disabled={busy} onClick={() => choose(null)}>
                Novo exercício
              </button>
              <label>
                Abrir rascunho
                <select
                  aria-label="Abrir rascunho"
                  value=""
                  disabled={busy}
                  onChange={(e) => {
                    const d = data.drafts.find(
                      (d) => d.definition.id === e.target.value,
                    );
                    if (d) choose(d.definition, d.revision);
                  }}
                >
                  <option value="">Selecione…</option>
                  {data.drafts
                    .filter(
                      (d) =>
                        !data.published.some(
                          (p) =>
                            p.id === d.definition.id &&
                            p.version === d.definition.version,
                        ),
                    )
                    .map((d) => (
                      <option key={d.definition.id} value={d.definition.id}>
                        {d.definition.title} · v{d.definition.version}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Criar próxima versão
                <select
                  aria-label="Criar próxima versão"
                  value=""
                  disabled={busy}
                  onChange={(e) => {
                    const d = data.published.find(
                      (d) => d.id + "/" + d.version === e.target.value,
                    );
                    if (d) {
                      const existing = data.drafts.find(
                        (item) => item.definition.id === d.id,
                      );
                      choose(d, existing?.revision ?? null);
                    }
                  }}
                >
                  <option value="">Publicado · selecione…</option>
                  {data.published.map((d) => (
                    <option
                      key={d.id + d.version}
                      value={d.id + "/" + d.version}
                    >
                      {d.title} · v{d.version}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          <details className="sql-challenge">
            <summary>Datasets reutilizáveis</summary>
            <p>
              Estrutura explícita em JSON: tabelas, colunas tipadas e linhas
              fictícias. Não aceita scripts de inicialização. Versões publicadas
              são imutáveis.
            </p>
            <label>
              Definição do dataset
              <textarea
                aria-label="Definição do dataset"
                rows={14}
                value={datasetText}
                onChange={(e) => setDatasetText(e.target.value)}
                disabled={busy}
                spellCheck={false}
              />
            </label>
            <button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await sqlRequest(
                    "/authoring/datasets",
                    "PUT",
                    parseSqlDataset(JSON.parse(datasetText)),
                  );
                  await load();
                  setMessage(
                    "Dataset publicado em arquivo. Agora selecione-o no exercício.",
                  );
                })
              }
            >
              Salvar dataset
            </button>
          </details>
          {draft && (
            <fieldset
              disabled={busy || publishedVersion}
              className="sql-authoring-fields"
            >
              <legend>
                {publishedVersion ? "Publicado · imutável" : "Rascunho"} · v
                {draft.version}
              </legend>
              <div className="sql-form-grid">
                <label>
                  ID estável
                  <input
                    aria-label="ID do exercício"
                    value={draft.id}
                    disabled={revision !== null}
                    onChange={(e) => change({ id: e.target.value })}
                  />
                </label>
                <label>
                  Título
                  <input
                    value={draft.title}
                    onChange={(e) => change({ title: e.target.value })}
                  />
                </label>
              </div>
              <label>
                Objetivo
                <textarea
                  value={draft.objective}
                  rows={2}
                  onChange={(e) => change({ objective: e.target.value })}
                />
              </label>
              <label>
                Instruções públicas
                <textarea
                  value={draft.instructions}
                  rows={3}
                  onChange={(e) => change({ instructions: e.target.value })}
                />
              </label>
              <div className="sql-form-grid">
                <label>
                  Modo
                  <select
                    value={draft.mode}
                    onChange={(e) =>
                      change({
                        mode: e.target.value === "query" ? "query" : "mutation",
                      })
                    }
                  >
                    <option value="query">Consulta · SELECT</option>
                    <option value="mutation">
                      Alteração · INSERT, UPDATE, DELETE
                    </option>
                  </select>
                </label>
                <label>
                  Dataset
                  <select
                    aria-label="Dataset do exercício"
                    value={draft.dataset.id + "/" + draft.dataset.version}
                    onChange={(e) => {
                      const d = data.datasets.find(
                        (d) => d.id + "/" + d.version === e.target.value,
                      );
                      if (d)
                        change({ dataset: { id: d.id, version: d.version } });
                    }}
                  >
                    {data.datasets.map((d) => (
                      <option
                        key={d.id + d.version}
                        value={d.id + "/" + d.version}
                      >
                        {d.title} · v{d.version}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                SQL inicial público
                <textarea
                  value={draft.starterSql}
                  rows={3}
                  spellCheck={false}
                  onChange={(e) => change({ starterSql: e.target.value })}
                />
              </label>
              <section className="sql-challenge">
                <h2>Avaliação privada</h2>
                <p>
                  A referência fica no acervo de avaliação. Ela não é entregue
                  ao aluno. Um comando por campo, em ordem.
                </p>
                {draft.assessment.reference.map((sql, index) => (
                  <label key={index}>
                    Referência {index + 1}
                    <textarea
                      aria-label={`Referência ${index + 1}`}
                      value={sql}
                      rows={3}
                      spellCheck={false}
                      onChange={(e) =>
                        change({
                          assessment: {
                            ...draft.assessment,
                            reference: draft.assessment.reference.map(
                              (item, i) =>
                                i === index ? e.target.value : item,
                            ),
                          },
                        })
                      }
                    />
                  </label>
                ))}
                {draft.mode === "mutation" && (
                  <div className="sql-actions">
                    <button
                      disabled={draft.assessment.reference.length >= 20}
                      onClick={() =>
                        change({
                          assessment: {
                            ...draft.assessment,
                            reference: [...draft.assessment.reference, ""],
                          },
                        })
                      }
                    >
                      Adicionar passo
                    </button>
                    <button
                      disabled={draft.assessment.reference.length <= 1}
                      onClick={() =>
                        change({
                          assessment: {
                            ...draft.assessment,
                            reference: draft.assessment.reference.slice(0, -1),
                          },
                        })
                      }
                    >
                      Remover último passo
                    </button>
                  </div>
                )}
                <label className="sql-checkbox">
                  <input
                    type="checkbox"
                    checked={draft.assessment.orderMatters}
                    onChange={(e) =>
                      change({
                        assessment: {
                          ...draft.assessment,
                          orderMatters: e.target.checked,
                        },
                      })
                    }
                  />
                  Exigir ordem das linhas (consulta com ORDER BY)
                </label>
              </section>
              <div className="sql-actions">
                <button onClick={showPreview}>Prévia do exercício</button>
                <button
                  className="sql-primary"
                  disabled={publishedVersion}
                  onClick={() => void action(save)}
                >
                  Salvar rascunho
                </button>
                <button
                  disabled={dirty || !revision || publishedVersion}
                  onClick={() =>
                    void action(async () => {
                      await sqlRequest(
                        `/authoring/drafts/${draft.id}/test`,
                        "POST",
                        { revision },
                      );
                      setMessage(
                        "Referência aprovada no runner isolado. Nenhuma publicação foi feita.",
                      );
                    })
                  }
                >
                  Testar referência
                </button>
                <button
                  disabled={dirty || !revision || publishedVersion}
                  onClick={() =>
                    void action(async () => {
                      const published = parseSqlDefinition(
                        await sqlRequest(
                          `/authoring/drafts/${draft.id}/publish`,
                          "POST",
                          { revision },
                        ),
                      );
                      await load();
                      setMessage(
                        `Publicado: ${published.id} v${published.version}. Copie o bloco abaixo para a lição no Studio.`,
                      );
                    })
                  }
                >
                  Publicar versão
                </button>
              </div>
              <p>
                Salvar, testar e publicar são ações explícitas. Para mudar uma
                versão publicada, crie a próxima versão.
              </p>
              <div>
                <p>Referência para a lição</p>
                <pre tabIndex={0} aria-label="Referência para a lição">
                  <code>
                    {"```bunker-sql\n" +
                      JSON.stringify({
                        kind: "sql",
                        exerciseId: draft.id,
                        version: draft.version,
                      }) +
                      "\n```"}
                  </code>
                </pre>
              </div>
            </fieldset>
          )}
          {preview && (
            <section aria-label="Prévia do exercício SQL">
              <h2>
                Prévia pública · {preview.id} v{preview.version}
              </h2>
              <SqlInteraction
                key={JSON.stringify(preview)}
                exercise={preview}
                previewOnly
              />
            </section>
          )}
        </>
      )}
    </Page>
  );
}
