import { Fragment } from "react";
import { choices, type Round } from "./session";

/** Version-1 presentation adapters: one anchored slot in the public source.
 * No semantic parsing, global replacements or access to reference answers. */
export function codeSlot(round: Round) {
  const lines = round.view.code.trimEnd().split("\n");
  if (round.family === "assignment") {
    const index = 2 + round.view.stepIndex;
    const line = lines[index];
    if (!line || !/^(?:___|value (?:\+=|-=|\*=) [1-3]);$/.test(line))
      throw new Error("Representação de instrução incompatível.");
    return { lines, index, before: "", after: ";", initial: line.slice(0, -1) };
  }
  const index = round.family === "comparison" ? 3 : 5;
  const pattern =
    round.family === "comparison"
      ? /^( {2}value => value )(___|>=|<=|===|!==|>|<)( -?\d+)$/
      : /^( {2}if \(value )(___|>=|<=|===|!==|>|<)( -?\d+\) \{)$/;
  const match = pattern.exec(lines[index] ?? "");
  if (!match) throw new Error("Representação de comparação incompatível.");
  return {
    lines,
    index,
    before: match[1]!,
    after: match[3]!,
    initial: match[2]!,
  };
}
function Tokens({ text }: { text: string }) {
  return text
    .split(/(\b(?:const|let|function|return|if|else)\b|-?\d+)/g)
    .map((part, index) => (
      <span
        key={index}
        className={
          /^-?\d+$/.test(part)
            ? "tactic-number"
            : /^(const|let|function|return|if|else)$/.test(part)
              ? "tactic-keyword"
              : undefined
        }
      >
        {part}
      </span>
    ));
}
export function TacticCode({
  round,
  selection,
  disabled,
  onSelect,
}: {
  round: Round;
  selection: number | null;
  disabled: boolean;
  onSelect: (index: number) => void;
}) {
  const slot = codeSlot(round);
  const options = choices(round);
  return (
    <section className="tactic-program" aria-label="Programa JavaScript">
      <div className="tactic-file">
        <span className="tactic-file-dot" aria-hidden="true" />
        programa.js<span>JavaScript</span>
      </div>
      <div
        className="tactic-code-scroll"
        tabIndex={0}
        aria-label="Código com rolagem horizontal"
      >
        {slot.lines.map((line, index) => (
          <div
            key={index}
            className={`tactic-code-line${index === slot.index ? " tactic-editable-line" : ""}`}
            data-code-line={index + 1}
          >
            <span className="tactic-line-number" aria-hidden="true">
              {index + 1}
            </span>
            <code>
              {index === slot.index ? (
                <Fragment>
                  <Tokens text={slot.before} />
                  <select
                    aria-label={`Operação no programa, linha ${index + 1}`}
                    value={selection === null ? "" : String(selection)}
                    disabled={disabled}
                    className={
                      round.family === "assignment"
                        ? "tactic-slot tactic-step-slot"
                        : "tactic-slot"
                    }
                    onChange={(event) => onSelect(Number(event.target.value))}
                  >
                    <option value="" disabled>
                      {slot.initial}
                    </option>
                    {options.map((option, optionIndex) => (
                      <option key={optionIndex} value={optionIndex}>
                        {round.family === "assignment"
                          ? `value ${option}`
                          : option}
                      </option>
                    ))}
                  </select>
                  <Tokens text={slot.after} />
                </Fragment>
              ) : (
                <Tokens text={line || " "} />
              )}
            </code>
          </div>
        ))}
      </div>
    </section>
  );
}
