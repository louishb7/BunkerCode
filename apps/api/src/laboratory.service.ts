import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
  type OnModuleDestroy,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type {
  ExperimentConfig,
  Workbench,
  SystemState,
} from "@backendlab/protocol";
import { dataRoot } from "./paths";
import { LabRepository } from "./repository";
import { WorkspaceManager } from "./workspace";
import { RuntimeManager } from "./runtime";
import { ExperimentRunner } from "./runner";
import { systems, experiments } from "./catalog";

@Injectable()
export class LaboratoryService implements OnModuleInit, OnModuleDestroy {
  private root = dataRoot();
  private repository!: LabRepository;
  private workspaces!: WorkspaceManager;
  private runtimes = new Map<string, RuntimeManager>();
  private busy = new Map<string, string>();
  private tasks = new Set<Promise<unknown>>();
  private closing = false;
  private ownsLock = false;
  async onModuleInit() {
    mkdirSync(this.root, { recursive: true });
    const lock = join(this.root, "control.lock");
    try {
      const fd = openSync(lock, "wx");
      writeFileSync(fd, String(process.pid));
      closeSync(fd);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const pid = Number(readFileSync(lock, "utf8"));
      if (!Number.isInteger(pid) || pid <= 0)
        throw new Error("Control lock inválido; inspecione control.lock.");
      try {
        process.kill(pid, 0);
        throw new Error(
          "Já existe um control plane usando este diretório de dados.",
        );
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code !== "ESRCH") throw cause;
      }
      unlinkSync(lock);
      const fd = openSync(lock, "wx");
      writeFileSync(fd, String(process.pid));
      closeSync(fd);
    }
    this.ownsLock = true;
    try {
      this.repository = new LabRepository(this.root);
      this.repository.recover();
      this.workspaces = new WorkspaceManager(this.root, this.repository);
      for (const system of systems) {
        await this.workspaces.ensure("local", system.id);
        this.runtimes.set(
          `local/${system.id}`,
          new RuntimeManager(this.root, "local", system.id),
        );
      }
    } catch (error) {
      this.repository?.close();
      unlinkSync(lock);
      this.ownsLock = false;
      throw error;
    }
  }
  async onModuleDestroy() {
    this.closing = true;
    await Promise.all(
      [...this.runtimes.values()].map((runtime) => runtime.stop()),
    );
    await Promise.allSettled(this.tasks);
    // Uma operação de restart que já estava preparando o snapshot pode ter iniciado durante o shutdown.
    await Promise.all(
      [...this.runtimes.values()].map((runtime) => runtime.stop()),
    );
    this.repository?.close();
    if (this.ownsLock) {
      unlinkSync(join(this.root, "control.lock"));
      this.ownsLock = false;
    }
  }
  private scope(workspaceId: string, systemId: string) {
    const system = systems.find((entry) => entry.id === systemId);
    const key = `${workspaceId}/${systemId}`;
    const runtime = this.runtimes.get(key);
    if (!system || !runtime)
      throw new NotFoundException("Workspace ou sistema não encontrado.");
    return { system, runtime, key };
  }
  private async exclusive<T>(
    key: string,
    name: string,
    action: () => Promise<T>,
  ): Promise<T> {
    if (this.closing || this.busy.has(key))
      throw new ConflictException(
        "O sistema está ocupado. Aguarde a operação atual.",
      );
    this.busy.set(key, name);
    const task = action();
    this.tasks.add(task);
    try {
      return await task;
    } finally {
      this.tasks.delete(task);
      if (this.busy.get(key) === name) this.busy.delete(key);
    }
  }
  async workbench(workspaceId: string, systemId: string): Promise<Workbench> {
    const { system, runtime, key } = this.scope(workspaceId, systemId);
    let state: SystemState | null = null;
    if (runtime.status().status === "ready" && !this.busy.has(key)) {
      try {
        const response = await runtime.request("/state");
        if (response.status === 200) state = response.body as SystemState;
      } catch {
        /* O diagnóstico do runtime permanece disponível. */
      }
    }
    return {
      workspace: { id: workspaceId, name: "Workspace local" },
      system,
      experiments: experiments
        .filter((item) => item.systemId === systemId)
        .map((item) => item.summary),
      runtime: runtime.status(),
      codePath: this.workspaces.path(workspaceId, systemId),
      workingCode: await this.workspaces.version(workspaceId, systemId),
      state,
      busy: this.busy.get(key) ?? null,
      checkpoints: this.repository.checkpoints(workspaceId, systemId),
    };
  }
  async restart(workspaceId: string, systemId: string) {
    const { runtime, key } = this.scope(workspaceId, systemId);
    return this.exclusive(key, "Reiniciando runtime", async () => {
      await runtime.start(
        await this.workspaces.snapshot(workspaceId, systemId),
      );
      return runtime.status();
    });
  }
  async reset(workspaceId: string, systemId: string) {
    const { runtime, key } = this.scope(workspaceId, systemId);
    return this.exclusive(key, "Resetando estado", async () => {
      if (runtime.status().status !== "ready")
        await runtime.start(
          await this.workspaces.snapshot(workspaceId, systemId),
        );
      const response = await runtime.request("/reset", { stock: 5 });
      if (response.status !== 200)
        throw new BadRequestException("O sistema recusou o reset.");
      return response.body;
    });
  }
  async checkpoint(workspaceId: string, systemId: string, body: unknown) {
    const { key } = this.scope(workspaceId, systemId);
    const message = (body as { message?: unknown })?.message;
    if (typeof message !== "string" || !message.trim() || message.length > 120)
      throw new BadRequestException(
        "Informe uma descrição de até 120 caracteres.",
      );
    return this.exclusive(key, "Salvando checkpoint", () =>
      this.workspaces.checkpoint(workspaceId, systemId, message.trim()),
    );
  }
  async restore(workspaceId: string, systemId: string, id: string) {
    const { key, runtime } = this.scope(workspaceId, systemId);
    const checkpoint = this.repository
      .checkpoints(workspaceId, systemId)
      .find((item) => item.id === id);
    if (!checkpoint) throw new NotFoundException("Checkpoint não encontrado.");
    return this.exclusive(key, "Restaurando checkpoint", async () => {
      await runtime.stop();
      return this.workspaces.restore(workspaceId, systemId, checkpoint);
    });
  }
  async startRun(
    workspaceId: string,
    systemId: string,
    experimentId: string,
    body: unknown,
  ) {
    const { runtime, key } = this.scope(workspaceId, systemId);
    const definition = experiments.find(
      (entry) => entry.id === experimentId && entry.systemId === systemId,
    );
    if (!definition) throw new NotFoundException("Experimento não encontrado.");
    const input = (body ?? {}) as Partial<ExperimentConfig>;
    const config = { ...definition.summary.defaults, ...input };
    for (const [name, value] of Object.entries(config)) {
      if (
        !["stock", "clients", "concurrency"].includes(name) ||
        !Number.isSafeInteger(value) ||
        value < (name === "stock" ? 0 : 1) ||
        value > 100
      )
        throw new BadRequestException(
          "Estoque: 0–100. Compradores e concorrência: 1–100.",
        );
    }
    return this.exclusive(key, "Preparando experimento", async () => {
      // Uma edição nunca entra silenciosamente em uma run: ela exige restart explícito.
      if (runtime.status().status !== "ready") {
        // O snapshot é registrado antes de iniciar: até erro de sintaxe vira uma Run persistida.
        const code = await this.workspaces.snapshot(workspaceId, systemId);
        return this.launch(
          workspaceId,
          systemId,
          key,
          runtime,
          definition,
          config,
          code,
          true,
        );
      }
      return this.launch(
        workspaceId,
        systemId,
        key,
        runtime,
        definition,
        config,
        runtime.status().code!,
        false,
      );
    });
  }
  private launch(
    workspaceId: string,
    systemId: string,
    key: string,
    runtime: RuntimeManager,
    definition: (typeof experiments)[number],
    config: ExperimentConfig,
    code: NonNullable<Workbench["runtime"]["code"]>,
    start: boolean,
  ) {
    const checkpoint = this.repository
      .checkpoints(workspaceId, systemId)
      .find((entry) => entry.digest === code.digest);
    const run = this.repository.createRun({
      id: randomUUID(),
      workspaceId,
      systemId,
      experimentId: definition.id,
      status: "running",
      createdAt: Date.now(),
      config,
      code,
      checkpoint,
    });
    // O lock é transferido para a run antes de responder 202; não há janela para outro comando.
    this.busy.set(key, `Executando Run #${run.number}`);
    const task = new Promise<void>((resolve) => setImmediate(resolve)).then(
      async () => {
        this.busy.set(key, `Executando Run #${run.number}`);
        try {
          if (this.closing) throw new Error("Control plane em encerramento.");
          if (start) await runtime.start(code);
          await new ExperimentRunner(this.repository, runtime).execute(
            run,
            definition,
          );
        } catch (error) {
          run.status = "error";
          run.error = error instanceof Error ? error.message : String(error);
          run.completedAt = Date.now();
          run.durationMs = run.completedAt - run.createdAt;
          this.repository.updateRun(run);
        } finally {
          this.busy.delete(key);
        }
      },
    );
    this.tasks.add(task);
    void task.then(
      () => this.tasks.delete(task),
      () => this.tasks.delete(task),
    );
    return run;
  }
  runs(workspaceId: string, systemId: string, before?: string) {
    this.scope(workspaceId, systemId);
    const cursor =
      before === undefined ? Number.MAX_SAFE_INTEGER : Number(before);
    if (!Number.isSafeInteger(cursor) || cursor < 1)
      throw new BadRequestException("Cursor inválido.");
    return this.repository.listRuns(workspaceId, systemId, 100, cursor);
  }
  detail(workspaceId: string, systemId: string, id: string) {
    this.scope(workspaceId, systemId);
    const detail = this.repository.detail(workspaceId, systemId, id);
    if (!detail) throw new NotFoundException("Run não encontrada.");
    return detail;
  }
}
