import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { LessonIndex } from "./LessonIndex";
import { lessonPath, type Lesson } from "./api";

export function LessonNavigation({ lesson }: { lesson: Lesson }) {
  const position =
    lesson.course.lessons.findIndex((entry) => entry.slug === lesson.slug) + 1;
  const total = lesson.course.lessons.length;
  return (
    <div className="lesson-navigation-bar">
      <nav className="workspace-navigation" aria-label="Navegação entre lições">
        <LessonIndex course={lesson.course} slug={lesson.slug} />
        <div className="lesson-nav-neighbors">
          <span
            className="lesson-nav-position"
            aria-label={`Lição ${position} de ${total}`}
          >
            {String(position).padStart(2, "0")}/{String(total).padStart(2, "0")}
          </span>
          {(
            [
              [-1, lesson.previous],
              [1, lesson.next],
            ] as const
          ).map(([direction, neighbor]) => {
            const label = direction < 0 ? "Lição anterior" : "Próxima lição";
            const icon =
              direction < 0 ? (
                <ArrowLeft size={18} aria-hidden="true" />
              ) : (
                <ArrowRight size={18} aria-hidden="true" />
              );
            return neighbor ? (
              <Link
                key={direction}
                aria-label={label}
                title={neighbor.title}
                to={lessonPath(lesson.course.id, neighbor.slug)}
              >
                {icon}
              </Link>
            ) : (
              <button
                key={direction}
                type="button"
                disabled
                aria-label={label}
                title={label}
              >
                {icon}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
