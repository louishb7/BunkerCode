import { ArrowLeft, ArrowRight, CornerUpLeft } from "lucide-react";
import { Link } from "react-router";
import { LessonIndex } from "./LessonIndex";
import { lessonPath, type Lesson } from "./api";

export function LessonNavigation({ lesson }: { lesson: Lesson }) {
  const position =
    lesson.course.lessons.findIndex((entry) => entry.slug === lesson.slug) + 1;
  const total = lesson.course.lessons.length;
  return (
    <footer className="learning-footer">
      <nav className="workspace-navigation" aria-label="Navegação entre lições">
        <Link
          className="footer-course"
          aria-label={`Abrir curso ${lesson.course.title}`}
          to={"/courses/" + encodeURIComponent(lesson.course.id)}
          title={lesson.course.title}
        >
          <CornerUpLeft size={16} aria-hidden="true" />
          <span>Curso</span>
        </Link>
        <LessonIndex course={lesson.course} />
        <div className="footer-neighbors">
          <span
            className="footer-position"
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
    </footer>
  );
}
