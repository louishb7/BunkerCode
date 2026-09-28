import { useEffect, useState } from "react";
import type { Activity } from "@backendlab/protocol";
import { api } from "../api";
import { Drawer } from "./Drawer";
export function ActivityInspector({
  id,
  close,
}: {
  id: string;
  close: () => void;
}) {
  const [activity, setActivity] = useState<Activity>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void api
      .activity(id)
      .then((value) => {
        if (active) setActivity(value);
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <Drawer title="Inspecionar atividade" close={close}>
      {error && <p role="alert">{error}</p>}
      {activity ? (
        <>
          <div className="activity-title">
            <code>
              {activity.method} {activity.path}
            </code>
            <span>
              {activity.status ?? "Sem resposta"} ·{" "}
              {activity.durationMs?.toFixed(1)} ms
            </span>
          </div>
          {activity.error && <p className="negative">{activity.error}</p>}
          <h3>Request</h3>
          <pre>{JSON.stringify(activity.requestBody, null, 2)}</pre>
          <h3>Resposta</h3>
          <pre>{JSON.stringify(activity.body, null, 2)}</pre>
          <h3>Evidências</h3>
          {activity.evidence.length === 0 && (
            <p>Nenhum evento emitido por esta operação.</p>
          )}
          {activity.evidence.map((event) => (
            <details className="event" key={event.sequence}>
              <summary>
                <code>+{event.timestamp - activity.startedAt}ms</code>
                <strong>{event.type}</strong>
              </summary>
              <pre>{JSON.stringify(event.payload, null, 2)}</pre>
            </details>
          ))}
          {activity.truncated && (
            <p>Evidências limitadas a 200 eventos de até 8 KiB.</p>
          )}
          <details className="secondary-details">
            <summary>Código e correlação</summary>
            <pre>
              {JSON.stringify(
                { id: activity.id, code: activity.code },
                null,
                2,
              )}
            </pre>
          </details>
          <p className="subtle">
            Atividade desta sessão. Não cria uma Run no histórico.
          </p>
        </>
      ) : (
        !error && <p>Carregando atividade…</p>
      )}
    </Drawer>
  );
}
