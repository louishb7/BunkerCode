import { useState } from "react";
import { Copy, Download, FileCode2 } from "lucide-react";
import type { Exercise } from "./exercise-api";
import { CodeEditor } from "./CodeEditor";
import { useDraft } from "./useDraft";
import { ConfirmRestore } from "./ConfirmRestore";
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
  const filename = `solucao.${exercise.language === "typescript" ? "ts" : "js"}`;
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
  return (
    <section
      aria-label="Editor de prática"
      className="overflow-hidden rounded-xl border border-line bg-surface"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <span className="flex items-center gap-2 font-mono text-xs text-subtle">
          <FileCode2 className="product-icon text-gold" aria-hidden="true" />
          {filename}
        </span>
        <span className="text-xs text-subtle">{exercise.language}</span>
      </header>
      <div className="flex flex-wrap gap-2 border-b border-line p-3 text-xs">
        <button
          onClick={() => void copy()}
          disabled={!draft.ready}
          className="flex items-center gap-2"
        >
          <Copy className="product-icon" aria-hidden="true" />
          Copiar código
        </button>
        <button
          onClick={download}
          disabled={!draft.ready}
          className="flex items-center gap-2"
        >
          <Download className="product-icon" aria-hidden="true" />
          Baixar código
        </button>
        <ConfirmRestore
          disabled={!draft.ready || !!draft.conflict}
          onConfirm={() => draft.change(exercise.starterCode)}
        />
      </div>
      {draft.previous && (
        <details className="border-b border-line p-4 text-sm text-subtle">
          <summary className="cursor-pointer text-gold">
            A definição mudou. Revisão anterior preservada.
          </summary>
          <p>
            Confira o novo enunciado. Sua solução anterior permanece arquivada,
            mesmo ao restaurar o código inicial desta revisão.
          </p>
          <pre className="max-h-48 overflow-auto whitespace-pre text-xs">
            {draft.previous.code}
          </pre>
        </details>
      )}
      {draft.ready ? (
        <CodeEditor
          code={draft.code}
          language={exercise.language}
          onChange={draft.change}
        />
      ) : (
        <p role="status" className="p-4">
          Abrindo rascunho…
        </p>
      )}
      <footer className="border-t border-line px-4 py-3">
        <p
          role={draft.failed ? "alert" : "status"}
          className="m-0 text-xs leading-relaxed text-subtle"
        >
          {draft.status}
        </p>
        {draft.failed && !draft.conflict && (
          <button className="mt-3 text-xs" onClick={draft.retry}>
            Tentar salvar novamente
          </button>
        )}
        <p
          id="editor-keyboard-help"
          className="mb-0 text-xs leading-relaxed text-subtle"
        >
          Tab indenta. Escape, depois Tab, sai do editor. Código não executado
          nem avaliado.
        </p>
        {notice && (
          <p role="status" className="mb-0 text-xs text-gold">
            {notice}
          </p>
        )}
      </footer>
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
          <pre className="max-h-56 overflow-auto whitespace-pre rounded bg-bunker p-3 text-xs">
            {draft.conflict.code}
          </pre>
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
    </section>
  );
}
