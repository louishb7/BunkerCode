import { RotateCcw } from "lucide-react";
import type { Workbench } from "@backendlab/protocol";
import { short, type Action } from "../components/shared";
import { api } from "../api";
export function SystemPage({
  bench,
  busy,
  action,
}: {
  bench: Workbench;
  busy: boolean;
  action: Action;
}) {
  const runtimeLabels = {
    ready: "Em execução",
    stopped: "Parado",
    starting: "Iniciando",
    crashed: "Falhou",
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SISTEMA EXPERIMENTAL</div>
          <h1>OrderDesk</h1>
          <p>{bench.system.description}</p>
        </div>
        <span
          className={`badge ${bench.runtime.status === "ready" ? "passed" : "neutral"}`}
        >
          {runtimeLabels[bench.runtime.status]}
        </span>
      </div>
      <section className="panel">
        <div className="section-title">
          <h2>Código do workspace</h2>
          <span className="badge neutral">
            {bench.workingCode.dirty
              ? "Modificações locais"
              : "Checkpoint salvo"}
          </span>
        </div>
        <p>
          Abra esta pasta no VS Code. O template e o código do laboratório ficam
          separados.
        </p>
        <div className="code-path">
          <code>{bench.codePath}</code>
          <button
            onClick={() =>
              void action(
                () => navigator.clipboard.writeText(bench.codePath),
                "Caminho copiado.",
              )
            }
          >
            Copiar
          </button>
        </div>
        <div className="instruction-row">
          <span>
            01 <strong>Edite inventory.mjs</strong>
          </span>
          <span>
            02 <strong>Reinicie o runtime</strong>
          </span>
          <span>
            03 <strong>Execute e compare</strong>
          </span>
        </div>
        <p className="subtle">
          A implementação inicial faz leitura e escrita separadas. O arquivo
          também oferece uma variante transacional para comparação.
        </p>
      </section>
      <div className="two-columns">
        <section className="panel">
          <h2>Runtime independente</h2>
          <p>
            Reiniciar carrega uma cópia do código salvo. O banco de pedidos é
            preservado.
          </p>
          <dl>
            <dt>PID</dt>
            <dd>
              <code>{bench.runtime.pid ?? "—"}</code>
            </dd>
            <dt>Porta local</dt>
            <dd>
              <code>{bench.runtime.port ?? "—"}</code>
            </dd>
            <dt>Código carregado</dt>
            <dd>
              <code>{short(bench.runtime.code?.digest)}</code>
            </dd>
            <dt>Código no workspace</dt>
            <dd>
              <code>{short(bench.workingCode.digest)}</code>
            </dd>
          </dl>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void action(
                api.restart,
                "Runtime reiniciado com o código do workspace.",
              )
            }
          >
            <RotateCcw size={16} />
            Reiniciar runtime
          </button>
          {bench.runtime.error && (
            <p className="negative">{bench.runtime.error}</p>
          )}
        </section>
        <section className="panel">
          <h2>Estado do sistema</h2>
          <p>
            Reset limpa pedidos e restaura 5 unidades. Código, checkpoints e
            Runs permanecem.
          </p>
          <div className="state-numbers">
            <div>
              <strong>{bench.state?.product?.stock ?? "—"}</strong>
              <span>unidades</span>
            </div>
            <div>
              <strong>{bench.state?.orders?.length ?? "—"}</strong>
              <span>pedidos</span>
            </div>
          </div>
          <button
            disabled={busy}
            onClick={() =>
              void action(
                api.reset,
                "Estado resetado: 5 unidades e nenhum pedido.",
              )
            }
          >
            <RotateCcw size={16} />
            Resetar estado
          </button>
        </section>
      </div>
      <details className="panel">
        <summary>Logs do processo</summary>
        <pre>
          {bench.runtime.logs.join("\n") ||
            "Nenhuma saída capturada nesta sessão."}
        </pre>
      </details>
    </>
  );
}
