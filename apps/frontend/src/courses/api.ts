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
function entry(value: unknown): value is LessonEntry {
  return (
    object(value) &&
    typeof value.slug === "string" &&
    typeof value.title === "string"
  );
}
function course(value: unknown): value is Course {
  return (
    object(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    Array.isArray(value.lessons) &&
    value.lessons.every(entry)
  );
}
const incompatible =
  "O servidor retornou uma resposta de conteúdo incompatível. Tente novamente.";
export function parseCourses(value: unknown): CourseSummary[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (item: unknown) =>
        object(item) &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.description === "string" &&
        typeof item.lessonCount === "number" &&
        Number.isInteger(item.lessonCount) &&
        item.lessonCount >= 0,
    )
  )
    throw new Error(incompatible);
  return value as CourseSummary[];
}
export function parseCourse(value: unknown): Course {
  if (!course(value)) throw new Error(incompatible);
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
    throw new Error(incompatible);
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
    if (response.ok) throw new Error(incompatible);
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
            error: error instanceof Error ? error.message : incompatible,
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
