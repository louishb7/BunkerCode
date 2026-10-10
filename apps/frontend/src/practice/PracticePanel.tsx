import { useEffect, useRef, useState } from "react";
import {
  Copy,
  Download,
  FileCode2,
  Play,
  Send,
  WandSparkles,
  Square,
} from "lucide-react";
import type { Exercise } from "./exercise-api";
import type { Compilation } from "./compiler";
import { compile } from "./code-tools";
import { CodeEditor } from "./CodeEditor";
import { useDraft } from "./useDraft";
import { ConfirmRestore } from "./ConfirmRestore";
import { draftScope } from "./draft-store";
import {
  readSubmissions,
  submitSolution,
  type Submission,
} from "./submission-store";
import {
  runtimeStatus,
  runSolution,
  cancelSolution,
  type RuntimeStatus,
  type RunResult,
} from "./runtime-api";
interface Result {
  source: string;
  compilation?: Compilation;
  run?: RunResult;
  message: string;
}
export default function PracticePanel({
  course,
  lesson,
  exercise,
}: {
  course: string;
  lesson: string;
  exercise: Exercise;
}) {
  const draft = useDraft(course, lesson, exercise);
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState<"solution" | "tests">("solution");
  const [formatRequest, setFormatRequest] = useState(0);
  const [formatting, setFormatting] = useState(false);
  const [runtime, setRuntime] = useState<RuntimeStatus>();
  const [runtimeError, setRuntimeError] = useState("");
  const [phase, setPhase] = useState<"idle" | "compiling" | "running">("idle");
  const [result, setResult] = useState<Result>();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submitError, setSubmitError] = useState("");
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState<Submission>();
  const alive = useRef(true);
  const job = useRef<
    { controller: AbortController; id?: string; finished: boolean } | undefined
  >(undefined);
  const filename = `solucao.${exercise.language === "typescript" ? "ts" : "js"}`;
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void runtimeStatus(controller.signal)
      .then(setRuntime)
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setRuntimeError(
            error instanceof Error ? error.message : "Run indisponível.",
          );
      });
    void readSubmissions(draftScope(course, lesson, exercise.id))
      .then((values) => {
        if (alive.current)
          setSubmissions((previous) =>
            [
              ...new Map(
                [...values, ...previous].map((value) => [value.id, value]),
              ).values(),
            ].sort((a, b) => b.at - a.at),
          );
      })
      .catch((error: unknown) => {
        if (alive.current)
          setSubmitError(
            error instanceof Error ? error.message : "Histórico indisponível.",
          );
      });
    return () => {
      alive.current = false;
      controller.abort();
      const current = job.current;
      current?.controller.abort();
      if (current?.id && !current.finished)
        void cancelSolution(current.id).catch((error: unknown) =>
          console.warn(error),
        );
    };
  }, [course, lesson, exercise.id]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(draft.code);
      setNotice("Código copiado.");
    } catch {
      setNotice(
        "Não foi possível copiar. Use Baixar código para preservar seu texto.",
      );
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([draft.code], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Download do código solicitado.");
  }
  async function analyze(
    source: string,
  ): Promise<Submission["state"] | undefined> {
    const controller = new AbortController();
    const current = {
      controller,
      id: crypto.randomUUID(),
      finished: false,
    };
    job.current = current;
    setPhase("compiling");
    setResult({ source, message: "Compilando…" });
    try {
      const compilation = await compile(
        source,
        exercise.language,
        controller.signal,
      );
      if (controller.signal.aborted || !alive.current) return;
      if (compilation.diagnostics.length) {
        setResult({
          source,
          compilation,
          message: "Erros de compilação. O código não foi executado.",
        });
        return "unassessed";
      }
      if (!runtime?.available) {
        setResult({
          source,
          compilation,
          message: `Compilação concluída sem diagnósticos neste ambiente. Runner indisponível: ${runtime?.reason || runtimeError || "ainda não confirmado"}. Sem avaliação completa.`,
        });
        return "unassessed";
      }
      setPhase("running");
      setResult({
        source,
        compilation,
        message: "Executando em container isolado…",
      });
      const run = await runSolution(
        {
          id: current.id,
          course,
          lesson,
          exercise: exercise.id,
          revision: exercise.revision,
          source,
          javascript: compilation.javascript,
        },
        controller.signal,
      );
      if (controller.signal.aborted || !alive.current) return;
      const messages = {
        success: "Execução encerrada.",
        error: "Erro de execução.",
        timeout: "Tempo limite excedido (5 s).",
        cancelled: "Execução cancelada.",
        "output-limit": "Limite de saída excedido (32 KiB).",
      };
      const assessment = exercise.tests ? run.assessment : undefined;
      setResult({
        source,
        compilation,
        run,
        message:
          assessment === "passed"
            ? "Testes aprovados · progresso local."
            : assessment === "failed"
              ? "Testes falharam."
              : messages[run.state],
      });
      return assessment ?? "unassessed";
    } catch (error) {
      if (alive.current && !controller.signal.aborted)
        setResult({
          source,
          message:
            error instanceof Error
              ? error.message
              : "Falha ao analisar código.",
        });
      return controller.signal.aborted ? undefined : "unassessed";
    } finally {
      if (alive.current && job.current === current) {
        setPhase("idle");
        current.finished = true;
      }
    }
  }
  async function cancel() {
    const current = job.current;
    current?.controller.abort();
    if (current?.id) {
      try {
        await cancelSolution(current.id);
      } catch (error) {
        if (alive.current)
          setNotice(
            error instanceof Error
              ? error.message
              : "Cancelamento não confirmado.",
          );
      }
    }
    if (alive.current && job.current === current) {
      setPhase("idle");
      setResult((previous) =>
        previous ? { ...previous, message: "Operação cancelada." } : undefined,
      );
    }
  }
  async function submit() {
    const code = draft.code;
    setSending(true);
    setSubmitError("");
    try {
      const state = await analyze(code);
      if (!alive.current || state === undefined) return;
      const value = await submitSolution(
        course,
        lesson,
        exercise.id,
        exercise.revision,
        code,
        state,
      );
      if (alive.current) {
        setSubmitted(value);
        setSubmissions((previous) => [value, ...previous]);
      }
    } catch (error) {
      if (alive.current)
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Solução não registrada; código preservado.",
        );
    } finally {
      if (alive.current) setSending(false);
    }
  }
  return (
    <section
      aria-label="Editor de prática"
      className="practice-panel overflow-hidden rounded-xl border border-line bg-surface"
    >
      <header className="editor-toolbar">
        <div
          role="group"
          aria-label="Arquivos do exercício"
          className="editor-files"
        >
          <button
            aria-pressed={file === "solution"}
            onClick={() => setFile("solution")}
          >
            <FileCode2 className="product-icon" aria-hidden="true" />
            {filename}
          </button>
          {exercise.tests && (
            <button
              aria-pressed={file === "tests"}
              onClick={() => setFile("tests")}
            >
              testes.json
            </button>
          )}
        </div>
        <button
          className="format-button"
          title="Formatar código"
          aria-label="Formatar código"
          disabled={!draft.ready || formatting || file === "tests"}
          onClick={() => setFormatRequest((value) => value + 1)}
        >
          <WandSparkles className="product-icon" aria-hidden="true" />
        </button>
        {draft.failed && (
          <span role="alert" className="save-status text-xs text-subtle">
            {draft.status}
          </span>
        )}
        <div className="flex items-center gap-2">
          {phase !== "idle" ? (
            <button
              aria-label="Cancelar operação"
              onClick={() => void cancel()}
              className="text-xs"
            >
              <Square className="product-icon" aria-hidden="true" />
              Cancelar
            </button>
          ) : (
            <button
              disabled={!draft.ready || sending || phase !== "idle"}
              onClick={() => void analyze(draft.code)}
              className="practice-run"
            >
              <Play className="product-icon" aria-hidden="true" />
              Run
            </button>
          )}
          <button
            disabled={!draft.ready || sending || phase !== "idle"}
            onClick={() => void submit()}
            className="product-primary flex items-center gap-1 text-xs"
          >
            <Send className="product-icon" aria-hidden="true" />
            {sending ? "Registrando…" : "Submit"}
          </button>
        </div>
      </header>
      {draft.previous && (
        <details className="border-b border-line p-4 text-sm text-subtle">
          <summary className="cursor-pointer text-gold">
            A definição mudou. Revisão anterior preservada.
          </summary>
          <p>
            Confira o novo enunciado. Sua solução anterior permanece arquivada.
          </p>
          <pre className="max-h-48 overflow-auto whitespace-pre text-xs">
            {draft.previous.code}
          </pre>
        </details>
      )}
      <div hidden={file !== "solution"}>
        {draft.ready ? (
          <CodeEditor
            code={draft.code}
            language={exercise.language}
            onChange={draft.change}
            formatRequest={formatRequest}
            onFormatState={(busy, message) => {
              setFormatting(busy);
              setNotice(message);
            }}
          />
        ) : (
          <p role="status" className="p-4">
            Abrindo rascunho…
          </p>
        )}
      </div>
      {exercise.tests && file === "tests" && (
        <CodeEditor
          code={JSON.stringify(exercise.tests, null, 2)}
          language="javascript"
          readOnly
          label="Testes públicos, somente leitura"
          onChange={() => undefined}
          formatRequest={0}
          onFormatState={() => undefined}
        />
      )}
      <div className="editor-help sr-only" id="editor-keyboard-help">
        Ctrl+Space sugere nomes locais e palavras-chave. Enter aceita. Tab
        indenta; Escape, depois Tab, sai. Ctrl+F busca.
      </div>
      {notice && (
        <p
          role="status"
          className="m-0 border-t border-line px-4 py-2 text-xs text-gold"
        >
          {notice}
        </p>
      )}
      {(result || submitted || submitError) && (
        <section aria-label="Compilação e resultados" className="results-panel">
          <p role="status" className="text-sm">
            {result?.message ??
              "Pronto para compilar ou executar. Submit registra uma solução não avaliada."}
          </p>
          {result && result.source !== draft.code && (
            <p className="text-xs text-gold">
              O código foi editado após esta análise. O resultado pertence à
              versão anterior.
            </p>
          )}
          {result?.compilation && (
            <details open={result.compilation.diagnostics.length > 0}>
              <summary>Detalhes da verificação</summary>
              <p className="text-xs text-subtle">
                TypeScript {result.compilation.version} · análise sintática e
                semântica com bibliotecas ES2022.
              </p>
              {result.compilation.diagnostics.length > 0 && (
                <ul className="diagnostics">
                  {result.compilation.diagnostics.map((item, i) => (
                    <li key={i}>
                      <span className="font-mono text-gold">
                        TS{item.code} · {item.category}
                        {item.line ? ` · ${item.line}:${item.column}` : ""}
                      </span>
                      <p>{item.message}</p>
                    </li>
                  ))}
                </ul>
              )}
              {!result.compilation.diagnostics.length && (
                <details>
                  <summary className="cursor-pointer text-xs text-subtle">
                    JavaScript gerado
                  </summary>
                  <pre className="result-output">
                    {result.compilation.javascript}
                  </pre>
                </details>
              )}
            </details>
          )}
          {result?.run && (
            <div>
              <h3 className="text-xs text-subtle">Saída do programa</h3>
              <pre className="result-output">
                {result.run.stdout || "Sem saída em stdout."}
              </pre>
              {result.run.stderr && (
                <pre className="result-output text-[#e49e82]">
                  {result.run.stderr}
                </pre>
              )}
            </div>
          )}
          {runtime?.available === false && (
            <p className="text-xs text-subtle">{runtime.reason}</p>
          )}
          {runtimeError && (
            <p className="text-xs text-subtle">{runtimeError}</p>
          )}
          {submitted && (
            <p role="status" className="text-sm text-gold">
              Solução registrada em{" "}
              {new Date(submitted.at).toLocaleString("pt-BR")}.{" "}
              {submitted.state === "passed"
                ? "Concluída pelos testes configurados · progresso local."
                : submitted.state === "failed"
                  ? "Testes falharam; atividade não concluída."
                  : "Não avaliada automaticamente."}
              {submitted.code !== draft.code
                ? " Você continuou editando o rascunho."
                : ""}
            </p>
          )}
          {submitError && (
            <p role="alert" className="text-sm">
              {submitError} Seu código continua no editor.
            </p>
          )}
        </section>
      )}
      {!!submissions.length && (
        <details>
          <summary className="cursor-pointer text-sm">
            Envios locais ({submissions.length})
          </summary>
          {submissions.map((value) => (
            <details key={value.id} className="mt-3">
              <summary className="cursor-pointer text-xs">
                {new Date(value.at).toLocaleString("pt-BR")} ·{" "}
                {value.state === "passed"
                  ? "aprovada nos testes locais"
                  : value.state === "failed"
                    ? "testes falharam"
                    : "não avaliada"}
                {value.revision !== exercise.revision
                  ? " · revisão anterior"
                  : ""}
              </summary>
              <pre className="result-output">{value.code}</pre>
            </details>
          ))}
        </details>
      )}
      {(draft.failed || submitError) && (
        <section
          aria-label="Recuperação do código"
          className="border-t border-line p-4"
        >
          <p className="mt-0 text-xs">Preserve seu código antes de sair.</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <button onClick={() => void copy()}>
              <Copy className="product-icon" aria-hidden="true" />
              Copiar código
            </button>
            <button onClick={download}>
              <Download className="product-icon" aria-hidden="true" />
              Baixar código
            </button>
            {draft.failed && !draft.conflict && (
              <button onClick={draft.retry}>Tentar salvar novamente</button>
            )}
          </div>
        </section>
      )}
      {draft.activityError && (
        <p role="status" className="px-4 text-xs">
          Edição não registrada no calendário: {draft.activityError}
        </p>
      )}
      {draft.conflict && (
        <section
          aria-label="Revisão de conflito"
          className="border-t border-gold/40 p-4"
        >
          <h3 className="mt-0 text-base">Outra versão foi salva</h3>
          <p className="text-sm text-subtle">
            Seu texto continua no editor. Compare com a versão abaixo antes de
            escolher.
          </p>
          <pre className="result-output">{draft.conflict.code}</pre>
          <div className="flex flex-wrap gap-2 text-xs">
            <button onClick={() => draft.resolve(true)}>
              Manter meu código e salvar
            </button>
            <button onClick={() => draft.resolve(false)}>
              Carregar código da outra aba
            </button>
          </div>
        </section>
      )}
      <details className="border-t border-line px-4 py-3">
        <summary className="cursor-pointer text-xs text-subtle">
          Opções do exercício
        </summary>
        <div className="mt-3">
          <ConfirmRestore
            disabled={!draft.ready || !!draft.conflict}
            onConfirm={() => draft.change(exercise.starterCode)}
          />
        </div>
      </details>
    </section>
  );
}
