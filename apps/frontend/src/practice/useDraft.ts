import { useEffect, useState } from "react";
import type { Exercise } from "./exercise-api";
import {
  DraftConflict,
  draftKey,
  draftScope,
  loadDraft,
  saveDraft,
  type Draft,
} from "./draft-store";
type Snapshot = {
  code: string;
  status: string;
  failed: boolean;
  saving: boolean;
  conflict?: Draft;
  previous?: Draft;
  ready: boolean;
};
// Only pending/failed work is retained across SPA navigation. Successful sessions are released.
const pending = new Map<string, DraftSession>();
class DraftSession {
  state: Snapshot;
  expected: number | null = null;
  saved: string;
  writable = false;
  loading = false;
  listeners = new Set<() => void>();
  constructor(
    readonly scope: string,
    readonly exercise: Exercise,
  ) {
    this.saved = exercise.starterCode;
    this.state = {
      code: exercise.starterCode,
      status: "Abrindo rascunho…",
      failed: false,
      saving: false,
      ready: false,
    };
  }
  publish(change: Partial<Snapshot>) {
    this.state = { ...this.state, ...change };
    this.listeners.forEach((notify) => notify());
  }
  async load() {
    if (this.loading) return;
    this.loading = true;
    try {
      const { current, previous } = await loadDraft(
        this.scope,
        this.exercise.revision,
      );
      this.expected = current?.version ?? null;
      this.saved = current?.code ?? this.exercise.starterCode;
      this.writable = true;
      this.publish({
        code: current?.code ?? previous?.code ?? this.exercise.starterCode,
        previous,
        ready: true,
        status: current
          ? "Rascunho local recuperado."
          : previous
            ? "Definição alterada. Sua solução anterior foi preservada."
            : "Código inicial. Comece a escrever.",
      });
    } catch (error) {
      this.publish({ ready: true, failed: true, status: message(error) });
    }
  }
  change(code: string) {
    this.publish({ code });
    pending.set(draftKey(this.scope, this.exercise.revision), this);
    if (!this.state.failed && !this.state.conflict) void this.flush();
  }
  async flush(force = false) {
    if (this.state.saving || !this.writable || this.state.conflict) return;
    if (!force && this.state.code === this.saved) return;
    this.publish({
      saving: true,
      failed: false,
      status: "Salvando rascunho local…",
    });
    try {
      // Coalesce edits arriving while a transaction is running, without letting an old result confirm newer text.
      do {
        const code = this.state.code;
        const record = await saveDraft(
          this.scope,
          this.exercise.revision,
          code,
          this.expected,
        );
        this.expected = record.version;
        this.saved = code;
      } while (this.state.code !== this.saved);
      pending.delete(draftKey(this.scope, this.exercise.revision));
      this.publish({
        saving: false,
        failed: false,
        status: "Rascunho salvo neste navegador.",
      });
    } catch (error) {
      this.publish({
        saving: false,
        failed: true,
        conflict: error instanceof DraftConflict ? error.current : undefined,
        status: message(error),
      });
    }
  }
  async retry() {
    if (!this.writable) {
      try {
        const { current } = await loadDraft(this.scope, this.exercise.revision);
        if (current) {
          this.publish({
            conflict: current,
            failed: true,
            status: "Existe um rascunho salvo. Revise antes de substituir.",
          });
          return;
        }
        this.writable = true;
      } catch (error) {
        this.publish({ status: message(error) });
        return;
      }
    }
    await this.flush(true);
  }
  resolve(keep: boolean) {
    const current = this.state.conflict;
    if (!current) return;
    this.expected = current.version;
    this.saved = current.code;
    this.writable = true;
    this.publish({
      conflict: undefined,
      failed: false,
      code: keep ? this.state.code : current.code,
      status: keep
        ? "Salvando sua escolha…"
        : "Rascunho da outra aba carregado.",
    });
    if (keep) void this.flush(true);
    else pending.delete(draftKey(this.scope, this.exercise.revision));
  }
}
function message(error: unknown) {
  return error instanceof DraftConflict
    ? error.message
    : `${error instanceof Error ? error.message : "Falha no armazenamento local."} Copie ou baixe seu código antes de sair.`;
}
export function useDraft(course: string, lesson: string, exercise: Exercise) {
  const [session] = useState(
    () =>
      pending.get(
        draftKey(draftScope(course, lesson, exercise.id), exercise.revision),
      ) ?? new DraftSession(draftScope(course, lesson, exercise.id), exercise),
  );
  const [, refresh] = useState(0);
  useEffect(() => {
    let active = true;
    const notify = () => {
      if (active) refresh((value) => value + 1);
    };
    session.listeners.add(notify);
    if (!session.state.ready) void session.load();
    const protect = (event: BeforeUnloadEvent) => {
      if (
        session.state.saving ||
        session.state.failed ||
        session.state.code !== session.saved
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => {
      active = false;
      session.listeners.delete(notify);
      window.removeEventListener("beforeunload", protect);
    };
  }, [session]);
  return {
    ...session.state,
    change: (code: string) => session.change(code),
    retry: () => void session.retry(),
    resolve: (keep: boolean) => session.resolve(keep),
  };
}
