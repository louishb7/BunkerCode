import { useEffect, useRef, useState } from "react";
import type { CreateOrderInput, LabEvent, PreparedRun, RunDetail } from "@backendlab/protocol";
import { api } from "./api";

export function useOrderExecution() {
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const source = useRef<EventSource | null>(null);
  const generation = useRef(0);
  const reservation = useRef<PreparedRun | null>(null);
  const submitted = useRef(false);

  function clear() {
    generation.current += 1;
    source.current?.close();
    source.current = null;
    if (reservation.current && !submitted.current)
      void api.abandonRun(reservation.current.run.id).catch(() => {});
    reservation.current = null;
    setDetail(null);
    setInspectionError(null);
  }

  useEffect(() => () => {
    generation.current += 1;
    source.current?.close();
    if (reservation.current && !submitted.current)
      void api.abandonRun(reservation.current.run.id).catch(() => {});
  }, []);

  async function createOrder(input: CreateOrderInput): Promise<void> {
    clear();
    const attempt = generation.current;
    const prepared = await api.prepareRun();
    if (attempt !== generation.current) {
      await api.abandonRun(prepared.run.id);
      return;
    }
    reservation.current = prepared;
    submitted.current = false;
    const streamed: LabEvent[] = [];
    const stream = new EventSource(api.eventsUrl(prepared.run.id));
    source.current = stream;
    stream.onmessage = (message) => {
      const event = JSON.parse(message.data) as LabEvent;
      if (!streamed.some((item) => item.id === event.id)) streamed.push(event);
      if (["run.completed", "run.failed", "run.abandoned"].includes(event.type)) stream.close();
    };
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          stream.close();
          reject(new Error("Não foi possível conectar a execução. Tente novamente."));
        }, 5000);
        stream.onopen = () => { window.clearTimeout(timeout); resolve(); };
        stream.onerror = () => {
          window.clearTimeout(timeout);
          reject(new Error("Não foi possível conectar a execução. Tente novamente."));
        };
      });
      if (attempt !== generation.current) return;
      submitted.current = true;
      await api.createOrder(input, prepared);
    } finally {
      stream.close();
      try {
        let snapshot = await api.run(prepared.run.id);
        if (snapshot.run.status === "pending") {
          await api.abandonRun(prepared.run.id);
          snapshot = await api.run(prepared.run.id);
        }
        if (attempt === generation.current) {
          // O snapshot reconcilia eventos mesmo se o transporte SSE foi interrompido.
          setDetail({ ...snapshot, events: snapshot.events.length ? snapshot.events : streamed });
        }
      } catch {
        if (attempt === generation.current)
          setInspectionError("A ação foi enviada, mas seus detalhes não estão disponíveis.");
      }
      if (attempt === generation.current) reservation.current = null;
    }
  }

  return { detail, inspectionError, createOrder, clear };
}
