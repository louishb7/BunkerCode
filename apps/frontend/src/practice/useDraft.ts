import { localDay, recordActivity } from "../product/activity-store";
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
import {
  readRecovery,
  recoveryKey,
  removeRecovery,
  writeRecovery,
} from "./draft-recovery";
type Snapshot = {
  code: string;
  status: string;
  failed: boolean;
  saving: boolean;
  conflict?: Draft;
  previous?: Draft;
  ready: boolean;
  activityError?: string;
  recoveryError?: string;
};
// Only pending/failed work is retained across SPA navigation. Successful sessions are released.
const pending = new Map<string, DraftSession>();
let protecting = false;
function protect(event: BeforeUnloadEvent) {
  event.preventDefault();
  event.returnValue = "";
}
function updateProtection() {
  const needed = pending.size > 0;
  if (needed === protecting) return;
  protecting = needed;
  if (needed) window.addEventListener("beforeunload", protect);
  else window.removeEventListener("beforeunload", protect);
}
class DraftSession {
  state: Snapshot;
  expected: number | null = null;
  saved: string;
  writable = false;
  loading = false;
  activityDay = "";
  listeners = new Set<() => void>();
  recoveryRevisions = new Set<string>();
  retain() {
    pending.set(draftKey(this.scope, this.exercise.revision), this);
    updateProtection();
  }
  preserve() {
    this.retain();
    try {
      writeRecovery(this.scope, this.exercise.revision, this.state.code, [
        ...this.recoveryRevisions,
      ]);
      this.recoveryRevisions.add(this.exercise.revision);
      this.publish({ recoveryError: undefined });
    } catch {
      this.publish({
        recoveryError:
          "Não foi possível atualizar a cópia de recuperação desta aba. Copie ou baixe seu código antes de recarregar ou fechar.",
      });
    }
  }
  release() {
    try {
      for (const revision of this.recoveryRevisions) {
        removeRecovery(recoveryKey(this.scope, revision));
        this.recoveryRevisions.delete(revision);
      }
      pending.delete(draftKey(this.scope, this.exercise.revision));
      this.publish({ recoveryError: undefined });
    } catch {
      this.retain();
      this.publish({
        recoveryError:
          "Não foi possível remover a cópia de recuperação antiga. Tente limpar novamente antes de sair.",
      });
    }
    updateProtection();
    return this.recoveryRevisions.size === 0;
  }
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
    let recovery;
    try {
      recovery = readRecovery(this.scope, this.exercise.revision);
      if (recovery) {
        for (const revision of recovery.previousRevisions ?? []) {
          this.recoveryRevisions.add(revision);
          pending.delete(draftKey(this.scope, revision));
        }
        this.recoveryRevisions.add(recovery.revision);
        // A revision change can adopt this tab's older pending text, but must
        // still require a deliberate save against the new confirmed record.
        pending.delete(draftKey(this.scope, recovery.revision));
        this.publish({ code: recovery.code });
        this.retain();
      }
    } catch {
      this.publish({
        recoveryError:
          "Não foi possível ler a cópia de recuperação desta aba. Os dados existentes foram preservados; copie ou baixe novas edições antes de sair.",
      });
    }
    try {
      const { current, previous } = await loadDraft(
        this.scope,
        this.exercise.revision,
      );
      this.expected = current?.version ?? null;
      this.saved = current?.code ?? this.exercise.starterCode;
      this.writable = true;
      const recovered =
        recovery && recovery.code !== current?.code ? recovery : undefined;
      this.publish({
        code: recovered
          ? recovered.code
          : (current?.code ?? previous?.code ?? this.exercise.starterCode),
        previous,
        ready: true,
        failed: !!recovered,
        conflict: recovered ? current : undefined,
        status: recovered
          ? recovered.revision === this.exercise.revision
            ? "Edição pendente recuperada nesta aba. Revise antes de salvar; o rascunho confirmado não foi substituído."
            : "Edição pendente recuperada de uma revisão anterior. O enunciado mudou; revise antes de salvar."
          : current
            ? "Rascunho local recuperado."
            : previous
              ? "Definição alterada. Sua solução anterior foi preservada."
              : "Código inicial. Comece a escrever.",
      });
      if (recovery && !recovered) this.release();
    } catch (error) {
      this.publish({
        ready: true,
        failed: true,
        status: `${recovery ? "Edição pendente recuperada nesta aba. " : ""}${message(error)}`,
      });
    }
  }
  change(code: string) {
    if (code === this.state.code) return;
    const day = localDay(new Date());
    if (this.activityDay !== day) {
      this.activityDay = day;
      void recordActivity("edit", this.scope)
        .then(() => this.publish({ activityError: undefined }))
        .catch((error: unknown) => {
          this.activityDay = "";
          this.publish({
            activityError:
              error instanceof Error
                ? error.message
                : "Atividade não registrada.",
          });
        });
    }
    this.publish({ code });
    this.preserve();
    if (!this.state.failed && !this.state.conflict) void this.flush();
  }
  async flush(force = false) {
    if (this.state.saving || !this.writable || this.state.conflict) return;
    if (!force && this.state.code === this.saved) {
      this.release();
      return;
    }
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
      this.release();
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
    if (this.writable && this.state.code === this.saved && !this.state.failed) {
      this.release();
      return;
    }
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
  async discard() {
    if (this.state.saving) return;
    const code = this.state.code;
    try {
      const { current } = await loadDraft(this.scope, this.exercise.revision);
      if (this.state.code !== code) {
        this.publish({
          status:
            "O código mudou durante a leitura. Revise antes de descartar novamente.",
        });
        return;
      }
      if (!this.release()) return;
      this.expected = current?.version ?? null;
      this.saved = current?.code ?? this.exercise.starterCode;
      this.writable = true;
      this.publish({
        code: this.saved,
        conflict: undefined,
        failed: false,
        status: "Edição pendente descartada. Rascunho confirmado carregado.",
      });
    } catch (error) {
      this.publish({ status: message(error) });
    }
  }

  resolve(keep: boolean) {
    const current = this.state.conflict;
    if (!current) return;
    if (!keep && !this.release()) return;
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
    return () => {
      active = false;
      session.listeners.delete(notify);
    };
  }, [session]);
  return {
    ...session.state,
    change: (code: string) => session.change(code),
    retry: () => void session.retry(),
    resolve: (keep: boolean) => session.resolve(keep),
    discard: () => void session.discard(),
  };
}
