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
export function useContent<T>(path: string, parse?: (value: unknown) => T) {
  const [state, setState] = useState<{ data: T | null; error: string }>({
    data: null,
    error: "",
  });
  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, error: "" });
    void (async () => {
      const response = await fetch("/api/content/courses" + path, {
        signal: controller.signal,
        cache: "no-store",
      });
      const value: unknown = await response.json();
      if (!response.ok) {
        const message =
          value &&
          typeof value === "object" &&
          "message" in value &&
          typeof value.message === "string"
            ? value.message
            : "Não foi possível carregar o conteúdo.";
        throw new Error(message);
      }
      if (!controller.signal.aborted)
        setState({ data: parse ? parse(value) : (value as T), error: "" });
    })().catch((error: unknown) => {
      if (!controller.signal.aborted)
        setState({
          data: null,
          error:
            error instanceof Error ? error.message : "Conteúdo indisponível.",
        });
    });
    return () => controller.abort();
  }, [path, parse]);
  return state;
}
export const lessonPath = (course: string, slug: string) =>
  "/courses/" +
  encodeURIComponent(course) +
  "/lessons/" +
  encodeURIComponent(slug);
