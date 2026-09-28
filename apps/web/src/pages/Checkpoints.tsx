import { useState } from "react";
import { GitCommitHorizontal } from "lucide-react";
import type { Workbench } from "@backendlab/protocol";
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
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">EVOLUÇÃO DO SISTEMA</div>
          <h1>Checkpoints</h1>
          <p>
            Versões reais do código, salvas no Git independente do OrderDesk.
          </p>
        </div>
      </div>
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
            placeholder="Ex.: atualização de estoque em transação"
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
        {bench.checkpoints.map((checkpoint) => (
          <section className="checkpoint-item" key={checkpoint.id}>
            <GitCommitHorizontal size={22} />
            <div>
              <h3>{checkpoint.message}</h3>
              <p>
                {date(checkpoint.createdAt)} ·{" "}
                <code>{short(checkpoint.commit)}</code> · código{" "}
                <code>{short(checkpoint.digest)}</code>
              </p>
              {restoreId === checkpoint.id && (
                <div className="restore-confirm">
                  <p>
                    O runtime será parado e os arquivos serão substituídos. Um
                    checkpoint de segurança preservará o código atual. O banco
                    não será resetado.
                  </p>
                  <button
                    disabled={busy}
                    className="primary"
                    onClick={() =>
                      void action(async () => {
                        await api.restore(checkpoint.id);
                        setRestoreId(null);
                      }, "Código restaurado. Reinicie o runtime para carregá-lo.")
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
        ))}
      </div>
    </>
  );
}
