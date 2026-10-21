import { useState, type ReactNode } from "react";
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
  revealedInstruction,
  feedback,
  actions,
  onSelect,
}: {
  round: Extract<Round, { family: "iteration" }>;
  suspect: string | null;
  disabled: boolean;
  revealedInstruction: string | null;
  feedback: ReactNode;
  actions: ReactNode;
  onSelect: (instructionId: string) => void;
}) {
  const [step, setStep] = useState(-1);
  const events = round.view.trace.events;
  const current = events[step];
  const lineNumber = (id: string) =>
    round.view.lines.findIndex((line) => line.instructionId === id) + 1;
  const changeStep = (index: number) =>
    setStep(Math.max(0, Math.min(events.length - 1, index)));
  const resultLabel = {
    "collect-matching": "Elementos selecionados",
    "count-matching": "Quantidade encontrada",
    "first-match": "Primeiro valor localizado",
    "partition-by-flag": "Distribuição entre grupos",
  }[round.view.identity.pattern];
  return (
    <section
      className="tactic-investigation"
      aria-label="Investigar o programa"
    >
      <div className="tactic-program">
        <div className="tactic-file">
          <span className="tactic-file-dot" aria-hidden="true" />
          programa.js
          <span>
            {disabled
              ? "Programa · defeito identificado"
              : "Programa · selecione uma instrução"}
          </span>
        </div>
        <div
          className="investigation-source"
          tabIndex={0}
          aria-label="Programa completo com rolagem horizontal"
        >
          {round.view.lines.map((line, index) => {
            const active =
              !disabled &&
              current?.instructionId === line.instructionId &&
              line.instructionId !== null;
            const selected =
              !disabled &&
              suspect === line.instructionId &&
              line.instructionId !== null;
            const revealed =
              revealedInstruction === line.instructionId &&
              line.instructionId !== null;
            const content = (
              <>
                <span className="tactic-line-number" aria-hidden="true">
                  {index + 1}
                  {active ? "▶" : ""}
                  {selected ? "?" : ""}
                  {revealed ? "✓" : ""}
                </span>
                <code>
                  <CodeTokens text={line.text || " "} />
                </code>
                {(active || selected || revealed) && (
                  <span className="investigation-markers">
                    {active && <span>▶ Atual</span>}
                    {selected && <span>? Suspeita</span>}
                    {revealed && <span>✓ Defeito</span>}
                  </span>
                )}
              </>
            );
            return line.instructionId ? (
              <button
                key={index}
                type="button"
                data-instruction-id={line.instructionId}
                className={`investigation-line ${active ? "is-current" : ""} ${selected ? "is-suspect" : ""} ${revealed ? "is-revealed" : ""}`}
                aria-label={`Apontar linha ${index + 1}: ${line.text.trim()}${active ? ". Instrução atual" : ""}${selected ? ". Suspeita" : ""}${revealed ? ". Origem do defeito" : ""}`}
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
      <div className="investigation-execution">
        <h3>{disabled ? "Conclusão" : "Execução"}</h3>
        {!disabled && (
          <>
            <p className="tactic-expected">
              Esperado:{" "}
              <strong>{iterationValue(round.view.expectedResult)}</strong>
            </p>
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
                        : `Iteração ${current.iteration + 1}`}
                    </strong>{" "}
                    · linha {lineNumber(current.instructionId)}
                  </p>
                  {current.record && (
                    <p>
                      Registro: <strong>{current.record.name}</strong>
                      <br />
                      active: {String(current.record.active)} · category:{" "}
                      {current.record.category}
                    </p>
                  )}
                  {current.condition !== null && (
                    <p>
                      Condição:{" "}
                      <strong>
                        {current.condition ? "verdadeira" : "falsa"}
                      </strong>
                    </p>
                  )}
                  <p>
                    {resultLabel}:{" "}
                    <strong>{iterationValue(current.after)}</strong>
                  </p>
                </>
              ) : (
                <p>Avance pelos passos para observar os valores.</p>
              )}
            </div>
            <p className="investigation-selection">
              {suspect
                ? `Suspeita: linha ${lineNumber(suspect)}. Confirme para avaliar.`
                : "Selecione uma linha do programa para apontar sua suspeita."}
            </p>
          </>
        )}
        {feedback}
        {actions}
      </div>
    </section>
  );
}
