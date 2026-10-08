import {
  constants,
  openSync,
  closeSync,
  writeFileSync,
  fchmodSync,
  fsyncSync,
  renameSync,
  unlinkSync,
  lstatSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  Logger,
  PayloadTooLargeException,
} from "@nestjs/common";
import { coursesRoot, lessonLocation } from "./courses";
import {
  MAX_MARKDOWN_BYTES,
  markdownVersion,
  readMarkdownFile,
  type MarkdownRevision,
} from "./markdown-file";

const logger = new Logger("Studio");
function input(value: unknown): MarkdownRevision {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BadRequestException(
      "Envie markdown e version em um objeto JSON.",
    );
  const body = value as Record<string, unknown>;
  if (
    Object.keys(body).some((key) => !["markdown", "version"].includes(key)) ||
    typeof body.markdown !== "string" ||
    typeof body.version !== "string" ||
    !/^[a-f0-9]{64}$/.test(body.version)
  )
    throw new BadRequestException(
      "Informe Markdown textual e a versão originalmente carregada; paths não são aceitos.",
    );
  if (Buffer.byteLength(body.markdown, "utf8") > MAX_MARKDOWN_BYTES)
    throw new PayloadTooLargeException("O Markdown excede 256 KiB.");
  if (
    body.markdown.includes("\0") ||
    Buffer.from(body.markdown, "utf8").toString("utf8") !== body.markdown
  )
    throw new BadRequestException(
      "O Markdown deve ser texto Unicode válido, sem bytes nulos.",
    );
  return { markdown: body.markdown, version: body.version };
}
function conflict(): never {
  throw new ConflictException(
    "O arquivo mudou desde a leitura. Seu texto não foi gravado; revise a versão atual antes de salvar novamente.",
  );
}
// Synchronous bounded IO avoids awaits in the check/replace window. The exclusive
// per-lesson lock also coordinates other Studio processes, not external editors.
export function saveLesson(
  id: string,
  slug: string,
  value: unknown,
  root = coursesRoot(),
): MarkdownRevision {
  const requested = input(value);
  const location = lessonLocation(id, slug, root);
  const directory = dirname(location.path);
  const lockPath = join(directory, ".studio-save.lock");
  const temporary = join(directory, ".studio-" + randomUUID() + ".tmp");
  let lock: number;
  try {
    lock = openSync(
      lockPath,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new ConflictException(
        "Outra gravação está em andamento ou deixou um lock. Seu texto não foi alterado.",
      );
    logger.error(
      "Cannot acquire lesson write lock",
      error instanceof Error ? error.stack : String(error),
    );
    throw new InternalServerErrorException(
      "Não foi possível iniciar o salvamento. Preserve seu texto e confira o arquivo.",
    );
  }
  let descriptor: number | undefined;
  let temporaryOwned = false;
  let result: MarkdownRevision | undefined;
  let failure: unknown;
  try {
    const original = readMarkdownFile(location.path);
    if (original.version !== requested.version) conflict();
    const mode = lstatSync(location.path).mode & 0o777;
    if (!(mode & 0o222)) throw new Error("Lesson file is read-only");
    descriptor = openSync(
      temporary,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    temporaryOwned = true;
    writeFileSync(descriptor, requested.markdown, "utf8");
    fchmodSync(descriptor, mode);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    // Revalidate the manifest, every path and the current bytes immediately before
    // rename. An uncooperative external writer can still race this final window.
    const current = lessonLocation(id, slug, root);
    if (
      current.path !== location.path ||
      readMarkdownFile(current.path).version !== original.version
    )
      conflict();
    renameSync(temporary, current.path);
    temporaryOwned = false;
    result = {
      markdown: requested.markdown,
      version: markdownVersion(requested.markdown),
    };
  } catch (error) {
    failure = error;
  }
  const cleanupErrors: unknown[] = [];
  const cleanup = [
    ...(descriptor !== undefined ? [() => closeSync(descriptor)] : []),
    ...(temporaryOwned ? [() => unlinkSync(temporary)] : []),
    () => closeSync(lock),
    () => unlinkSync(lockPath),
  ];
  for (const operation of cleanup) {
    try {
      operation();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (
    cleanupErrors.length ||
    (failure && !(failure instanceof HttpException))
  ) {
    logger.error(
      "Lesson save or cleanup failed",
      new AggregateError([failure, ...cleanupErrors].filter(Boolean)).stack,
    );
    throw new InternalServerErrorException(
      "Não foi possível confirmar o salvamento. Preserve seu texto e releia o arquivo antes de tentar novamente.",
    );
  }
  if (failure) throw failure;
  if (!result)
    throw new InternalServerErrorException("Salvamento sem confirmação.");
  return result;
}
