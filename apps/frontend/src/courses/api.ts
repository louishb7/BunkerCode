import { useEffect, useState } from "react";
export interface LessonEntry {
  slug: string;
  title: string;
  moduleId?: string;
}
export interface CourseModule {
  id: string;
  title: string;
  description?: string;
  number?: number;
}
export interface Course {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  lessons: LessonEntry[];
  modules?: CourseModule[];
}
export interface CourseSummary {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  lessonCount: number;
}
export interface Lesson extends LessonEntry {
  course: Course;
  markdown: string;
  version: string;
  previous: LessonEntry | null;
  next: LessonEntry | null;
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function only(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}
export function isContentSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 80 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}
function text(value: unknown, limit: number): value is string {
  return typeof value === "string" && !!value.trim() && value.length <= limit;
}
export const isContentTitle = (value: unknown): value is string =>
  text(value, 160);
function entry(
  value: unknown,
  modular: boolean,
  extra: string[] = [],
): value is LessonEntry {
  if (
    !object(value) ||
    !only(
      value,
      modular
        ? ["slug", "title", "moduleId", ...extra]
        : ["slug", "title", ...extra],
    ) ||
    !isContentSlug(value.slug) ||
    !isContentTitle(value.title)
  )
    return false;
  if (value.moduleId === undefined) return !modular;
  return modular && isContentSlug(value.moduleId);
}
function moduleEntry(value: unknown): value is CourseModule {
  return (
    object(value) &&
    only(value, ["id", "title", "description", "number"]) &&
    isContentSlug(value.id) &&
    isContentTitle(value.title) &&
    (value.description === undefined || text(value.description, 400)) &&
    (value.number === undefined ||
      (typeof value.number === "number" &&
        Number.isInteger(value.number) &&
        value.number >= 0 &&
        value.number <= 999))
  );
}
function uniqueLessons(value: LessonEntry[]) {
  return new Set(value.map((lesson) => lesson.slug)).size === value.length;
}
function course(value: unknown): value is Course {
  if (
    !object(value) ||
    !only(value, [
      "id",
      "title",
      "description",
      "shortDescription",
      "lessons",
      "modules",
    ]) ||
    !isContentSlug(value.id) ||
    !isContentTitle(value.title) ||
    !text(value.description, 800) ||
    !(
      value.shortDescription === undefined || text(value.shortDescription, 160)
    ) ||
    !Array.isArray(value.lessons)
  )
    return false;
  if (value.modules === undefined)
    return (
      value.lessons.every((lesson) => entry(lesson, false)) &&
      uniqueLessons(value.lessons)
    );
  if (
    !Array.isArray(value.modules) ||
    value.modules.length === 0 ||
    !value.modules.every(moduleEntry) ||
    !value.lessons.every((lesson) => entry(lesson, true)) ||
    !uniqueLessons(value.lessons)
  )
    return false;
  const lessons = value.lessons as LessonEntry[];
  const modules = value.modules as CourseModule[];
  const moduleIds = new Set(modules.map((module) => module.id));
  if (moduleIds.size !== modules.length) return false;
  if (value.lessons.length === 0) return modules.length === 1;
  const used = new Set<string>();
  const sequence: string[] = [];
  for (const lesson of lessons) {
    const moduleId = lesson.moduleId!;
    if (!moduleIds.has(moduleId)) return false;
    used.add(moduleId);
    if (sequence.at(-1) === moduleId) continue;
    if (sequence.includes(moduleId)) return false;
    sequence.push(moduleId);
  }
  return (
    used.size === moduleIds.size &&
    sequence.length === modules.length &&
    sequence.every((id, index) => id === modules[index]!.id)
  );
}
function summary(value: unknown): value is CourseSummary {
  return (
    object(value) &&
    isContentSlug(value.id) &&
    isContentTitle(value.title) &&
    text(value.description, 800) &&
    (value.shortDescription === undefined ||
      text(value.shortDescription, 160)) &&
    typeof value.lessonCount === "number" &&
    Number.isInteger(value.lessonCount) &&
    value.lessonCount >= 0
  );
}
export const incompatibleContent =
  "O servidor retornou uma resposta de conteúdo incompatível. Tente novamente.";
