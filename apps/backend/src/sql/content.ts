import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
  openSync,
  closeSync,
  fsyncSync,
  renameSync,
  unlinkSync,
  linkSync,
  constants,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { readManifestSource } from "@bunkercode/content/manifest";
import {
  parseSqlDataset,
  parseSqlDefinition,
  parsePublicSqlExercise,
  publicSqlExercise,
  sqlId,
  sqlVersion,
  sqlObject,
  type SqlDefinition,
  type SqlDataset,
  type PublicSqlExercise,
} from "@bunkercode/content/sql";
export const sqlRevision = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export class SqlContent {
  constructor(readonly root: string) {}
  private path(parts: string[], create = false): string {
    const absolute = resolve(this.root);
    const chain: string[] = [];
    let path = absolute;
    for (
      let current = absolute;
      current !== dirname(current);
      current = dirname(current)
    )
      chain.unshift(current);
    for (const parent of chain) {
      if (!existsSync(parent)) {
        if (create) mkdirSync(parent);
        else throw new NotFoundException("Acervo SQL não encontrado.");
      }
      const s = lstatSync(parent);
      if (s.isSymbolicLink() || !s.isDirectory())
        throw new BadRequestException("Path SQL inválido.");
    }
    for (const part of parts) {
      path = join(path, part);
      if (existsSync(path)) {
        if (lstatSync(path).isSymbolicLink())
          throw new BadRequestException("Symlink SQL recusado.");
      } else if (create) mkdirSync(path);
    }
    return path;
  }
  private read(parts: string[]): unknown {
    try {
      return JSON.parse(readManifestSource(this.path(parts), 200000).text);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new NotFoundException("Definição SQL não encontrada ou inválida.");
    }
  }
  dataset(id: string, version: number): SqlDataset {
    const d = parseSqlDataset(
      this.read(["datasets", sqlId(id), sqlVersion(version) + ".json"]),
    );
    if (d.id !== id || d.version !== version)
      throw new BadRequestException(
        "Identidade do dataset diverge do arquivo.",
      );
    return d;
  }
  definition(id: string, version: number): SqlDefinition {
    const d = parseSqlDefinition(
      this.read(["exercises", sqlId(id), sqlVersion(version) + ".json"]),
    );
    if (d.id !== id || d.version !== version || d.status !== "published")
      throw new NotFoundException("Versão SQL não publicada.");
    this.dataset(d.dataset.id, d.dataset.version);
    return d;
  }
  public(id: string, version: number): PublicSqlExercise {
    if (existsSync(join(this.root, "public"))) {
      const p = parsePublicSqlExercise(
        this.read(["public", sqlId(id), sqlVersion(version) + ".json"]),
      );
      if (p.id !== id || p.version !== version)
        throw new BadRequestException("Identidade pública divergente.");
      return p;
    }
    const d = this.definition(id, version);
    return publicSqlExercise(d, this.dataset(d.dataset.id, d.dataset.version));
  }
  versions(): { id: string; version: number }[] {
    const location = this.path([
      existsSync(join(this.root, "public")) ? "public" : "exercises",
    ]);
    if (!existsSync(location)) return [];
    const result: { id: string; version: number }[] = [];
    for (const id of readdirSync(location).sort()) {
      sqlId(id);
      const dir = this.path([
        existsSync(join(this.root, "public")) ? "public" : "exercises",
        id,
      ]);
      if (!lstatSync(dir).isDirectory())
        throw new BadRequestException("Inventário SQL inválido.");
      for (const file of readdirSync(dir)) {
        if (file === "draft.json" || file.startsWith(".")) continue;
        if (!/^[1-9][0-9]*\.json$/.test(file))
          throw new BadRequestException("Arquivo SQL inesperado.");
        const version = sqlVersion(Number(file.slice(0, -5)));
        this.public(id, version);
        result.push({ id, version });
      }
    }
    return result;
  }
  laboratory() {
    if (!existsSync(join(this.root, "laboratory.json"))) return [];
    const selection = sqlObject(this.read(["laboratory.json"]), ["exercises"]);
    if (!Array.isArray(selection.exercises) || selection.exercises.length > 32)
      throw new BadRequestException("Seleção do laboratório SQL inválida.");
    const ids = new Set<string>();
    return selection.exercises.map((value: unknown) => {
      const entry = sqlObject(value, ["id", "version"]);
      const id = sqlId(entry.id),
        version = sqlVersion(entry.version);
      if (ids.has(id))
        throw new BadRequestException("Atividade SQL duplicada na vitrine.");
      ids.add(id);
      this.public(id, version);
      return { id, version };
    });
  }
  list() {
    return this.laboratory().map(({ id, version }) => this.public(id, version));
  }
  datasets() {
    if (!existsSync(join(this.root, "datasets"))) return [];
    const result: SqlDataset[] = [];
    for (const id of readdirSync(this.path(["datasets"])))
      for (const file of readdirSync(this.path(["datasets", sqlId(id)])))
        if (/^[1-9][0-9]*\.json$/.test(file))
          result.push(this.dataset(id, Number(file.slice(0, -5))));
    return result;
  }
  draft(id: string) {
    const definition = parseSqlDefinition(
      this.read(["exercises", sqlId(id), "draft.json"]),
    );
    if (definition.id !== id || definition.status !== "draft")
      throw new BadRequestException("Rascunho SQL inválido.");
    return { definition, revision: sqlRevision(definition) };
  }
  drafts() {
    if (!existsSync(join(this.root, "exercises"))) return [];
    return readdirSync(this.path(["exercises"]))
      .filter((id) =>
        existsSync(join(this.root, "exercises", sqlId(id), "draft.json")),
      )
      .map((id) => this.draft(id));
  }
  private write(
    directory: string,
    name: string,
    value: unknown,
    exclusive: boolean,
  ) {
    const temporary = join(directory, ".write-" + randomUUID());
    const fd = openSync(
      temporary,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      writeFileSync(fd, JSON.stringify(value, null, 2) + "\n");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    try {
      if (exclusive) {
        linkSync(temporary, join(directory, name));
        unlinkSync(temporary);
      } else renameSync(temporary, join(directory, name));
      const dir = openSync(directory, constants.O_RDONLY);
      try {
        fsyncSync(dir);
      } finally {
        closeSync(dir);
      }
    } catch (error) {
      if (existsSync(temporary)) unlinkSync(temporary);
      if ((error as NodeJS.ErrnoException).code === "EEXIST")
        throw new ConflictException("Versão publicada é imutável.");
      throw error;
    }
  }
  saveDataset(value: unknown) {
    const d = parseSqlDataset(value);
    const dir = this.path(["datasets", d.id], true);
    const files = readdirSync(dir).filter((f) => /^[1-9][0-9]*\.json$/.test(f));
    if (
      d.version !==
      Math.max(0, ...files.map((f) => Number(f.slice(0, -5)))) + 1
    )
      throw new ConflictException("Use a próxima versão do dataset.");
    this.write(dir, d.version + ".json", d, true);
    return d;
  }
  saveDraft(value: unknown, revision: unknown) {
    const d = parseSqlDefinition(value);
    if (d.status !== "draft")
      throw new BadRequestException("Salve como rascunho.");
    this.dataset(d.dataset.id, d.dataset.version);
    const dir = this.path(["exercises", d.id], true);
    return this.lock(dir, () => {
      const versions = readdirSync(dir).filter((f) =>
        /^[1-9][0-9]*\.json$/.test(f),
      );
      if (
        d.version !==
        Math.max(0, ...versions.map((f) => Number(f.slice(0, -5)))) + 1
      )
        throw new ConflictException("Use a próxima versão da atividade.");
      const current = existsSync(join(dir, "draft.json"))
        ? this.draft(d.id)
        : null;
      if (revision !== (current?.revision ?? null))
        throw new ConflictException(
          "Rascunho mudou; recarregue antes de salvar. Seu texto foi preservado.",
        );
      this.write(dir, "draft.json", d, false);
      return this.draft(d.id);
    });
  }
  publish(id: string, revision: unknown) {
    const dir = this.path(["exercises", sqlId(id)]);
    return this.lock(dir, () => {
      const draft = this.draft(id);
      if (draft.revision !== revision)
        throw new ConflictException("Rascunho mudou durante validação.");
      const published = { ...draft.definition, status: "published" as const };
      this.write(dir, published.version + ".json", published, true);
      return published;
    });
  }
  private lock<T>(dir: string, work: () => T): T {
    const path = join(dir, ".sql.lock");
    let fd: number;
    try {
      fd = openSync(
        path,
        constants.O_CREAT |
          constants.O_EXCL |
          constants.O_WRONLY |
          constants.O_NOFOLLOW,
        0o600,
      );
    } catch {
      throw new ConflictException(
        "SQL está em gravação ou requer inspeção de lock anterior.",
      );
    }
    try {
      return work();
    } finally {
      closeSync(fd);
      unlinkSync(path);
    }
  }
}
export function sqlPublicationFiles(contentRoot: string): Map<string, string> {
  const store = new SqlContent(join(contentRoot, "sql"));
  const files = new Map<string, string>();
  if (!existsSync(store.root)) return files;
  if (existsSync(join(store.root, "laboratory.json")))
    files.set(
      "sql/laboratory.json",
      JSON.stringify({ exercises: store.laboratory() }, null, 2) + "\n",
    );
  for (const { id, version } of store.versions())
    files.set(
      `sql/public/${id}/${version}.json`,
      JSON.stringify(store.public(id, version), null, 2) + "\n",
    );
  return files;
}
