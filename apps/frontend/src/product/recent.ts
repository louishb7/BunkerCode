import { isContentSlug } from "../courses/api";
const key = "bunkercode:last-lesson:v1";
export interface RecentLesson {
  course: string;
  slug: string;
}
export function recentLesson(): RecentLesson | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      !value ||
      typeof value !== "object" ||
      !("course" in value) ||
      !("slug" in value) ||
      !isContentSlug(value.course) ||
      !isContentSlug(value.slug)
    )
      return null;
    return { course: value.course, slug: value.slug };
  } catch {
    return null;
  } // Optional convenience; never a draft or completion record.
}
export function rememberLesson(course: string, slug: string) {
  try {
    localStorage.setItem(key, JSON.stringify({ course, slug }));
  } catch {
    /* Reading remains available when optional history storage is denied. */
  }
}
