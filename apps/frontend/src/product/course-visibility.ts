import type { CourseSummary } from "../courses/api";

// Editorial discovery only; direct routes and the content API remain available.
const visibleCourseIds = ["javascript", "typescript", "nodejs", "nestjs"];

export function discoverableCourses(courses: readonly CourseSummary[]) {
  return visibleCourseIds.flatMap((id) => {
    const course = courses.find((item) => item.id === id);
    return course ? [course] : [];
  });
}
