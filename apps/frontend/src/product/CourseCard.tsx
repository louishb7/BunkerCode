import { Link } from "react-router";
import { BookOpen } from "lucide-react";
import type { CourseSummary } from "../courses/api";
import { CourseArtwork } from "./CourseArtwork";
export function CourseCard({ course }: { course: CourseSummary }) {
  return (
    <Link
      className="course-card group flex min-w-0 flex-col rounded-xl border border-line bg-surface p-5 text-ink no-underline transition-colors hover:border-gold/60"
      to={"/courses/" + encodeURIComponent(course.id)}
    >
      <div className="mb-5 flex items-center gap-4">
        <CourseArtwork id={course.id} />
        <h3 className="m-0 text-xl font-semibold tracking-tight">
          {course.title}
        </h3>
      </div>
      <p className="mt-0 mb-5 flex-1 text-sm leading-relaxed text-subtle">
        {course.description}
      </p>
      <div className="course-card-footer flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs">
        <span className="flex items-center gap-2 text-subtle">
          <BookOpen className="product-icon" aria-hidden="true" />
          {course.lessonCount} {course.lessonCount === 1 ? "lição" : "lições"}
        </span>
        <span className="course-action font-medium text-gold">
          Abrir curso →
        </span>
      </div>
    </Link>
  );
}
