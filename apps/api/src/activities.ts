import { randomUUID } from "node:crypto";
import type { Activity, CodeVersion, Evidence } from "@backendlab/protocol";

// Histórico transitório de uso humano. Nenhum registro é criado em runs/evidence no SQLite.
export class ActivityBuffer {
  private items: Activity[] = [];
  private active?: Activity;
  begin(
    systemId: string,
    method: "GET" | "POST",
    path: string,
    body: unknown,
    code?: CodeVersion,
  ) {
    const item: Activity = {
      id: randomUUID(),
      systemId,
      method,
      path,
      requestBody: body ?? null,
      startedAt: Date.now(),
      status: null,
      body: null,
      evidence: [],
      code,
    };
    this.items.unshift(item);
    this.items.length = Math.min(this.items.length, 50);
    this.active = item;
    return item;
  }
  collect(event: Omit<Evidence, "sequence">, runId?: string) {
    if (
      runId ||
      !this.active ||
      (event.requestId && event.requestId !== this.active.id)
    )
      return;
    const item = this.active;
    if (item.evidence.length >= 200) {
      item.truncated = true;
      return;
    }
    const payload = JSON.stringify(event.payload);
    if (payload.length > 8192) item.truncated = true;
    item.evidence.push({
      ...event,
      sequence: item.evidence.length + 1,
      payload: payload.length > 8192 ? { truncated: true } : event.payload,
    });
  }
  end() {
    this.active = undefined;
  }
  list() {
    return this.items.map(
      ({ evidence: _evidence, requestBody: _request, body: _body, ...item }) =>
        item,
    );
  }
  detail(id: string) {
    return this.items.find((item) => item.id === id);
  }
}
