import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, BookOpen } from "lucide-react";
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
      <div className="course-card-heading">
        <CourseArtwork id={course.id} />
        <h3 id={`course-${course.id}-title`}>{course.title}</h3>
        <ArrowRight
          className="course-card-arrow"
          size={17}
          aria-hidden="true"
        />
      </div>
      <p id={`course-${course.id}-description`} className="course-description">
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
    </Link>
  );
}
