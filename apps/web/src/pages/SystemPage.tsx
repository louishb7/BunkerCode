import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, Box } from "lucide-react";
import type { RuntimeStatus, SystemSummary } from "@backendlab/protocol";
import { api } from "../api";
export function SystemPage() {
  const [systems, setSystems] = useState<
    (SystemSummary & { runtime: RuntimeStatus["status"] })[]
  >([]);
  const [error, setError] = useState("");
  useEffect(() => {
    void api
      .systems()
      .then(setSystems)
      .catch((cause) => setError(cause.message));
  }, []);
  return (
    <>
      <div className="page-heading">
        <h1>Sistemas</h1>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="systems-list">
        {systems.map((system) => (
          <div className="system-entry" key={system.id}>
            <Box size={25} />
            <div>
              <h2>{system.name}</h2>
              <p>{system.description}</p>
            </div>
            <span
              className={`runtime-state ${system.runtime === "ready" ? "is-running" : ""}`}
            >
              <i />
              {system.runtime === "ready"
                ? "Em execução"
                : system.runtime === "crashed"
                  ? "Indisponível"
                  : "Parado"}
            </span>
            <Link className="button" to={`/?system=${system.id}`}>
              Abrir <ArrowUpRight size={15} />
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
