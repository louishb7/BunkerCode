import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowUpRight } from "lucide-react";
import type { RunDetail, Run } from "@backendlab/protocol";
import { short, Empty, Version, Status } from "../components/shared";
import { api } from "../api";
export function Compare() {
  const [params] = useSearchParams();
  const left = params.get("left");
  const right = params.get("right");
  const [pair, setPair] = useState<RunDetail[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    setPair([]);
    if (!left || !right) {
      setError("Selecione duas Runs no histórico.");
      return;
    }
    void Promise.all([api.run(left), api.run(right)])
      .then((value) => {
        if (active) setPair(value);
      })
      .catch((cause) => {
        if (active) setError(String(cause));
      });
    return () => {
      active = false;
    };
  }, [left, right]);
  return (
    <>
      <Link className="back-link" to="/runs">
        ← Histórico
      </Link>
      <div className="page-heading">
        <div>
          <h1>Comparar Runs</h1>
          <p>Uma mudança de código alterou o comportamento do sistema?</p>
        </div>
      </div>
      {error ? (
        <Empty>{error}</Empty>
      ) : pair.length !== 2 ? (
        <Empty>Carregando comparação…</Empty>
      ) : (
        <>
          <div className="table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Propriedade</th>
                  {pair.map(({ run }) => (
                    <th key={run.id}>
                      <Link to={`/runs/${run.id}`}>
                        Run #{run.number} <ArrowUpRight size={14} />
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Resultado", (run: Run) => <Status status={run.status} />],
                    ["Versão", (run: Run) => <Version run={run} />],
                    [
                      "Checkpoint Git",
                      (run: Run) => (
                        <code>
                          {run.checkpoint
                            ? short(run.checkpoint.commit)
                            : "Não salvo"}
                        </code>
                      ),
                    ],

                    [
                      "Compradores / concorrência",
                      (run: Run) =>
                        `${run.config.clients} / ${run.config.concurrency}`,
                    ],
                    ["Aceitos", (run: Run) => run.result?.accepted ?? "—"],
                    ["Rejeitados", (run: Run) => run.result?.rejected ?? "—"],
                    ["Erros", (run: Run) => run.result?.errors ?? "—"],
                    ...Array.from(
                      new Set(
                        pair.flatMap(
                          ({ run }) =>
                            run.result?.observations?.map((item) => item.key) ??
                            [],
                        ),
                      ),
                    ).map(
                      (key) =>
                        [
                          pair
                            .flatMap(
                              ({ run }) => run.result?.observations ?? [],
                            )
                            .find((item) => item.key === key)!.label,
                          (run: Run) => {
                            const item = run.result?.observations?.find(
                              (item) => item.key === key,
                            );
                            return item
                              ? `${item.before !== undefined ? `${item.before} → ` : ""}${item.value}`
                              : "—";
                          },
                        ] as [string, (run: Run) => ReactNode],
                    ),
                    [
                      "Condições",
                      (run: Run) => <code>{JSON.stringify(run.config)}</code>,
                    ],
                    [
                      "Duração total",
                      (run: Run) =>
                        run.durationMs === undefined
                          ? "—"
                          : `${run.durationMs.toFixed(1)} ms`,
                    ],
                  ] as [string, (run: Run) => ReactNode][]
                ).map(([name, render]) => (
                  <tr key={name}>
                    <th>{name}</th>
                    {pair.map(({ run }) => (
                      <td key={run.id}>{render(run)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {JSON.stringify(pair[0]!.run.config) !==
            JSON.stringify(pair[1]!.run.config) && (
            <div className="inline-warning">
              As condições são diferentes. Esta comparação não isola o efeito da
              mudança de código.
            </div>
          )}
          <p className="subtle">
            Uma Run é uma observação, não uma garantia de ausência de race
            conditions. Repita o experimento.
          </p>
        </>
      )}
    </>
  );
}
