import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Link, NavLink } from "react-router";
import { BookOpen } from "lucide-react";
type HeaderLesson = { course: { id: string; title: string } };
import { Insignia } from "./Brand";

const LessonNavigation = createContext<{
  lesson: HeaderLesson | null;
  setLesson: (lesson: HeaderLesson | null) => void;
}>({ lesson: null, setLesson: () => undefined });

export function LessonNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [lesson, setLesson] = useState<HeaderLesson | null>(null);
  return (
    <LessonNavigation.Provider value={{ lesson, setLesson }}>
      {children}
    </LessonNavigation.Provider>
  );
}

export function useLessonNavigation(lesson: HeaderLesson) {
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
        <nav
          className={
            lesson
              ? "header-lesson-nav"
              : "flex h-full items-center gap-4 text-sm sm:gap-6"
          }
          aria-label="Navegação principal"
        >
          {lesson ? (
            <>
              <Link
                aria-label={`Abrir curso ${lesson.course.title}`}
                className="header-course"
                to={"/courses/" + encodeURIComponent(lesson.course.id)}
                title={lesson.course.title}
              >
                <BookOpen size={18} aria-hidden="true" />
                <span>{lesson.course.title}</span>
              </Link>
              <Link to="/" className="header-home">
                Início
              </Link>
            </>
          ) : (
            <>
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
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
