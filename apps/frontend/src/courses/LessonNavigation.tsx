import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { LessonIndex } from "./LessonIndex";
import { lessonPath, type Lesson } from "./api";

export function LessonNavigation({ lesson }: { lesson: Lesson }) {
  return (
    <nav className="workspace-navigation" aria-label="Navegação entre lições">
      <LessonIndex course={lesson.course} />
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
    </nav>
  );
}
