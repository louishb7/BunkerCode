import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";

import { readMarkdownFile } from "./markdown-file";

import {
  parseCourse as parseCourseManifest,
  validSlug,
  type Course,
} from "@bunkercode/content";
import {
  MAX_MANIFEST_BYTES,
  ManifestReadError,
  readManifestSource,
} from "@bunkercode/content/manifest";
export { validSlug } from "@bunkercode/content";
export type {
  Course,
  CourseModule,
  CourseSummary,
  LessonEntry,
} from "@bunkercode/content";
import type { CourseSummary, LessonEntry } from "@bunkercode/content";
export interface Lesson extends LessonEntry {
  course: Course;
  markdown: string;
  version: string;
  previous: LessonEntry | null;
  next: LessonEntry | null;
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
export function parseCourse(value: unknown, id: string): Course {
  try {
    return parseCourseManifest(value, id);
  } catch (error) {
    throw new UnprocessableEntityException(
      error instanceof Error ? error.message : "Manifesto inválido.",
    );
  }
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
  try {
    return readManifestSource(path, limit).text;
  } catch (error) {
    return invalid(
      error instanceof ManifestReadError
        ? error.message
        : `não foi possível ler ${segments.join("/")}.`,
    );
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
  const raw = read(root, [id, "course.json"], MAX_MANIFEST_BYTES);
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
      const { id, title, description, shortDescription, lessons } = loadCourse(
        entry.name,
        root,
      );
      return {
        id,
        title,
        description,
        ...(shortDescription === undefined ? {} : { shortDescription }),
        lessonCount: lessons.length,
      };
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
