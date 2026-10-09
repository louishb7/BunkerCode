import { Link } from "react-router";
import { BookOpen } from "lucide-react";
import type { CourseSummary } from "../courses/api";
import { CourseArtwork } from "./CourseArtwork";
export function CourseCard({
  course,
  featured = false,
  compact = false,
}: {
  course: CourseSummary;
  featured?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      className={`course-card group grid min-w-0 gap-5 rounded-2xl border border-line bg-surface p-5 text-ink no-underline transition-colors hover:border-gold/60 ${compact ? "home-course-card grid-cols-[90px_minmax(0,1fr)] items-center sm:grid-cols-[140px_minmax(0,1fr)]" : ""} ${featured ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] md:items-center md:gap-8 md:p-7" : ""}`}
      to={"/courses/" + encodeURIComponent(course.id)}
    >
      <div className="order-2 md:order-2">
        <h3 className="m-0 text-2xl font-semibold tracking-tight">
          {course.title}
        </h3>
        {!compact && (
          <p className="mt-3 mb-6 text-sm leading-relaxed text-subtle">
            {course.description}
          </p>
        )}
        <div
          className={`course-card-footer ${compact ? "mt-4" : ""} flex flex-wrap items-center justify-between gap-4 text-sm`}
        >
          <span className="flex items-center gap-2 text-subtle">
            <BookOpen className="product-icon" aria-hidden="true" />
            {course.lessonCount} {course.lessonCount === 1 ? "lição" : "lições"}
          </span>
          <span className="course-action flex items-center gap-2 font-medium text-gold">
            Abrir curso <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
      <div className="order-1 md:order-1">
        <CourseArtwork id={course.id} />
      </div>
    </Link>
  );
}
