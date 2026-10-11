import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { Link } from "react-router";
import { LessonIndex } from "./LessonIndex";
import { lessonPath, type Lesson } from "./api";

export function LessonNavigation({ lesson }: { lesson: Lesson }) {
  return (
    <footer className="learning-footer">
      <nav className="workspace-navigation" aria-label="Navegação entre lições">
        <Link
          className="footer-course"
          aria-label={`Abrir curso ${lesson.course.title}`}
          to={"/courses/" + encodeURIComponent(lesson.course.id)}
          title={lesson.course.title}
        >
          <BookOpen size={16} aria-hidden="true" />
          <span>{lesson.course.title}</span>
        </Link>
        <span className="footer-lesson" title={lesson.title}>
          {lesson.title}
        </span>
        <LessonIndex course={lesson.course} />
        <div className="footer-neighbors">
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
