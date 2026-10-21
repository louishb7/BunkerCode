import { useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, BookOpen } from "lucide-react";
import type { CourseSummary } from "../courses/api";
import { CourseArtwork } from "./CourseArtwork";
import { recentLesson } from "./recent";

export function CourseCard({ course }: { course: CourseSummary }) {
  const [recent] = useState(recentLesson);
  const lastVisited = recent?.course === course.id;
  return (
    <Link
      className="course-card"
      data-course={course.id}
      to={"/courses/" + encodeURIComponent(course.id)}
      aria-labelledby={`course-${course.id}-title`}
      aria-describedby={`course-${course.id}-description course-${course.id}-details`}
    >
      <div className="course-card-art">
        <CourseArtwork id={course.id} />
      </div>
      <div className="course-card-body">
        <h3 id={`course-${course.id}-title`}>{course.title}</h3>
        <p
          id={`course-${course.id}-description`}
          className="course-description"
        >
          {course.description}
        </p>
        <div id={`course-${course.id}-details`} className="course-card-details">
          <span>
            <BookOpen size={14} aria-hidden="true" />
            {course.lessonCount} {course.lessonCount === 1 ? "lição" : "lições"}
          </span>
          {lastVisited && (
            <span
              className="course-last-visit"
              title="Último curso acessado neste navegador"
            >
              Último acesso
            </span>
          )}
        </div>
        <div className="course-card-footer">
          <span className="course-action">Abrir curso →</span>
          <ArrowUpRight size={17} aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
}
