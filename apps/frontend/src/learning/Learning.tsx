import { useEffect, useRef, useState } from "react";
import { Link, Route, Routes, useParams } from "react-router";
import { learningApi } from "./api";
import type { Attempt, Draft, LearningActivity, Submission } from "./types";
import "./learning.css";
const pointer = (activity: string) => `bunkercode.attempt.${activity}`;
const journal = (id: string) => `bunkercode.draft.${id}`;
const message = (error: unknown) =>
  error instanceof Error ? error.message : "A operação falhou.";
function Catalog() {
  const [activities, setActivities] = useState<LearningActivity[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    void learningApi
      .activities()
      .then(setActivities)
      .catch((e) => setError(message(e)));
  }, []);
  return (
    <>
      <h1>Backend, na prática</h1>
      <p>Leia pouco, formule uma ideia e confronte-a com código em execução.</p>
      {error && <p role="alert">{error}</p>}
      <nav className="learning-catalog" aria-label="Atividades">
        {activities.map((activity) => (
          <Link key={activity.id} to={`/learn/${activity.id}`}>
            <strong>{activity.title}</strong>
            <span>
              {activity.kind === "prediction"
                ? "Previsão · request real · edição"
                : "TypeScript · função · testes"}
            </span>
          </Link>
        ))}
      </nav>
      <p className="learning-note">
        Execução local de código confiável do autor. As atividades não executam
        automaticamente.
      </p>
    </>
  );
}
function Result({ submission }: { submission: Submission }) {
  const result = submission.result;
  return (
    <article
      className="learning-result"
      data-testid={`submission-${submission.number}`}
    >
      <h3>Submissão {submission.number}</h3>
      <p>Revisão {submission.draftRevision} · fonte preservada</p>
      {submission.prediction && (
        <>
          <p>
            Previsão: HTTP {submission.prediction.status}, estoque{" "}
            {submission.prediction.stock}, pedidos{" "}
            {submission.prediction.orders}.
          </p>
          <blockquote>{submission.justification}</blockquote>
        </>
      )}
      <details>
        <summary>Código desta submissão</summary>
        <pre>{submission.source}</pre>
      </details>
      {!result ? (
        <p role="status">
          Execução pendente. Recarregue para recuperar o resultado.
        </p>
      ) : (
        <>
          {result.status !== "completed" ? (
            <div role="alert">
              <strong>
                {result.status === "compilation_error"
                  ? result.kind === "tests"
                    ? "Erro de compilação — testes não executados"
                    : "Erro de compilação — request não executada"
                  : result.status === "timeout"
                    ? "Tempo excedido — execução encerrada"
                    : result.status === "interrupted"
                      ? "Execução interrompida"
                      : "Erro técnico"}
              </strong>
              {result.diagnostics.map((d, i) => (
                <p key={i}>
                  {d.line ? `Linha ${d.line}:${d.column ?? 1}: ` : ""}
                  {d.message}
                </p>
              ))}
            </div>
          ) : (
            <>
              {result.kind === "order" && result.observation && (
                <section aria-label="Evidência HTTP">
                  <h4>Fatos observados</h4>
                  <p>
                    POST /orders · quantidade{" "}
                    {result.observation.request.body.quantity}
                  </p>
                  <p>
                    <strong>HTTP {result.observation.response.status}</strong>
                  </p>
                  <p>
                    Estado inicial: estoque{" "}
                    {result.observation.initialState.stock}, pedidos{" "}
                    {result.observation.initialState.orders}
                  </p>
                  <p>
                    Estado final: estoque {result.observation.finalState.stock},
                    pedidos {result.observation.finalState.orders}
                  </p>
                  <details>
                    <summary>Resposta recebida</summary>
                    <pre>
                      {JSON.stringify(
                        result.observation.response.body,
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </section>
              )}
              {result.kind === "tests" && (
                <section aria-label="Resultado dos testes">
                  <h4>Casos executados</h4>
                  {result.cases.map((c) => (
                    <div
                      key={c.name}
                      className={c.passed ? "case-pass" : "case-fail"}
                    >
                      <strong>
                        {c.passed ? "✓" : "✗"} {c.name}
                      </strong>
                      {!c.passed && (
                        <>
                          <p>
                            Esperado: <code>{c.expected}</code>
                          </p>
                          <p>
                            Recebido: <code>{c.received}</code>
                          </p>
                          <details>
                            <summary>Diagnóstico do caso</summary>
                            <pre>{c.message}</pre>
                          </details>
                        </>
                      )}
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
          {submission.feedback && (
            <section aria-label="Feedback">
              <h4>Comparação e próximo passo</h4>
              {submission.feedback.comparisons.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>Fato</th>
                      <th>Previsto</th>
                      <th>Observado</th>
                      <th>Comparação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submission.feedback.comparisons.map((c) => (
                      <tr key={c.label}>
                        <td>{c.label}</td>
                        <td>{c.expected}</td>
                        <td>{c.actual}</td>
                        <td>{c.matches ? "Coincide" : "Difere"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p>{submission.feedback.message}</p>
            </section>
          )}
          <details>
            <summary>Detalhes da execução</summary>
            <p>
              {result.durationMs === null
                ? "Duração não confirmada"
                : `${result.durationMs} ms`}{" "}
              · {result.nodeVersion} · TypeScript {result.typescriptVersion}
            </p>
            {result.truncated && (
              <p>Saída truncada pelo limite do instrumento.</p>
            )}
            <pre>
              {result.stdout}
              {result.stderr}
            </pre>
            <p>
              Os resultados se referem somente à fonte e às condições desta
              submissão.
            </p>
          </details>
        </>
      )}
    </article>
  );
}
function ActivityPage({ id }: { id: string }) {
  const [activity, setActivity] = useState<LearningActivity | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [draft, setDraft] = useState<Draft>({
    source: "",
    prediction: null,
    justification: "",
  });
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("");
  const [busy, setBusy] = useState(false);
  const [reflection, setReflection] = useState("");
  const attemptRef = useRef<Attempt | null>(null);
  const draftRef = useRef(draft);
  const generation = useRef(0);
  const savedGeneration = useRef(0);
  const saving = useRef<Promise<void> | null>(null);
  const alive = useRef(true);
  function accept(next: Attempt) {
    attemptRef.current = next;
    if (alive.current) setAttempt(next);
  }
  function restore(next: Attempt) {
    accept(next);
    let recovered = next.draft;
    const raw = sessionStorage.getItem(journal(next.id));
    if (raw) {
      try {
        const local = JSON.parse(raw) as { revision: number; draft: Draft };
        if (local.revision === next.revision) {
          recovered = local.draft;
          generation.current = 1;
          savedGeneration.current = 0;
        } else {
          setError(
            "Existe um rascunho local de outra revisão. O texto foi preservado: use Recuperar rascunho local para revisá-lo.",
          );
        }
      } catch {
        setError(
          "Não foi possível ler o rascunho local. A versão salva no servidor foi preservada.",
        );
      }
    }
    draftRef.current = recovered;
    setDraft(recovered);
    setReflection(next.reflection);
  }
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    void (async () => {
      const definition = await learningApi.activity(id);
      if (cancelled) return;
      setActivity(definition);
      setDraft((current) => ({ ...current, source: definition.starter }));
      const stored = localStorage.getItem(pointer(id));
      if (stored) {
        const next = await learningApi.attempt(stored);
        if (!cancelled && next.activityId === id) restore(next);
      }
    })().catch((e) => {
      if (!cancelled) setError(message(e));
    });
    return () => {
      cancelled = true;
      alive.current = false;
    };
    // This effect initializes a keyed activity page; edits are managed separately.
  }, [id]);
  function edit(next: Draft) {
    draftRef.current = next;
    generation.current += 1;
    setDraft(next);
    setSaveState("Alterações pendentes");
    if (attemptRef.current)
      sessionStorage.setItem(
        journal(attemptRef.current.id),
        JSON.stringify({ revision: attemptRef.current.revision, draft: next }),
      );
  }
  async function persist(): Promise<void> {
    if (saving.current) return saving.current;
    if (!attemptRef.current || savedGeneration.current === generation.current)
      return;
    const current = attemptRef.current,
      source = draftRef.current,
      token = generation.current;
    setSaveState("Salvando…");
    const job = (async () => {
      try {
        const next = await learningApi.save(current, source);
        accept(next);
        savedGeneration.current = token;
        if (generation.current === token)
          sessionStorage.removeItem(journal(next.id));
        else
          sessionStorage.setItem(
            journal(next.id),
            JSON.stringify({
              revision: next.revision,
              draft: draftRef.current,
            }),
          );
        if (alive.current) {
          setSaveState(
            generation.current === token
              ? "Rascunho salvo"
              : "Alterações pendentes",
          );
          setError("");
        }
      } catch (e) {
        if (alive.current) {
          setError(message(e));
          setSaveState("Não salvo no servidor — cópia local preservada");
        }
        throw e;
      }
    })();
    saving.current = job;
    try {
      await job;
    } finally {
      saving.current = null;
    }
  }
  useEffect(() => {
    if (
      !attempt ||
      attempt.status === "completed" ||
      generation.current === savedGeneration.current ||
      saveState.startsWith("Não salvo")
    )
      return;
    const timer = window.setTimeout(() => {
      void persist().catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, attempt, saveState]);
  async function action(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (e) {
      setError(message(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function create() {
    const next = await learningApi.create(id);
    localStorage.setItem(pointer(id), next.id);
    generation.current = 0;
    savedGeneration.current = 0;
    restore(next);
    setSaveState("Rascunho salvo");
  }
  const editable =
    !!attempt &&
    attempt.status === "open" &&
    (activity?.kind === "code" || attempt.submissions.length > 0);
  const running = busy || !!attempt?.submissions.some((s) => !s.result);
  return (
    <>
      <Link to="/learn">← Atividades</Link>
      {activity && (
        <>
          <h1>{activity.title}</h1>
          <p>{activity.context}</p>
          <p>{activity.task}</p>
          <ul>
            {activity.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <details open>
            <summary>
              {activity.kind === "prediction"
                ? "Regra do handler HTTP"
                : "Casos declarados"}
            </summary>
            <pre>{activity.harnessExcerpt}</pre>
          </details>
          {error && (
            <div role="alert">
              {error}
              <button
                onClick={() =>
                  void action(async () => {
                    if (attemptRef.current) {
                      const next = await learningApi.attempt(
                        attemptRef.current.id,
                      );
                      accept(next);
                      setSaveState("Alterações pendentes");
                    }
                  })
                }
              >
                Atualizar revisão do servidor
              </button>
              {attempt && sessionStorage.getItem(journal(attempt.id)) && (
                <button
                  onClick={() => {
                    const local = JSON.parse(
                      sessionStorage.getItem(journal(attempt.id))!,
                    ) as { draft: Draft };
                    edit(local.draft);
                  }}
                >
                  Recuperar rascunho local
                </button>
              )}
            </div>
          )}
          {!attempt ? (
            <button
              className="learning-primary"
              disabled={busy}
              onClick={() => void action(create)}
            >
              Iniciar tentativa
            </button>
          ) : (
            <p className="learning-note">
              {attempt.status === "completed"
                ? "Tentativa concluída · reflexão registrada"
                : "Tentativa em andamento"}{" "}
              · <span role="status">{saveState}</span>
            </p>
          )}
          <label className="learning-editor">
            solution.ts
            <textarea
              aria-label="Código TypeScript"
              spellCheck={false}
              value={draft.source}
              disabled={!editable}
              onChange={(e) =>
                edit({
                  ...draft,
                  source: e.target.value,
                  ...(activity.kind === "prediction"
                    ? { prediction: null, justification: "" }
                    : {}),
                })
              }
              onKeyDown={(e) => {
                if (e.key === "Tab" && !e.shiftKey) {
                  e.preventDefault();
                  const node = e.currentTarget,
                    start = node.selectionStart,
                    end = node.selectionEnd;
                  edit({
                    ...draft,
                    source:
                      draft.source.slice(0, start) +
                      "  " +
                      draft.source.slice(end),
                    ...(activity.kind === "prediction"
                      ? { prediction: null, justification: "" }
                      : {}),
                  });
                  requestAnimationFrame(() =>
                    node.setSelectionRange(start + 2, start + 2),
                  );
                }
              }}
            />
          </label>
          {activity.kind === "prediction" && attempt && (
            <fieldset disabled={attempt.status === "completed"}>
              <legend>Sua previsão, antes da execução</legend>
              <div className="learning-prediction">
                {(["status", "stock", "orders"] as const).map((field) => (
                  <label key={field}>
                    {
                      {
                        status: "Status HTTP previsto",
                        stock: "Estoque final previsto",
                        orders: "Pedidos previstos",
                      }[field]
                    }
                    <input
                      type="number"
                      value={draft.prediction?.[field] ?? ""}
                      onChange={(e) => {
                        const next = { ...draft.prediction };
                        if (e.target.value === "") delete next[field];
                        else next[field] = Number(e.target.value);
                        edit({ ...draft, prediction: next });
                      }}
                    />
                  </label>
                ))}
              </div>
              <label>
                Justificativa
                <textarea
                  aria-label="Justificativa"
                  value={draft.justification}
                  onChange={(e) =>
                    edit({ ...draft, justification: e.target.value })
                  }
                />
              </label>
            </fieldset>
          )}
          {attempt?.status === "open" && (
            <div className="learning-actions">
              <button disabled={busy} onClick={() => void action(persist)}>
                Salvar rascunho
              </button>
              <button
                disabled={busy || !editable}
                onClick={() =>
                  edit({
                    ...draft,
                    source: activity.starter,
                    prediction: null,
                    justification: "",
                  })
                }
              >
                Restaurar código inicial
              </button>
              <button
                className="learning-primary"
                disabled={running}
                onClick={() =>
                  void action(async () => {
                    while (generation.current !== savedGeneration.current)
                      await persist();
                    accept(await learningApi.submit(attemptRef.current!));
                  })
                }
              >
                {busy
                  ? "Executando…"
                  : activity.kind === "prediction"
                    ? "Submeter previsão e executar"
                    : "Submeter código e rodar testes"}
              </button>
            </div>
          )}
          {attempt && attempt.submissions.length > 0 && (
            <section aria-label="Submissões">
              <h2>Suas submissões</h2>
              <p>
                Cada resultado pertence ao código preservado abaixo. Editar o
                rascunho não altera resultados anteriores.
              </p>
              {attempt.submissions.map((s) => (
                <Result key={s.id} submission={s} />
              ))}
            </section>
          )}
          {attempt?.status === "open" &&
            attempt.submissions.some(
              (s) => s.result?.status === "completed",
            ) && (
              <section>
                <label>
                  O que mudou na sua explicação depois de observar o resultado?
                  <textarea
                    aria-label="Reflexão final"
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                  />
                </label>
                <button
                  disabled={running}
                  onClick={() =>
                    void action(async () => {
                      while (generation.current !== savedGeneration.current)
                        await persist();
                      accept(
                        await learningApi.complete(
                          attemptRef.current!,
                          reflection,
                        ),
                      );
                    })
                  }
                >
                  Concluir com reflexão
                </button>
              </section>
            )}
          {attempt?.status === "completed" && (
            <blockquote>{attempt.reflection}</blockquote>
          )}
          {attempt && (
            <button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  while (generation.current !== savedGeneration.current)
                    await persist();
                  await create();
                })
              }
            >
              Nova tentativa
            </button>
          )}
        </>
      )}
    </>
  );
}
function ActivityRoute() {
  const { id } = useParams();
  return <ActivityPage id={id ?? ""} key={id} />;
}
export function Learning() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "BunkerCode · Aprender backend";
    return () => {
      document.title = previousTitle;
    };
  }, []);
  return (
    <div className="learning-shell">
      <main>
        <Routes>
          <Route index element={<Catalog />} />
          <Route path=":id" element={<ActivityRoute />} />
        </Routes>
      </main>
    </div>
  );
}
