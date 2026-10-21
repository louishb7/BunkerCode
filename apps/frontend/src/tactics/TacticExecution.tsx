import type { Execution, Round } from "./session";

export function TacticGoal({ round }: { round: Round }) {
  if (round.family !== "conditional") return null;
  return (
    <table className="tactic-cases">
      <caption className="sr-only">
        Resultados esperados para as três entradas
      </caption>
      <thead>
        <tr>
          <th>Entrada</th>
          <th aria-label="Produz esperado">→</th>
          <th>Esperado</th>
        </tr>
      </thead>
      <tbody>
        {round.view.inputs.map((input, index) => (
          <tr key={input}>
            <td>
              <code>{input}</code>
            </td>
            <td aria-hidden="true">→</td>
            <td>
              <code>{round.view.expectedResults[index]}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TacticExecution({ result }: { result: Execution | null }) {
  if (!result) return null;
  if (result.family === "iteration") return null;
  return (
    <section className="tactic-execution" aria-label="Resultado da execução">
      <p
        className={`tactic-verdict ${result.value.achieved ? "success" : "retry"}`}
      >
        {result.value.achieved
          ? "Objetivo atingido."
          : result.family === "collection"
            ? "Ainda não. Ajuste a ordem e tente novamente."
            : "Ainda não. Ajuste a operação e tente novamente."}
      </p>
      {result.family === "collection" && (
        <>
          {result.value.status === "invalid-order" && (
            <p className="tactic-dependency">
              A instrução <code>{result.value.blockId}</code> precisa de{" "}
              <code>{result.value.missing.join(", ")}</code> antes dela.
            </p>
          )}
          <p className="tactic-result-pair">
            Produzido:{" "}
            <code>
              {result.value.produced === null
                ? "Não produzido"
                : JSON.stringify(result.value.produced)}
            </code>
            {" · "}Esperado:{" "}
            <code>{JSON.stringify(result.value.expected)}</code>
          </p>
          {result.value.trace.length > 0 && (
            <details className="tactic-step-trace">
              <summary>Ver execução passo a passo</summary>
              <ol className="tactic-collection-trace">
                {result.value.trace.map((step) => (
                  <li key={step.blockId}>
                    <code>{step.code}</code>
                    <code>→ {JSON.stringify(step.value)}</code>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </>
      )}
      {result.family === "comparison" && (
        <p className="tactic-result-pair">
          Produzido: <code>[{result.value.produced.join(", ")}]</code>
          {" · "}Esperado: <code>[{result.value.expected.join(", ")}]</code>
        </p>
      )}
      {result.family === "assignment" && (
        <>
          <p className="tactic-result-pair">
            Produzido: <code>{result.value.produced}</code>
            {" · "}Esperado: <code>{result.value.expected}</code>
          </p>
          <details className="tactic-step-trace">
            <summary>Ver execução passo a passo</summary>
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
          </details>
        </>
      )}
      {result.family === "conditional" && (
        <>
          <p className="tactic-case-labels">Entrada → Produzido · Esperado</p>
          {result.value.traces.map((trace, index) => {
            const matches = trace.result === result.value.expected[index];
            return (
              <details key={trace.input} className="tactic-case-trace">
                <summary
                  aria-label={`Entrada ${trace.input}: produzido ${trace.result}, esperado ${result.value.expected[index]}. ${matches ? "Confere" : "Diverge"}. Ver passo a passo`}
                >
                  <code>
                    {trace.input} → {trace.result} ·{" "}
                    {result.value.expected[index]}
                  </code>
                  <span className={matches ? "success" : "retry"}>
                    {matches ? "Confere" : "Diverge"}
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
            );
          })}
        </>
      )}
    </section>
  );
}
