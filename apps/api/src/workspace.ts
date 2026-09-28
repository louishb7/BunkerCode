import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  lstat,
  copyFile,
} from "node:fs/promises";
import { existsSync, lstatSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { CodeVersion, Checkpoint } from "@backendlab/protocol";
import { projectRoot } from "./paths";
import { LabRepository } from "./repository";
const exec = promisify(execFile);
const excluded = new Set([".git", "node_modules", ".env"]);
export class WorkspaceManager {
  constructor(
    private root: string,
    private repository: LabRepository,
  ) {}
  path(workspaceId: string, systemId: string) {
    return join(this.root, "workspaces", workspaceId, "systems", systemId);
  }
  private async git(path: string, args: string[]) {
    // Um diretório Git próprio é obrigatório: nunca permita descoberta do repositório pai.
    if (
      !existsSync(join(path, ".git")) ||
      !lstatSync(join(path, ".git")).isDirectory() ||
      lstatSync(join(path, ".git")).isSymbolicLink() ||
      existsSync(join(path, ".git", "commondir"))
    )
      throw new Error("O workspace precisa de um diretório Git independente.");
    const { stdout } = await exec(
      "git",
      [
        "-C",
        path,
        "--git-dir",
        join(path, ".git"),
        "--work-tree",
        path,
        "-c",
        "core.hooksPath=/dev/null",
        ...args,
      ],
      {
        timeout: 10000,
        maxBuffer: 1024 * 1024,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_CONFIG_GLOBAL: "/dev/null",
        },
      },
    );
    return stdout.trim();
  }
  async ensure(workspaceId: string, systemId: string, title = systemId) {
    const path = this.path(workspaceId, systemId);
    if (!existsSync(path)) {
      await mkdir(path, { recursive: true });
      for (const file of await this.files(
        join(projectRoot(), "templates", systemId),
      )) {
        await mkdir(join(path, file, ".."), { recursive: true });
        await copyFile(
          join(projectRoot(), "templates", systemId, file),
          join(path, file),
        );
      }
      await writeFile(
        join(path, ".gitignore"),
        "node_modules/\n.env*\n*.sqlite*\n",
      );
    }
    if (!existsSync(join(path, ".git")))
      await exec("git", ["init", "--initial-branch=main", path], {
        timeout: 10000,
      });
    try {
      await this.git(path, ["rev-parse", "HEAD"]);
    } catch {
      await this.checkpoint(workspaceId, systemId, `Base do ${title}`);
    }
  }
  async upgradeSurface(workspaceId: string, systemId: string) {
    const path = this.path(workspaceId, systemId);
    const marker = join(path, ".git", "bunkerlab-surface-v1");
    if (existsSync(marker)) return;
    if (existsSync(join(path, "surface.html"))) {
      await writeFile(marker, "1");
      return;
    }
    const server = await readFile(join(path, "server.mjs"));
    // Upgrade conservador: só o servidor canônico anterior, byte por byte, pode ser substituído.
    if (
      createHash("sha256").update(server).digest("hex") !==
      "d83220b471c6e8bc854cb3815e80132a3130d6e42e0e7d7b542d7c0b4d3cc88b"
    )
      return;
    await this.checkpoint(
      workspaceId,
      systemId,
      "Antes de adicionar a surface",
    );
    for (const file of ["server.mjs", "surface.html"])
      await copyFile(
        join(projectRoot(), "templates", systemId, file),
        join(path, file),
      );
    await this.checkpoint(workspaceId, systemId, "Surface do sistema");
    await writeFile(marker, "1");
  }
  private async files(root: string, prefix = ""): Promise<string[]> {
    const result: string[] = [];
    for (const item of await readdir(join(root, prefix), {
      withFileTypes: true,
    })) {
      if (
        excluded.has(item.name) ||
        item.name.startsWith(".env") ||
        item.name.includes(".sqlite")
      )
        continue;
      const name = join(prefix, item.name);
      if (item.isSymbolicLink())
        throw new Error(`Symlinks não são suportados no workspace: ${name}`);
      if (item.isDirectory()) result.push(...(await this.files(root, name)));
      else if (item.isFile()) result.push(name);
    }
    return result.sort();
  }
  private async digest(path: string): Promise<string> {
    const hash = createHash("sha256");
    let total = 0;
    for (const file of await this.files(path)) {
      const stat = await lstat(join(path, file));
      total += stat.size;
      if (total > 5 * 1024 * 1024)
        throw new Error("Workspace excede o limite local de 5 MiB de código.");
      hash.update(file + "\0");
      hash.update(await readFile(join(path, file)));
      hash.update("\0");
    }
    return hash.digest("hex");
  }
  async version(
    workspaceId: string,
    systemId: string,
  ): Promise<Omit<CodeVersion, "snapshot">> {
    const path = this.path(workspaceId, systemId);
    return {
      commit: await this.git(path, ["rev-parse", "HEAD"]),
      digest: await this.digest(path),
      dirty: !!(await this.git(path, [
        "status",
        "--porcelain",
        "--untracked-files=all",
      ])),
    };
  }
  async snapshot(workspaceId: string, systemId: string): Promise<CodeVersion> {
    const path = this.path(workspaceId, systemId);
    const before = await this.version(workspaceId, systemId);
    const target = join(this.root, "snapshots", randomUUID());
    await mkdir(target, { recursive: true });
    for (const file of await this.files(path)) {
      await mkdir(join(target, file, ".."), { recursive: true });
      await copyFile(join(path, file), join(target, file));
    }
    const after = await this.version(workspaceId, systemId);
    if (
      before.digest !== after.digest ||
      before.commit !== after.commit ||
      (await this.digest(target)) !== before.digest
    )
      throw new Error(
        "O código mudou durante a captura. Salve os arquivos e tente novamente.",
      );
    return { ...before, snapshot: relative(this.root, target) };
  }
  async checkpoint(
    workspaceId: string,
    systemId: string,
    message: string,
  ): Promise<Checkpoint> {
    const path = this.path(workspaceId, systemId);
    const files = await this.files(path);
    const ignored = new Set(
      (
        await this.git(path, [
          "ls-files",
          "--others",
          "--ignored",
          "--exclude-standard",
          "-z",
        ])
      ).split("\0"),
    );
    if (files.some((file) => ignored.has(file)))
      throw new Error(
        "Há arquivos de código ignorados pelo Git. Ajuste o .gitignore antes de salvar um checkpoint completo.",
      );
    const beforeDigest = await this.digest(path);
    await this.git(path, ["add", "--all", "--", "."]);
    await this.git(path, [
      "-c",
      "user.name=BunkerLab Local",
      "-c",
      "user.email=local@bunkerlab.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "-m",
      message,
    ]);
    const version = await this.version(workspaceId, systemId);
    if (version.dirty || beforeDigest !== version.digest)
      throw new Error(
        "O workspace mudou durante o checkpoint. Tente novamente. O commit Git foi preservado.",
      );
    const checkpoint = {
      id: randomUUID(),
      systemId,
      commit: version.commit,
      digest: version.digest,
      message,
      createdAt: Date.now(),
    };
    this.repository.saveCheckpoint(workspaceId, checkpoint);
    return checkpoint;
  }
  async restore(workspaceId: string, systemId: string, checkpoint: Checkpoint) {
    const path = this.path(workspaceId, systemId);
    // Um checkpoint de segurança mantém inclusive arquivos novos antes da restauração.
    await this.checkpoint(
      workspaceId,
      systemId,
      `Antes de restaurar: ${checkpoint.message}`,
    );
    await this.git(path, [
      "restore",
      "--source",
      checkpoint.commit,
      "--staged",
      "--worktree",
      "--",
      ".",
    ]);
    return this.checkpoint(
      workspaceId,
      systemId,
      `Restaurado: ${checkpoint.message}`,
    );
  }
}
