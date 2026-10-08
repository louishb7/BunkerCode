import { useState } from "react";
import { GitCommitHorizontal } from "lucide-react";
import type { Checkpoint, Workbench } from "@backendlab/protocol";
import { date, short, type Action } from "../components/shared";
import { api } from "../api";
export function Checkpoints({
  bench,
  busy,
  action,
}: {
  bench: Workbench;
  busy: boolean;
  action: Action;
}) {
  const [message, setMessage] = useState("");
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const currentId = bench.checkpoints.find(
    (item) =>
      !["backup", "restore"].includes(item.kind ?? "user") &&
      item.digest === bench.workingCode.digest,
  )?.id;
  const renderCheckpoint = (checkpoint: Checkpoint) => (
    <section className="checkpoint-item" key={checkpoint.id}>
      <GitCommitHorizontal size={22} />
      <div>
        <h3>
          {checkpoint.kind === "backup"
            ? "Backup automático"
            : checkpoint.kind === "restore"
              ? "Registro de restauração"
              : checkpoint.message}
        </h3>
        {checkpoint.id === currentId && (
          <p>
            {bench.runtime.status === "ready" &&
            bench.runtime.code?.digest === checkpoint.digest
              ? "Código atual · em execução"
              : "Código atual no workspace"}
          </p>
        )}
        <p>{date(checkpoint.createdAt)}</p>
        <details>
          <summary>Detalhes do checkpoint</summary>
          {["backup", "restore"].includes(checkpoint.kind ?? "user") && (
            <p>{checkpoint.message}</p>
          )}
          <p>
            Commit <code>{short(checkpoint.commit)}</code> · código{" "}
            <code>{short(checkpoint.digest)}</code>
          </p>
        </details>
        {restoreId === checkpoint.id && (
          <div className="restore-confirm">
            <p>
              O runtime será parado e os arquivos serão substituídos. Um
              checkpoint de segurança preservará o código atual. O banco não
              será resetado.
            </p>
            <button
              disabled={busy}
              className="primary"
              onClick={() =>
                void action(async () => {
                  await api.restore(checkpoint.id);
                  setRestoreId(null);
                }, "Código restaurado no workspace. Aplique para colocá-lo em execução.")
              }
            >
              Restaurar com cópia de segurança
            </button>{" "}
            <button onClick={() => setRestoreId(null)}>Cancelar</button>
          </div>
        )}
      </div>
      <button disabled={busy} onClick={() => setRestoreId(checkpoint.id)}>
        Restaurar
      </button>
    </section>
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Checkpoints</h1>
          <p>Pontos que você quer preservar na evolução do código.</p>
        </div>
      </div>
      {bench.applyRequired && (
        <p className="code-change">
          Código restaurado no workspace, ainda não aplicado.
          <button
            disabled={busy}
            onClick={() =>
              void action(
                () => api.restart(),
                "Código salvo carregado. Runtime reiniciado.",
              )
            }
          >
            Aplicar código restaurado
          </button>
        </p>
      )}
      <form
        className="checkpoint-form panel"
        onSubmit={(event) => {
          event.preventDefault();
          void action(async () => {
            await api.checkpoint(message);
            setMessage("");
          }, "Checkpoint salvo no Git do workspace.");
        }}
      >
        <label htmlFor="checkpoint-message">O que mudou nesta versão?</label>
        <div>
          <input
            id="checkpoint-message"
            value={message}
            maxLength={120}
            required
            placeholder="Ex.: antes de tentar uma alteração"
            onChange={(event) => setMessage(event.target.value)}
          />
          <button className="primary" disabled={busy || !message.trim()}>
            <GitCommitHorizontal size={17} />
            Salvar checkpoint
          </button>
        </div>
        <small>
          Salva os arquivos do workspace. Não salva o estado do banco nem altera
          o runtime carregado.
        </small>
      </form>
      <div className="checkpoint-list">
        {bench.checkpoints
          .filter(
            (item) => !["backup", "restore"].includes(item.kind ?? "user"),
          )
          .map(renderCheckpoint)}
        <details className="automatic-checkpoints">
          <summary>
            Backups automáticos e restaurações (
            {
              bench.checkpoints.filter((item) =>
                ["backup", "restore"].includes(item.kind ?? "user"),
              ).length
            }
            )
          </summary>
          <p className="subtle">
            Cópias de segurança continuam disponíveis para restauração.
          </p>
          {bench.checkpoints
            .filter((item) =>
              ["backup", "restore"].includes(item.kind ?? "user"),
            )
            .map(renderCheckpoint)}
        </details>
      </div>
    </>
  );
}