export function parseCourses(value: unknown): CourseSummary[] {
  if (
    !Array.isArray(value) ||
    !value.every(summary) ||
    new Set(value.map((item: CourseSummary) => item.id)).size !== value.length
  )
    throw new Error(incompatibleContent);
  return value;
}
export function parseCourse(value: unknown): Course {
  if (!course(value)) throw new Error(incompatibleContent);
  return value;
}
export function parseLesson(value: unknown): Lesson {
  if (
    !object(value) ||
    !course(value.course) ||
    !entry(value, value.course.modules !== undefined, [
      "course",
      "markdown",
      "version",
      "previous",
      "next",
    ]) ||
    typeof value.markdown !== "string" ||
    typeof value.version !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.version) ||
    !(
      value.previous === null ||
      entry(value.previous, value.course.modules !== undefined)
    ) ||
    !(
      value.next === null ||
      entry(value.next, value.course.modules !== undefined)
    )
  )
    throw new Error(incompatibleContent);
  const index = value.course.lessons.findIndex(
    (lesson) => lesson.slug === value.slug,
  );
  const matches = (
    actual: LessonEntry | null,
    expected: LessonEntry | undefined,
  ) =>
    expected
      ? actual?.slug === expected.slug &&
        actual.title === expected.title &&
        actual.moduleId === expected.moduleId
      : actual === null;
  if (
    index < 0 ||
    !matches(value, value.course.lessons[index]) ||
    !matches(value.previous, value.course.lessons[index - 1]) ||
    !matches(value.next, value.course.lessons[index + 1])
  )
    throw new Error(incompatibleContent);
  return {
    slug: value.slug,
    title: value.title,
    ...(value.moduleId === undefined ? {} : { moduleId: value.moduleId }),
    course: value.course,
    markdown: value.markdown,
    version: value.version,
    previous: value.previous,
    next: value.next,
  };
}
async function contentResponse(
  path: string,
  signal: AbortSignal,
): Promise<unknown> {
  let response: Response, text: string;
  try {
    response = await fetch("/api/content/courses" + path, {
      signal,
      cache: "no-store",
    });
    text = await response.text();
  } catch {
    throw new Error(
      "Não foi possível conectar ao servidor de conteúdo. Confira se ele está disponível e tente novamente.",
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    if (response.ok) throw new Error(incompatibleContent);
  }
  if (!response.ok)
    throw new Error(
      object(value) && typeof value.message === "string" && value.message.trim()
        ? value.message
        : `Não foi possível carregar o conteúdo (HTTP ${response.status}). Tente novamente.`,
    );
  return value;
}
export function useContent<T>(path: string, parse: (value: unknown) => T) {
  const [state, setState] = useState<{
    path: string;
    data: T | null;
    error: string;
  }>({ path, data: null, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    setState({ path, data: null, error: "" });
    void contentResponse(path, controller.signal)
      .then((value) => {
        const data = parse(value);
        if (!controller.signal.aborted) setState({ path, data, error: "" });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            path,
            data: null,
            error: error instanceof Error ? error.message : incompatibleContent,
          });
      });
    return () => controller.abort();
  }, [path, parse]);
  return state.path === path ? state : { data: null, error: "" };
}
export interface CourseSection {
  module: CourseModule | null;
  lessons: { lesson: LessonEntry; index: number }[];
}
export function courseSections(course: Course): CourseSection[] {
  const entries = course.lessons.map((lesson, index) => ({ lesson, index }));
  if (!course.modules) return [{ module: null, lessons: entries }];
  return course.modules.map((module) => ({
    module,
    lessons: entries.filter(({ lesson }) => lesson.moduleId === module.id),
  }));
}
export const lessonPath = (course: string, slug: string) =>
  "/courses/" +
  encodeURIComponent(course) +
  "/lessons/" +
  encodeURIComponent(slug);
