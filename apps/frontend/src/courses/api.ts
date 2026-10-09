import { useEffect, useState } from "react";
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
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
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
function entry(value: unknown): value is LessonEntry {
  return (
    object(value) && isContentSlug(value.slug) && isContentTitle(value.title)
  );
}
function course(value: unknown): value is Course {
  return (
    object(value) &&
    isContentSlug(value.id) &&
    isContentTitle(value.title) &&
    text(value.description, 800) &&
    Array.isArray(value.lessons) &&
    value.lessons.every(entry) &&
    new Set(value.lessons.map((lesson: LessonEntry) => lesson.slug)).size ===
      value.lessons.length
  );
}
function summary(value: unknown): value is CourseSummary {
  return (
    object(value) &&
    isContentSlug(value.id) &&
    isContentTitle(value.title) &&
    text(value.description, 800) &&
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
    !entry(value) ||
    !object(value) ||
    !course(value.course) ||
    typeof value.markdown !== "string" ||
    typeof value.version !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.version) ||
    !(value.previous === null || entry(value.previous)) ||
    !(value.next === null || entry(value.next))
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
      ? actual?.slug === expected.slug && actual.title === expected.title
      : actual === null;
  if (
    index < 0 ||
    value.course.lessons[index]?.title !== value.title ||
    !matches(value.previous, value.course.lessons[index - 1]) ||
    !matches(value.next, value.course.lessons[index + 1])
  )
    throw new Error(incompatibleContent);
  return {
    slug: value.slug,
    title: value.title,
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
export const lessonPath = (course: string, slug: string) =>
  "/courses/" +
  encodeURIComponent(course) +
  "/lessons/" +
  encodeURIComponent(slug);
