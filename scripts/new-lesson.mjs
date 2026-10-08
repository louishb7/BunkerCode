import {
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  rmdirSync,
  openSync,
  closeSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validSlug = (value) =>
  typeof value === "string" && value.length <= 80 && slugPattern.test(value);
function directory(path) {
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error("Pasta inválida ou symlink inesperado.");
}
function removeIfPresent(path) {
  try {
    unlinkSync(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
export function createLesson({
  course,
  slug,
  title,
  contentRoot = process.env.BUNKERCODE_CONTENT_DIR ??
    fileURLToPath(new URL("../content", import.meta.url)),
}) {
  if (!validSlug(course) || !validSlug(slug))
    throw new Error(
      "Course e slug devem usar letras minúsculas, números e hífens.",
    );
  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.length > 160 ||
    /[\r\n]/.test(title)
  )
    throw new Error("Informe um título de uma linha, com até 160 caracteres.");
  const root = resolve(contentRoot, "courses");
  const courseDirectory = join(root, course);
  directory(root);
  directory(courseDirectory);
  const manifestPath = join(courseDirectory, "course.json");
  const stat = lstatSync(manifestPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536)
    throw new Error("Manifesto ausente, inválido ou muito grande.");
  const lockPath = join(courseDirectory, ".lesson-new.lock");
  const lock = openSync(lockPath, "wx");
  const temporary = join(courseDirectory, ".course-" + randomUUID() + ".tmp");
  let lessonDirectory;
  let committed = false;
  let createdFile;
  let operationError;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (
      manifest.id !== course ||
      typeof manifest.title !== "string" ||
      typeof manifest.description !== "string" ||
      !Array.isArray(manifest.lessons)
    )
      throw new Error("Manifesto de curso inválido.");
    const seen = new Set();
    for (const lesson of manifest.lessons) {
      if (
        !lesson ||
        !validSlug(lesson.slug) ||
        typeof lesson.title !== "string" ||
        seen.has(lesson.slug)
      )
        throw new Error("Lista de lições inválida ou duplicada.");
      seen.add(lesson.slug);
    }
    if (seen.has(slug))
      throw new Error(
        "Slug já existe no manifesto; nenhum arquivo foi alterado.",
      );
    const lessonsDirectory = join(courseDirectory, "lessons");
    try {
      directory(lessonsDirectory);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      mkdirSync(lessonsDirectory);
    }
    const target = join(lessonsDirectory, slug);
    mkdirSync(target); // Exclusive creation refuses even an unlisted existing lesson.
    lessonDirectory = target;
    const file = join(target, "lesson.md");
    writeFileSync(
      file,
      "# " +
        title.trim() +
        "\n\n> Rascunho: escreva sua explicação e seus exemplos. As seções abaixo são sugestões; adapte livremente.\n\n## O que eu entendi\n\n\n## Exemplo\n\n\n## Referências\n\n",
      { flag: "wx" },
    );
    manifest.lessons.push({ slug, title: title.trim() });
    const serialized = JSON.stringify(manifest, null, 2) + "\n";
    if (Buffer.byteLength(serialized) > 65536)
      throw new Error("O manifesto excederia 64 KiB.");
    writeFileSync(temporary, serialized, { flag: "wx" });
    renameSync(temporary, manifestPath);
    committed = true;
    createdFile = file;
  } catch (error) {
    operationError = error;
  }
  const cleanupErrors = [];
  const cleanup = [];
  if (!committed && lessonDirectory)
    cleanup.push(
      () => removeIfPresent(join(lessonDirectory, "lesson.md")),
      () => rmdirSync(lessonDirectory),
    );
  cleanup.push(
    () => removeIfPresent(temporary),
    () => closeSync(lock),
    () => unlinkSync(lockPath),
  );
  for (const operation of cleanup) {
    try {
      operation();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (cleanupErrors.length)
    throw new AggregateError(
      [...(operationError ? [operationError] : []), ...cleanupErrors],
      "Falha de autoria/cleanup: " +
        [operationError, ...cleanupErrors]
          .filter(Boolean)
          .map((error) => error.message)
          .join("; "),
    );
  if (operationError) throw operationError;
  return createdFile;
}
function argumentsOf(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index]?.replace(/^--/, "");
    if (
      !["course", "slug", "title"].includes(key) ||
      key in options ||
      values[index + 1] === undefined
    )
      throw new Error(
        'Uso: pnpm lesson:new --course typescript --slug topic --title "Título"',
      );
    options[key] = values[index + 1];
  }
  return options;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    console.log(
      "Lição criada: " + createLesson(argumentsOf(process.argv.slice(2))),
    );
    console.log(
      "Edite o Markdown, recarregue o site e revise seu diff antes do commit.",
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
