import type { Execution, Round } from "./session";

export function TacticGoal({ round }: { round: Round }) {
  return (
    <section className="tactic-goal" aria-label="Objetivo do programa">
      <h3>Objetivo</h3>
      {round.family === "conditional" ? (
        <table className="tactic-cases">
          <caption className="sr-only">
            Resultados esperados para as três entradas
          </caption>
          <thead>
            <tr>
              <th>Entrada</th>
              <th>Resultado esperado</th>
            </tr>
          </thead>
          <tbody>
            {round.view.inputs.map((input, index) => (
              <tr key={input}>
                <td>
                  <code>{input}</code>
                </td>
                <td>
                  <code>{round.view.expectedResults[index]}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="tactic-target">
          result <span aria-hidden="true">→</span>{" "}
          <code>
            {round.family === "assignment"
              ? round.view.expectedResult
              : `[${round.view.expectedResult.join(", ")}]`}
          </code>
        </p>
      )}
    </section>
  );
}

export function TacticExecution({ result }: { result: Execution | null }) {
  return (
    <section
      className="tactic-execution"
      role="region"
      aria-label="Resultado da execução"
    >
      <h3>Execução</h3>
      {!result ? (
        <p className="tactic-hint">
          Escolha uma operação no programa e execute para observar o resultado.
        </p>
      ) : (
        <>
          <p
            className={
              result.value.achieved
                ? "tactic-verdict success"
                : "tactic-verdict retry"
            }
          >
            {result.value.achieved
              ? "Objetivo atingido."
              : "Ainda não. Ajuste a operação e tente novamente."}
          </p>
          {result.family === "comparison" && (
            <dl className="tactic-values">
              <div>
                <dt>Produzido</dt>
                <dd>
                  <code>[{result.value.produced.join(", ")}]</code>
                </dd>
              </div>
              <div>
                <dt>Esperado</dt>
                <dd>
                  <code>[{result.value.expected.join(", ")}]</code>
                </dd>
              </div>
            </dl>
          )}
          {result.family === "assignment" && (
            <>
              <ol className="tactic-trace" aria-label="Evolução da variável">
                <li>
                  <span>Inicial</span>
                  <code>{result.value.trace.initial}</code>
                </li>
                {result.value.trace.transitions.map((transition, index) => (
                  <li key={index}>
                    <code>
                      value {transition.step.operator} {transition.step.operand}
                    </code>
                    <code>{transition.after}</code>
                  </li>
                ))}
              </ol>
              <p className="tactic-result-pair">
                Produzido <code>{result.value.produced}</code> · Esperado{" "}
                <code>{result.value.expected}</code>
              </p>
            </>
          )}
          {result.family === "conditional" &&
            result.value.traces.map((trace, index) => (
              <details
                key={trace.input}
                className="tactic-case-trace"
                open={index === 0}
              >
                <summary>
                  Entrada <code>{trace.input}</code>
                  <span>
                    → <code>{trace.result}</code>
                  </span>
                </summary>
                <dl className="tactic-values">
                  <div>
                    <dt>Após preparação</dt>
                    <dd>
                      <code>{trace.afterPreparation}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Condição</dt>
                    <dd>{trace.comparison ? "Verdadeira" : "Falsa"}</dd>
                  </div>
                  <div>
                    <dt>Ramo executado</dt>
                    <dd>
                      <code>{trace.branch}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Após o ramo</dt>
                    <dd>
                      <code>{trace.afterBranch}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Resultado esperado</dt>
                    <dd>
                      <code>{result.value.expected[index]}</code>
                    </dd>
                  </div>
                </dl>
              </details>
            ))}
        </>
      )}
    </section>
  );
}
