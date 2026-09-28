import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import type { Run } from "@backendlab/protocol";
import { RunTable, Empty } from "../components/shared";
import { api } from "../api";
export function RunsPage({ runs }: { runs: Run[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [older, setOlder] = useState<Run[]>([]);
  const [loadError, setLoadError] = useState("");
  const history = [
    ...runs,
    ...older.filter((run) => !runs.some((item) => item.id === run.id)),
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Histórico</h1>
          <p>
            Resultados preservados, mesmo depois de resetar ou quebrar o
            sistema.
          </p>
        </div>
        {selected.length === 2 && (
          <Link
            className="button primary"
            to={`/compare?left=${selected[0]}&right=${selected[1]}`}
          >
            Comparar selecionadas <ArrowRight size={16} />
          </Link>
        )}
      </div>
      <p className="subtle">
        Selecione duas execuções para comparar condições, versões e resultados.
      </p>
      {history.length ? (
        <RunTable
          runs={history}
          selected={selected}
          select={(id) =>
            setSelected((current) =>
              current.includes(id)
                ? current.filter((item) => item !== id)
                : [...current.slice(-1), id],
            )
          }
        />
      ) : (
        <Empty>
          Nenhum teste salvo ainda. <Link to="/">Abrir o sistema</Link>
        </Empty>
      )}
      {history.length >= 100 && (
        <button
          onClick={async () => {
            try {
              setOlder([...older, ...(await api.runs(history.at(-1)?.number))]);
            } catch {
              setLoadError("Falha ao buscar histórico.");
            }
          }}
        >
          Carregar anteriores
        </button>
      )}
      {loadError && <p role="alert">{loadError}</p>}
    </>
  );
}
