import { apiFetch } from "../auth/session";
export interface Preferences {
  siteTheme: "bunkercode" | "light";
  readingTone: number | null;
  readingSize: number;
}
export interface LearningSummary {
  courses: {
    courseId: string;
    total: number;
    lessons: string[];
    completed: string[];
  }[];
  resume: { course: string; slug: string } | null;
}
export interface ApprovedSolution {
  source: string;
  revision: string;
  approvedAt: string;
}
export function parsePreferences(value: unknown): Preferences {
  if (!value || typeof value !== "object")
    throw new Error("Preferências incompatíveis.");
  const p = value as Preferences;
  if (
    (p.siteTheme !== "bunkercode" && p.siteTheme !== "light") ||
    (p.readingTone !== null &&
      (!Number.isInteger(p.readingTone) ||
        p.readingTone < 0 ||
        p.readingTone > 5)) ||
    !Number.isInteger(p.readingSize) ||
    p.readingSize < 16 ||
    p.readingSize > 21
  )
    throw new Error("Preferências incompatíveis.");
  return {
    siteTheme: p.siteTheme,
    readingTone: p.readingTone,
    readingSize: p.readingSize,
  };
}
export async function learningRequest(
  path: string,
  signal: AbortSignal,
  method = "GET",
  body?: unknown,
): Promise<unknown> {
  const response = await apiFetch("/api/learning" + path, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
    method,
    keepalive: method === "PUT" && path === "/preferences",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok)
    throw new Error(
      "Não foi possível sincronizar com sua conta. Tente novamente.",
    );
  return response.json() as Promise<unknown>;
}
export const learningLessonPath = (course: string, lesson: string) =>
  "/courses/" +
  encodeURIComponent(course) +
  "/lessons/" +
  encodeURIComponent(lesson);
export function parseSummary(value: unknown): LearningSummary {
  if (!value || typeof value !== "object")
    throw new Error("Progresso incompatível.");
  const s = value as LearningSummary;
  if (
    !Array.isArray(s.courses) ||
    s.courses.some(
      (c) =>
        !c ||
        typeof c.courseId !== "string" ||
        !Number.isSafeInteger(c.total) ||
        c.total < 0 ||
        !Array.isArray(c.lessons) ||
        c.lessons.some((l) => typeof l !== "string") ||
        !Array.isArray(c.completed) ||
        c.completed.some((l) => typeof l !== "string") ||
        c.completed.length > c.total,
    ) ||
    (s.resume !== null &&
      (!s.resume ||
        typeof s.resume.course !== "string" ||
        typeof s.resume.slug !== "string"))
  )
    throw new Error("Progresso incompatível.");
  return s;
}
