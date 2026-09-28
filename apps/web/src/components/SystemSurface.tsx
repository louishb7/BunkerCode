import { useEffect, useRef, useState } from "react";
import type { Activity, SurfaceDefinition } from "@backendlab/protocol";
import { api } from "../api";

export function SystemSurface({
  surface,
  generation,
  disabled,
  onActivity,
  onFailure,
}: {
  surface: SurfaceDefinition;
  generation: string;
  disabled: boolean;
  onActivity: (activity: Activity) => void;
  onFailure: (error: string) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string>();
  const callbacks = useRef({ onActivity, onFailure, disabled, surface });
  callbacks.current = { onActivity, onFailure, disabled, surface };
  useEffect(() => {
    let active = true;
    setHtml(undefined);
    void api
      .surface()
      .then((result) => {
        if (active) setHtml(result.html);
      })
      .catch((error) => {
        if (active) callbacks.current.onFailure(String(error.message));
      });
    return () => {
      active = false;
    };
  }, [generation]);
  useEffect(() => {
    let active = true;
    let inFlight = false;
    async function receive(event: MessageEvent) {
      if (
        event.source !== frame.current?.contentWindow ||
        event.data?.type !== "bunkerlab:request"
      )
        return;
      const request = event.data;
      if (typeof request.id !== "string" || request.id.length > 100) return;
      const reply = (value: object) => {
        if (active)
          frame.current?.contentWindow?.postMessage(
            { type: "bunkerlab:response", id: request.id, ...value },
            "*",
          );
      };
      if (
        !callbacks.current.surface.operations.some(
          (operation) =>
            operation.method === request.method &&
            operation.path === request.path,
        )
      ) {
        reply({ error: "Operação não autorizada." });
        return;
      }
      if (callbacks.current.disabled || inFlight) {
        reply({ error: "Sistema ocupado. Aguarde a operação atual." });
        return;
      }
      inFlight = true;
      try {
        const activity = await api.interact({
          method: request.method,
          path: request.path,
          body: request.body,
        });
        callbacks.current.onActivity(activity);
        reply(
          activity.error
            ? { error: activity.error }
            : { response: { status: activity.status, body: activity.body } },
        );
        if (activity.error) callbacks.current.onFailure(activity.error);
      } catch (error) {
        reply({
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        inFlight = false;
      }
    }
    window.addEventListener("message", receive);
    return () => {
      active = false;
      window.removeEventListener("message", receive);
    };
  }, [generation]);
  if (!html)
    return <div className="surface-loading">Abrindo {surface.title}…</div>;
  // Scripts sem same-origin: a surface não pode acessar DOM, cookies ou APIs do host.
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'">`;
  return (
    <iframe
      ref={frame}
      title={`Surface ${surface.title}`}
      className="system-frame"
      sandbox="allow-scripts"
      srcDoc={policy + html}
    />
  );
}
