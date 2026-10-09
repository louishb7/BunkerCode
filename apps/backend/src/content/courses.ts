import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";

import { readMarkdownFile } from "./markdown-file";

export interface LessonEntry {
  slug: string;
  title: string;
}
export interface Course {
  id: string;
  title: string;
  description: string;
  lessons: LessonEntry[];
}
export interface CourseSummary {
  id: string;
  title: string;
  description: string;
  lessonCount: number;
}
export interface Lesson extends LessonEntry {
  course: Course;
  markdown: string;
  version: string;
  previous: LessonEntry | null;
  next: LessonEntry | null;
}
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function validSlug(value: unknown): value is string {
  return (
    typeof value === "string" && value.length <= 80 && slugPattern.test(value)
  );
}
export function coursesRoot() {
  return resolve(
    process.env.BUNKERCODE_CONTENT_DIR ??
      resolve(__dirname, "../../../..", "content"),
    "courses",
  );
}
function invalid(message: string): never {
  throw new UnprocessableEntityException(`Conteúdo inválido: ${message}`);
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("o manifesto deve conter objetos.");
  return value as Record<string, unknown>;
}
function text(value: unknown, limit: number, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > limit)
    invalid(`campo ${field} ausente, vazio ou muito longo.`);
  return value;
}
function fields(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    invalid("campo desconhecido no manifesto.");
}
export function parseCourse(value: unknown, id: string): Course {
  const course = object(value);
  fields(course, ["id", "title", "description", "lessons"]);
  if (course.id !== id || !validSlug(course.id))
    invalid("id não corresponde à pasta do curso.");
  if (!Array.isArray(course.lessons))
    invalid("lessons deve ser uma lista ordenada.");
  const seen = new Set<string>();
  const lessons = course.lessons.map((value): LessonEntry => {
    const lesson = object(value);
    fields(lesson, ["slug", "title"]);
    if (!validSlug(lesson.slug)) invalid("slug de lição inválido.");
    if (seen.has(lesson.slug)) invalid(`slug duplicado: ${lesson.slug}.`);
    seen.add(lesson.slug);
    return {
      slug: lesson.slug,
      title: text(lesson.title, 160, "title"),
    };
  });
  return {
    id,
    title: text(course.title, 160, "title"),
    description: text(course.description, 800, "description"),
    lessons,
  };
}
// All paths are derived from validated slugs, never supplied as file paths by clients.
function checkedPath(
  root: string,
  segments: string[],
  directory: boolean,
): string {
  try {
    if (realpathSync(root) !== resolve(root))
      invalid("symlink na raiz autorizada.");
  } catch (error) {
    if (error instanceof UnprocessableEntityException) throw error;
    invalid("raiz de conteúdo indisponível.");
  }
  let path = root;
  for (const [index, segment] of ["", ...segments].entries()) {
    if (segment) path = join(path, segment);
    try {
      const stat = lstatSync(path);
      const needsDirectory = directory || index < segments.length;
      if (
        stat.isSymbolicLink() ||
        (needsDirectory ? !stat.isDirectory() : !stat.isFile())
      )
        invalid("symlink ou tipo de arquivo inesperado.");
    } catch (error) {
      if (error instanceof UnprocessableEntityException) throw error;
      invalid(
        `arquivo/pasta indisponível: ${segments.join("/") || "courses"}.`,
      );
    }
  }
  return path;
}
function read(root: string, segments: string[], limit: number): string {
  const path = checkedPath(root, segments, false);
  if (lstatSync(path).size > limit) invalid(`arquivo excede ${limit} bytes.`);
  try {
    return readFileSync(path, "utf8");
  } catch {
    return invalid(`não foi possível ler ${segments.join("/")}.`);
  }
}
export function loadCourse(id: string, root = coursesRoot()): Course {
  if (!validSlug(id)) throw new BadRequestException("ID de curso inválido.");
  try {
    lstatSync(join(root, id));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new NotFoundException("Curso não encontrado.");
    invalid("pasta de curso indisponível.");
  }
  const raw = read(root, [id, "course.json"], 65536);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    invalid(`${id}/course.json não contém JSON válido.`);
  }
  return parseCourse(value, id);
}
export function listCourses(root = coursesRoot()): CourseSummary[] {
  checkedPath(root, [], true);
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      if (!validSlug(entry.name) || entry.isSymbolicLink())
        invalid("pasta de curso inválida.");
      const { id, title, description, lessons } = loadCourse(entry.name, root);
      return { id, title, description, lessonCount: lessons.length };
    });
}
export function lessonLocation(id: string, slug: string, root = coursesRoot()) {
  if (!validSlug(slug))
    throw new BadRequestException("Slug de lição inválido.");
  const course = loadCourse(id, root);
  const index = course.lessons.findIndex((entry) => entry.slug === slug);
  const lesson = course.lessons[index];
  if (!lesson) throw new NotFoundException("Lição não encontrada.");
  const path = checkedPath(root, [id, "lessons", slug, "lesson.md"], false);
  return { course, lesson, index, path };
}
export function loadLesson(
  id: string,
  slug: string,
  root = coursesRoot(),
): Lesson {
  const { course, lesson, index, path } = lessonLocation(id, slug, root);
  return {
    ...lesson,
    course,
    ...readMarkdownFile(path),
    previous: course.lessons[index - 1] ?? null,
    next: course.lessons[index + 1] ?? null,
  };
}
