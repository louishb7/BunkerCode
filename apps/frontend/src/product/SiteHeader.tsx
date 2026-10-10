import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Link, NavLink } from "react-router";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { LessonIndex } from "../courses/LessonIndex";
import { lessonPath, type Lesson } from "../courses/api";
import { Insignia } from "./Brand";

const LessonNavigation = createContext<{
  lesson: Lesson | null;
  setLesson: (lesson: Lesson | null) => void;
}>({ lesson: null, setLesson: () => undefined });

export function LessonNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  return (
    <LessonNavigation.Provider value={{ lesson, setLesson }}>
      {children}
    </LessonNavigation.Provider>
  );
}

export function useLessonNavigation(lesson: Lesson) {
  const { setLesson } = useContext(LessonNavigation);
  useEffect(() => {
    setLesson(lesson);
    return () => setLesson(null);
  }, [lesson, setLesson]);
}
export function SiteHeader() {
  const { lesson } = useContext(LessonNavigation);
  return (
    <header className="site-header border-b border-line bg-bunker">
      <div className="site-header-content mx-auto flex min-h-16 max-w-[1720px] items-center gap-5 px-4 sm:gap-8 sm:px-8">
        <Link
          to="/"
          aria-label="BunkerCode — Início"
          className="flex min-h-11 min-w-11 shrink-0 items-center gap-1.5 text-base font-semibold tracking-tight text-ink no-underline sm:gap-2 sm:text-xl"
        >
          <Insignia />
          <span className="brand-wordmark">
            Bunker<span className="text-gold">Code</span>
          </span>
        </Link>
        {lesson ? (
          <nav
            className="header-lesson-nav"
            aria-label="Navegação entre lições"
          >
            <Link
              aria-label={`Abrir curso ${lesson.course.title}`}
              className="header-course"
              to={"/courses/" + encodeURIComponent(lesson.course.id)}
              title={lesson.course.title}
            >
              <BookOpen size={18} aria-hidden="true" />
              <span>{lesson.course.title}</span>
            </Link>
            <LessonIndex course={lesson.course} />
            <div className="header-neighbors">
              {lesson.previous ? (
                <Link
                  aria-label="Lição anterior"
                  title={lesson.previous.title}
                  to={lessonPath(lesson.course.id, lesson.previous.slug)}
                >
                  <ArrowLeft size={18} aria-hidden="true" />
                  <span>Anterior</span>
                </Link>
              ) : (
                <span className="disabled-neighbor" aria-hidden="true">
                  <ArrowLeft size={18} />
                </span>
              )}
              {lesson.next ? (
                <Link
                  aria-label="Próxima lição"
                  title={lesson.next.title}
                  to={lessonPath(lesson.course.id, lesson.next.slug)}
                >
                  <span>Próxima</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              ) : (
                <span className="disabled-neighbor" aria-hidden="true">
                  <ArrowRight size={18} />
                </span>
              )}
            </div>
          </nav>
        ) : (
          <nav
            aria-label="Navegação principal"
            className="flex h-full items-center gap-4 text-sm sm:gap-6"
          >
            <NavLink
              to="/"
              end
              className="flex h-full items-center border-b-2 border-transparent text-subtle no-underline aria-[current=page]:border-gold aria-[current=page]:text-ink"
            >
              Início
            </NavLink>
            <NavLink
              to="/courses"
              className="flex h-full items-center border-b-2 border-transparent text-subtle no-underline aria-[current=page]:border-gold aria-[current=page]:text-ink"
            >
              Cursos
            </NavLink>
          </nav>
        )}
      </div>
    </header>
  );
}
