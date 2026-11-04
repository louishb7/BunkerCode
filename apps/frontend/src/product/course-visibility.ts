import { capabilities } from "../capabilities";
import type { CourseSummary } from "../courses/api";

// Editorial discovery only; direct routes and the content API remain available.
const visibleCourseIds = [
  "fundamentos-programacao-javascript",
  "typescript",
  "nodejs",
  "nestjs",
];

export function discoverableCourses(
  courses: readonly CourseSummary[],
  editorial = true,
) {
  if (!capabilities.authoring || !editorial) return [...courses];
  return visibleCourseIds.flatMap((id) => {
    const course = courses.find((item) => item.id === id);
    return course ? [course] : [];
  });
}
