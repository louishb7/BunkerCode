import fs from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import {
  parseCourse,
  parseNewLesson,
  validSlug,
  type Course,
  type LessonEntry,
} from "./course";

export class LessonCreationError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
function fail(status: number, message: string): never {
  throw new LessonCreationError(status, message);
}
function directory(path: string) {
  const stat = fs.lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    fail(422, "Pasta inválida ou symlink inesperado.");
  return stat;
}
function manifestFile(path: string) {
  const stat = fs.lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536)
    fail(422, "Manifesto inválido ou maior que 64 KiB.");
  return fs.readFileSync(path, "utf8");
}
function writeExclusive(
  path: string,
  text: string,
  owned: (stat: fs.Stats) => void,
) {
  const descriptor = fs.openSync(
    path,
    fs.constants.O_WRONLY |
      fs.constants.O_CREAT |
      fs.constants.O_EXCL |
      fs.constants.O_NOFOLLOW,
    0o600,
  );
  try {
    owned(fs.fstatSync(descriptor));
    fs.writeFileSync(descriptor, text, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

// Node-only entry point shared by CLI and HTTP. Readers see the entry only after
// the Markdown exists. A retained journal/lock requires inspection, never expiry.
export function createLesson(
  course: string,
  value: unknown,
  root: string,
): string {
  if (!validSlug(course)) fail(400, "ID de curso inválido.");
  let entry: LessonEntry;
  try {
    entry = parseNewLesson(value);
  } catch (error) {
    fail(400, error instanceof Error ? error.message : "Dados inválidos.");
  }
  root = resolve(root);
  const courseDirectory = join(root, course);
  try {
    if (fs.realpathSync(root) !== root)
      fail(422, "Symlink na raiz autorizada.");
    directory(root);
    directory(courseDirectory);
  } catch (error) {
    if (error instanceof LessonCreationError) throw error;
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      fail(404, "Curso não encontrado.");
    fail(422, "Pasta de curso indisponível.");
  }
  const lockPath = join(courseDirectory, ".lesson-new.lock");
  const temporary = join(courseDirectory, `.course-${randomUUID()}.tmp`);
  const lessons = join(courseDirectory, "lessons");
  const target = join(lessons, entry.slug);
  const file = join(target, "lesson.md");
  const manifestPath = join(courseDirectory, "course.json");
  let lock: number;
  try {
    lock = fs.openSync(lockPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      fail(
        409,
        "Outra criação está em andamento ou foi interrompida. Confira .lesson-new.lock no curso; nenhum lock é removido automaticamente.",
      );
    fail(500, "Não foi possível iniciar a criação da lição.");
  }
  let ownedDirectory: fs.Stats | undefined;
  let ownedFile: fs.Stats | undefined;
  let temporaryOwned = false;
  let published = false;
  let failure: unknown;
  let preserveJournal = false;
  const markdown = "";
  try {
    // Flushed intent precedes any content mutation; identifies the exact files
    // to inspect if killed between mkdir, file creation and manifest publication.
    fs.writeFileSync(
      lock,
      JSON.stringify({
        version: 1,
        pid: process.pid,
        slug: entry.slug,
        title: entry.title,
        temporary,
        file,
        startedAt: new Date().toISOString(),
      }) + "\n",
    );
    fs.fsyncSync(lock);
    const original = manifestFile(manifestPath);
    let manifest: Course;
    try {
      manifest = parseCourse(JSON.parse(original), course);
    } catch (error) {
      fail(422, error instanceof Error ? error.message : "Manifesto inválido.");
    }
    if (manifest.lessons.some((lesson) => lesson.slug === entry.slug))
      fail(
        409,
        "Slug já existe no manifesto; nenhum conteúdo foi sobrescrito.",
      );
    manifest.lessons.push(entry);
    const serialized = JSON.stringify(manifest, null, 2) + "\n";
    if (Buffer.byteLength(serialized) > 65536)
      fail(422, "O manifesto excederia 64 KiB.");
    try {
      directory(lessons);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      fs.mkdirSync(lessons);
    }
    try {
      fs.mkdirSync(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST")
        fail(
          409,
          "Já existe uma pasta com esse slug. Seu conteúdo foi preservado.",
        );
      throw error;
    }
    ownedDirectory = fs.lstatSync(target);
    // A minimal empty document avoids interpreting the title as Markdown syntax.
    writeExclusive(file, markdown, (stat) => {
      ownedFile = stat;
    });
    writeExclusive(temporary, serialized, () => {
      temporaryOwned = true;
    });
    // External editors do not participate in our lock. Detect their changes
    // immediately before publication, with the same residual race as saving.
    if (fs.realpathSync(root) !== root)
      fail(409, "Raiz alterada durante a criação.");
    directory(courseDirectory);
    directory(lessons);
    if (
      directory(target).ino !== ownedDirectory.ino ||
      fs.lstatSync(file).isSymbolicLink() ||
      fs.lstatSync(file).ino !== ownedFile?.ino ||
      fs.readFileSync(file, "utf8") !== markdown ||
      manifestFile(manifestPath) !== original
    )
      fail(
        409,
        "Os arquivos mudaram durante a criação. Confira o curso antes de tentar novamente.",
      );
    fs.renameSync(temporary, manifestPath);
    published = true;
  } catch (error) {
    failure = error;
  }
  const cleanupErrors: unknown[] = [];
  if (!published && ownedDirectory) {
    try {
      // A publication with an uncertain outcome, or an external manifest edit,
      // must never turn a listed lesson into a dangling reference during rollback.
      const current = parseCourse(
        JSON.parse(manifestFile(manifestPath)),
        course,
      );
      if (current.lessons.some((lesson) => lesson.slug === entry.slug))
        throw new Error(
          "Lição referenciada no manifesto; preserve para revisão.",
        );
      // Never remove a replacement, additional author files or edited bytes.
      if (directory(target).ino !== ownedDirectory.ino)
        throw new Error("Pasta alterada externamente.");
      if (ownedFile && fs.existsSync(file)) {
        const stat = fs.lstatSync(file);
        if (
          stat.isSymbolicLink() ||
          stat.ino !== ownedFile.ino ||
          fs.readFileSync(file, "utf8") !== markdown
        )
          throw new Error(
            "Conteúdo alterado externamente; preservado para recuperação.",
          );
        fs.unlinkSync(file);
      }
      fs.rmdirSync(target); // Refuses directories containing other files.
    } catch (error) {
      cleanupErrors.push(error);
      preserveJournal = true;
    }
  }
  for (const cleanup of [
    () => {
      if (temporaryOwned && fs.existsSync(temporary)) fs.unlinkSync(temporary);
    },
    () => fs.closeSync(lock),
    () => {
      if (!preserveJournal) fs.unlinkSync(lockPath);
    },
  ]) {
    try {
      cleanup();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (cleanupErrors.length)
    fail(
      500,
      "Criação sem confirmação completa. Preserve os arquivos e inspecione .lesson-new.lock e course.json antes de repetir.",
    );
  if (failure instanceof LessonCreationError) throw failure;
  if (failure)
    fail(
      500,
      "Não foi possível criar a lição. O manifesto não foi publicado; tente novamente após conferir o curso.",
    );
  if (!published) fail(500, "Criação sem confirmação.");
  return file;
}
