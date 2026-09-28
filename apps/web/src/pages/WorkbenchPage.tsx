import { useState } from "react";
import { Link } from "react-router";
import {
  Box,
  ArrowUpRight,
  Play,
  ArrowRight,
  FlaskConical,
  Terminal,
} from "lucide-react";
import type { ExperimentConfig, Run, Workbench } from "@backendlab/protocol";
import { RunTable, Empty } from "../components/shared";
export function WorkbenchPage({
  bench,
  runs,
  busy,
  start,
}: {
  bench: Workbench;
  runs: Run[];
  busy: boolean;
  start: (config: ExperimentConfig) => Promise<void>;
}) {
  const experiment = bench.experiments[0]!;
  const [config, setConfig] = useState(experiment.defaults);
  const expected = Math.min(config.stock, config.clients);
  const changed =
    bench.runtime.status === "ready" &&
    bench.runtime.code &&
    bench.runtime.code.digest !== bench.workingCode.digest;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SUA BANCADA DE BACKEND</div>
          <h1>Construa. Quebre. Investigue.</h1>
          <p>
            Uma hipótese, um sistema real e evidências para decidir o próximo
            passo.
          </p>
        </div>
        <span className="outline-label">
          <span className="small-dot" />
          Workspace local
        </span>
      </div>
      <section className="system-strip">
        <div className="system-icon">
          <Box size={25} />
        </div>
        <div>
          <h2>{bench.system.name}</h2>
          <p>{bench.system.description}</p>
        </div>
        <Link className="text-link" to="/systems">
          Código e runtime <ArrowUpRight size={16} />
        </Link>
      </section>
      <section className="experiment-panel">
        <div className="experiment-main">
          <div className="eyebrow orange">EXPERIMENTO / CONCORRÊNCIA</div>
          <h2>{experiment.name}</h2>
          <p className="experiment-description">
            {config.clients} compradores. {config.stock} unidades.
            <br />O estoque vai respeitar esse limite?
          </p>
          <div className="hypothesis">
            <span>INVARIANTE</span>
            <code>stock &gt;= 0</code>
            <p>Nenhum pedido deve consumir uma unidade que não existe.</p>
          </div>
          <details className="config">
            <summary>Ajustar condições do experimento</summary>
            <div className="config-fields">
              {(
                [
                  ["stock", "Estoque inicial"],
                  ["clients", "Compradores"],
                  ["concurrency", "Concorrência"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    min={key === "stock" ? 0 : 1}
                    max="100"
                    value={config[key]}
                    disabled={busy}
                    onChange={(event) =>
                      setConfig({
                        ...config,
                        [key]: Number(event.target.value),
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </details>
        </div>
        <div className="experiment-action">
          <span className="eyebrow">RESULTADO ESPERADO</span>
          <div className="expected-grid">
            <div>
              <strong>{expected}</strong>
              <span>aceitos</span>
            </div>
            <div>
              <strong>{config.clients - expected}</strong>
              <span>rejeitados</span>
            </div>
            <div>
              <strong>{config.stock - expected}</strong>
              <span>estoque final</span>
            </div>
          </div>
          <div className="divider" />
          <p>
            O laboratório prepara o estoque, dispara requests HTTP concorrentes
            e salva o resultado.
          </p>
          <button
            className="primary large"
            disabled={busy}
            onClick={() => void start(config)}
          >
            <Play size={17} fill="currentColor" />
            {busy ? (bench.busy ?? "Preparando…") : "Executar experimento"}
          </button>
          <small>
            {bench.runtime.status === "ready"
              ? "Usa o código carregado no runtime."
              : "O runtime será iniciado automaticamente."}
          </small>
          {changed && (
            <div className="inline-warning">
              Há código editado ainda não carregado.{" "}
              <Link to="/systems">Reinicie o runtime</Link> para experimentá-lo.
            </div>
          )}
        </div>
      </section>
      <div className="section-title">
        <h2>Últimas investigações</h2>
        <Link className="text-link" to="/runs">
          Todas as Runs <ArrowRight size={16} />
        </Link>
      </div>
      {runs.length ? (
        <RunTable runs={runs.slice(0, 4)} />
      ) : (
        <Empty>
          <FlaskConical size={26} />
          <h3>Sua primeira evidência começa aqui.</h3>
          <p>
            Execute o experimento para descobrir como este código se comporta
            sob concorrência.
          </p>
        </Empty>
      )}
      <div className="next-step">
        <Terminal size={21} />
        <div>
          <strong>A próxima mudança acontece no código.</strong>
          <p>
            Abra o workspace no VS Code, altere o sistema e execute novamente.
          </p>
        </div>
        <Link to="/systems">
          Localizar código <ArrowUpRight size={16} />
        </Link>
      </div>
    </>
  );
}
