import type { ReactNode } from "react";
import { Link } from "react-router";
import { Check, X, ArrowUpRight } from "lucide-react";
import type { Run } from "@backendlab/protocol";
export const date = (time: number) => new Date(time).toLocaleString("pt-BR");
export const short = (text?: string) => text?.slice(0, 8) ?? "—";
const labels: Record<Run["status"], string> = {
  running: "Em execução",
  passed: "Passou",
  failed: "Falhou",
  error: "Erro de execução",
  interrupted: "Interrompida",
};
export function Status({ status }: { status: Run["status"] }) {
  return (
    <span className={`badge ${status}`}>
      {status === "passed" ? (
        <Check size={13} />
      ) : status === "failed" || status === "error" ? (
        <X size={13} />
      ) : null}
      {labels[status]}
    </span>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function Version({ run }: { run: Run }) {
  return (
    <span>
      {run.checkpoint?.message ??
        (run.code.dirty ? "Código modificado" : "Versão do workspace")}{" "}
      <code>{short(run.code.digest)}</code>
    </span>
  );
}

export function RunTable({
  runs,
  selected,
  select,
}: {
  runs: Run[];
  selected?: string[];
  select?: (id: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {select && <th>Comparar</th>}
            <th>Run / Experimento</th>
            <th>Versão do código</th>
            <th>Resultado</th>
            <th>Aceitos / rejeitados</th>
            <th>Estoque final</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              {select && (
                <td>
                  <input
                    aria-label={`Selecionar Run ${run.number}`}
                    type="checkbox"
                    checked={selected?.includes(run.id) ?? false}
                    onChange={() => select(run.id)}
                  />
                </td>
              )}
              <td>
                <Link to={`/runs/${run.id}`}>
                  <strong>Run #{run.number}</strong>
                </Link>
                <small>{date(run.createdAt)}</small>
              </td>
              <td>
                <Version run={run} />
              </td>
              <td>
                <Status status={run.status} />
              </td>
              <td>
                {run.result
                  ? `${run.result.accepted} / ${run.result.rejected}`
                  : "—"}
              </td>
              <td
                className={
                  run.result && run.result.finalStock < 0 ? "negative" : ""
                }
              >
                {run.result?.finalStock ?? "—"}
              </td>
              <td>
                <Link
                  aria-label={`Inspecionar Run ${run.number}`}
                  to={`/runs/${run.id}`}
                >
                  <ArrowUpRight size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export type Action = (
  operation: () => Promise<unknown>,
  success: string,
) => Promise<void>;
