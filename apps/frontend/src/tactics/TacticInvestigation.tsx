import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Play, ChevronsRight } from "lucide-react";
import type { IterationResult } from "@bunkercode/tactics-core";
import type { Round } from "./session";
import { CodeTokens } from "./TacticCode";

export function iterationValue(value: IterationResult): string {
  if (value === null) return "null (nenhum registro)";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return `“${value}”`;
  if (Array.isArray(value))
    return value.length ? value.map((v) => `“${v}”`).join(", ") : "[ ]";
  const groups = value as {
    readonly matching: readonly string[];
    readonly other: readonly string[];
  };
  return `matching: ${iterationValue(groups.matching)} · other: ${iterationValue(groups.other)}`;
}
export function TacticInvestigation({
  round,
  suspect,
  disabled,
  onSelect,
}: {
  round: Extract<Round, { family: "iteration" }>;
  suspect: string | null;
  disabled: boolean;
  onSelect: (instructionId: string) => void;
}) {
  const [step, setStep] = useState(-1);
  const scroll = useRef<HTMLDivElement>(null);
  const events = round.view.trace.events;
  const current = events[step];
  useLayoutEffect(() => {
    if (!current) return;
    const container = scroll.current;
    const line = container?.querySelector<HTMLElement>(
      `[data-instruction-id="${current.instructionId}"]`,
    );
    if (!line || !container) return;
    const bounds = container.getBoundingClientRect();
    const row = line.getBoundingClientRect();
    if (row.top < bounds.top || row.bottom > bounds.bottom)
      container.scrollTop += row.top - bounds.top - container.clientHeight / 2;
  }, [current]);
  const changeStep = (index: number) =>
    setStep(Math.max(0, Math.min(events.length - 1, index)));
  return (
    <section
      className="tactic-investigation"
      aria-label="Investigar o programa"
    >
      <p className="tactic-expected">
        Esperado: <strong>{iterationValue(round.view.expectedResult)}</strong>
      </p>
      <div className="tactic-program">
        <div className="tactic-file">
          <span className="tactic-file-dot" aria-hidden="true" />
          programa.js<span>Investigar execução</span>
        </div>
        <div
          ref={scroll}
          className="investigation-source"
          tabIndex={0}
          aria-label="Programa completo com rolagem"
        >
          {round.view.lines.map((line, index) => {
            const active =
              current?.instructionId === line.instructionId &&
              line.instructionId !== null;
            const selected =
              suspect === line.instructionId && line.instructionId !== null;
            const content = (
              <>
                <span className="tactic-line-number" aria-hidden="true">
                  {index + 1}
                </span>
                <code>
                  <CodeTokens text={line.text || " "} />
                </code>
              </>
            );
            return line.instructionId ? (
              <button
                key={index}
                type="button"
                data-instruction-id={line.instructionId}
                className={`investigation-line ${active ? "is-current" : ""} ${selected ? "is-suspect" : ""}`}
                aria-label={`Apontar linha ${index + 1}: ${line.text.trim()}`}
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => onSelect(line.instructionId!)}
              >
                {content}
              </button>
            ) : (
              <div key={index} className="investigation-line">
                {content}
              </div>
            );
          })}
        </div>
      </div>
      <div
        className="investigation-controls"
        aria-label="Controles da execução"
      >
        {step < 0 ? (
          <button onClick={() => changeStep(0)}>
            <Play size={15} aria-hidden="true" />
            Iniciar execução
          </button>
        ) : (
          <>
            <button
              aria-label="Passo anterior"
              disabled={step === 0}
              onClick={() => changeStep(step - 1)}
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </button>
            <span>
              Passo {step + 1} de {events.length}
            </span>
            <button
              aria-label="Próximo passo"
              disabled={step === events.length - 1}
              onClick={() => changeStep(step + 1)}
            >
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </>
        )}
        <button onClick={() => changeStep(events.length - 1)}>
          <ChevronsRight size={16} aria-hidden="true" />
          Ver resultado final
        </button>
      </div>
      <div
        className="investigation-state"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {current ? (
          <>
            <p>
              <strong>
                {current.iteration === null
                  ? current.instructionId === "finish"
                    ? "Resultado final"
                    : "Estado inicial"
                  : `Iteração ${current.iteration + 1} · ${current.record!.name}`}
              </strong>
              {current.record && (
                <span>
                  {" "}
                  · active: {String(current.record.active)} · category:{" "}
                  {current.record.category}
                </span>
              )}
            </p>
            {current.condition !== null && (
              <p>
                Condição:{" "}
                <strong>{current.condition ? "verdadeira" : "falsa"}</strong>
              </p>
            )}
            <p>Antes: {iterationValue(current.before)}</p>
            <p>
              Acumulado: <strong>{iterationValue(current.after)}</strong>
            </p>
          </>
        ) : (
          <p>
            Observe a execução e aponte a instrução que causa a divergência.
            Confirme seu diagnóstico para avaliar.
          </p>
        )}
      </div>
      <p className="investigation-selection">
        {suspect
          ? `Instrução selecionada: linha ${round.view.lines.findIndex((l) => l.instructionId === suspect) + 1}.`
          : "Nenhuma instrução selecionada."}
      </p>
    </section>
  );
}
