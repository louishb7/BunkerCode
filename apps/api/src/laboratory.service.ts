import {
  BadRequestException,
  ServiceUnavailableException,
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
import { ActivityBuffer } from "./activities";
import { systems, experiments } from "./catalog";
import { investigationsFor } from "./investigations";

@Injectable()
export class LaboratoryService implements OnModuleInit, OnModuleDestroy {
  private root = dataRoot();
  private repository!: LabRepository;
  private workspaces!: WorkspaceManager;
  private runtimes = new Map<string, RuntimeManager>();
  private busy = new Map<string, string>();
  private tasks = new Set<Promise<unknown>>();
  private activities = new Map<string, ActivityBuffer>();
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
        await this.workspaces.ensure("local", system.id, system.name);
        if (system.id === "orderdesk")
          await this.workspaces.upgradeGuidance("local", system.id);
        if (system.surface)
          await this.workspaces.upgradeSurface("local", system.id);
        const runtime = new RuntimeManager(this.root, "local", system.id);
        const activities = new ActivityBuffer();
        runtime.observeActivity((event, runId) =>
          activities.collect(event, runId),
        );
        this.runtimes.set(`local/${system.id}`, runtime);
        this.activities.set(`local/${system.id}`, activities);
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
        const response = await runtime.request(system.statePath);
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
      applyRequired: this.workspaces.requiresApply(workspaceId, systemId),
      state,
      busy: this.busy.get(key) ?? null,
      checkpoints: this.repository.checkpoints(workspaceId, systemId),
    };
  }
  systems(workspaceId: string) {
    if (workspaceId !== "local")
      throw new NotFoundException("Workspace não encontrado.");
    return systems.map((system) => ({
      ...system,
      runtime: this.scope(workspaceId, system.id).runtime.status().status,
    }));
  }
  async open(workspaceId: string, systemId: string) {
    const { key, runtime } = this.scope(workspaceId, systemId);
    if (runtime.status().status === "ready" || this.busy.has(key))
      return runtime.status();
    // Apenas parado inicia automaticamente. Falhas exigem uma ação explícita do usuário.
    if (
      runtime.status().status === "crashed" ||
      this.workspaces.requiresApply(workspaceId, systemId)
    )
      return runtime.status();
    try {
      await this.restart(workspaceId, systemId);
    } catch {
      /* O erro fica disponível no runtime. */
    }
    return runtime.status();
  }
  async surface(workspaceId: string, systemId: string) {
    const { system, runtime } = this.scope(workspaceId, systemId);
    if (!system.surface)
      throw new NotFoundException("Este sistema não oferece uma surface.");
    try {
      const response = await runtime.request(
        system.surface.path,
        undefined,
        undefined,
        undefined,
        "text",
      );
      if (response.status !== 200)
        throw new Error(
          `Surface retornou HTTP ${response.status}. O workspace pode ser anterior à versão com surface.`,
        );
      return { html: response.body as string };
    } catch (error) {
      throw new ServiceUnavailableException(
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  activityList(workspaceId: string, systemId: string) {
    const { key } = this.scope(workspaceId, systemId);
    return this.activities.get(key)!.list();
  }
  activityDetail(workspaceId: string, systemId: string, id: string) {
    const { key } = this.scope(workspaceId, systemId);
    const value = this.activities.get(key)!.detail(id);
    if (!value)
      throw new NotFoundException(
        "Atividade expirou ou pertence a outra sessão do control plane.",
      );
    return value;
  }
  async interact(workspaceId: string, systemId: string, input: unknown) {
    const { key, runtime, system } = this.scope(workspaceId, systemId);
    const operation = input as {
      method?: string;
      path?: string;
      body?: unknown;
    };
    if (
      !operation ||
      !system.surface?.operations.some(
        (item) =>
          item.method === operation.method && item.path === operation.path,
      )
    )
      throw new BadRequestException(
        "Operação não autorizada para esta surface.",
      );
    if (JSON.stringify(operation.body ?? null).length > 4096)
      throw new BadRequestException("Request excede 4 KiB.");
    return this.exclusive(key, "Interação com o sistema", async () => {
      const buffer = this.activities.get(key)!;
      const activity = buffer.begin(
        systemId,
        operation.method as "GET" | "POST",
        operation.path!,
        operation.body,
        runtime.status().code,
      );
      const started = performance.now();
      try {
        const response = await runtime.request(
          operation.path!,
          operation.method === "POST" ? (operation.body ?? {}) : undefined,
          { requestId: activity.id },
        );
        activity.status = response.status;
        activity.body = response.body;
        await runtime.flush();
      } catch (error) {
        activity.error = error instanceof Error ? error.message : String(error);
        // Interações com timeout também não podem continuar escrevendo após liberar a bancada.
        await runtime.stop();
        activity.error = runtime.status().error ?? activity.error;
      } finally {
        activity.durationMs = performance.now() - started;
        buffer.end();
      }
      return activity;
    });
  }
  async restart(workspaceId: string, systemId: string) {
    const { runtime, key } = this.scope(workspaceId, systemId);
    return this.exclusive(key, "Reiniciando runtime", async () => {
      try {
        const code = await this.workspaces.snapshot(workspaceId, systemId);
        // Aplicar foi solicitado explicitamente, mesmo se o código não conseguir iniciar.
        await this.workspaces.acknowledgeApply(workspaceId, systemId);
        await runtime.start(code);
      } catch {
        throw new ServiceUnavailableException(
          "O runtime não iniciou. O diagnóstico está disponível na área do sistema.",
        );
      }
      return runtime.status();
    });
  }
  async reset(workspaceId: string, systemId: string) {
    const { runtime, key, system } = this.scope(workspaceId, systemId);
    return this.exclusive(key, "Resetando estado", async () => {
      if (this.workspaces.requiresApply(workspaceId, systemId))
        throw new ConflictException(
          "Aplique o código restaurado antes de executar o sistema.",
        );
      if (runtime.status().status !== "ready")
        await runtime.start(
          await this.workspaces.snapshot(workspaceId, systemId),
        );
      const response = await runtime.request(
        system.reset.path,
        system.reset.body,
      );
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
    if (
      body !== undefined &&
      body !== null &&
      (typeof body !== "object" || Array.isArray(body))
    )
      throw new BadRequestException("Condições inválidas.");
    const input = (body ?? {}) as Record<string, number>;
    const config = { ...definition.summary.defaults, ...input };
    for (const [name, value] of Object.entries(config)) {
      const field = definition.summary.fields?.find(
        (field) => field.key === name,
      );
      if (
        !field ||
        !Number.isSafeInteger(value) ||
        value < field.min ||
        value > field.max
      )
        throw new BadRequestException(
          "Condições inválidas para esta ferramenta.",
        );
    }
    return this.exclusive(key, "Preparando experimento", async () => {
      if (this.workspaces.requiresApply(workspaceId, systemId))
        throw new ConflictException(
          "Aplique o código restaurado antes de executar o sistema.",
        );
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
    return this.repository
      .listRuns(workspaceId, systemId, 100, cursor)
      .map((run) => this.present(run));
  }
  detail(workspaceId: string, systemId: string, id: string) {
    this.scope(workspaceId, systemId);
    const detail = this.repository.detail(workspaceId, systemId, id);
    if (!detail) throw new NotFoundException("Run não encontrada.");
    detail.run = this.present(detail.run);
    return { ...detail, investigations: investigationsFor(detail) };
  }
  private present(run: import("@backendlab/protocol").Run) {
    const definition = experiments.find(
      (item) => item.id === run.experimentId && item.systemId === run.systemId,
    );
    if (
      run.result &&
      !run.result.observations &&
      run.initialState &&
      definition
    ) {
      run.result.observations = definition.observations(
        run.initialState,
        run.result,
      );
    }
    return run;
  }
}
