import { Link, useParams } from "react-router";
import { ArrowRight, BookOpen } from "lucide-react";
import {
  lessonPath,
  useContent,
  parseCourse,
  parseCourses,
  incompatibleContent,
} from "./api";
import { Page } from "./Page";
import { ContentStatus } from "./ContentStatus";
import { CourseCard } from "../product/CourseCard";
import { CourseArtwork } from "../product/CourseArtwork";
import { discoverableCourses } from "../product/course-visibility";

export function CoursesPage() {
  const { data, error } = useContent("", parseCourses);
  if (!data) return <ContentStatus error={error} />;
  const courses = discoverableCourses(data);
  return (
    <Page title="Cursos" className="product-page catalog-page">
      <h1 className="catalog-heading">Cursos</h1>
      {courses.length === 0 ? (
        <p className="empty-content text-subtle">
          Nenhum curso disponível nesta seleção.
        </p>
      ) : (
        <div className="course-list">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} headingLevel="h2" />
          ))}
        </div>
      )}
    </Page>
  );
}
export function CoursePage() {
  const { id = "" } = useParams();
  const { data: course, error } = useContent(
    "/" + encodeURIComponent(id),
    parseCourse,
  );
  if (!course || course.id !== id)
    return (
      <ContentStatus error={error || (course ? incompatibleContent : "")} />
    );
  const first = course.lessons[0];
  return (
    <Page title={course.title} className="product-page course-page">
      <nav aria-label="Caminho da página" className="mb-7">
        <Link className="back-link" to="/courses">
          ← Todos os cursos
        </Link>
      </nav>
      <header className="grid items-center gap-7 rounded-2xl border border-line bg-surface p-5 md:grid-cols-[minmax(0,1.7fr)_minmax(200px,1fr)] md:gap-10 md:p-9">
        <div>
          <p className="eyebrow mt-0 mb-3">Percurso de estudo</p>
          <h1 className="product-title">{course.title}</h1>
          <p className="mt-5 mb-5 text-base leading-relaxed text-subtle">
            {course.description}
          </p>
          <p className="mb-6 flex items-center gap-2 text-sm text-subtle">
            <BookOpen className="product-icon" aria-hidden="true" />
            {course.lessons.length}{" "}
            {course.lessons.length === 1 ? "lição" : "lições"} · No seu ritmo
          </p>
          {first && (
            <Link
              className="product-link product-primary"
              to={lessonPath(id, first.slug)}
            >
              Começar curso{" "}
              <ArrowRight className="product-icon" aria-hidden="true" />
            </Link>
          )}
        </div>
        <CourseArtwork id={id} />
      </header>
      <section
        aria-labelledby="lessons-title"
        className="mx-auto mt-10 max-w-3xl"
      >
        <div className="mb-7">
          <p className="eyebrow mb-2">
            Do primeiro conceito à próxima descoberta
          </p>
          <h2 id="lessons-title" className="m-0 text-2xl">
            Lições
          </h2>
          <p className="mb-0 text-sm leading-relaxed text-subtle">
            Siga a sequência ou entre no tema que deseja revisar.
          </p>
        </div>
        {course.lessons.length === 0 ? (
          <p className="empty-content text-subtle">
            Este curso ainda não tem lições. Elas aparecerão aqui quando você
            adicionar conteúdo ao curso.
          </p>
        ) : (
          <ol className="lesson-list m-0 list-none p-0">
            {course.lessons.map((lesson, index) => (
              <li key={lesson.slug} className="relative pb-4 last:pb-0">
                <Link
                  className="group relative flex min-h-20 items-center gap-4 rounded-xl border border-line bg-surface px-4 py-5 text-ink no-underline transition-colors hover:border-gold/60 sm:gap-5 sm:px-5"
                  to={lessonPath(id, lesson.slug)}
                >
                  <span className="lesson-number relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-bunker font-mono text-sm text-gold">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 font-medium">
                    {lesson.title}
                  </span>
                  <span
                    className="lesson-action shrink-0 text-xs text-gold sm:text-sm"
                    aria-hidden="true"
                  >
                    {index === 0 ? "Começar" : "Ler"} →
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </Page>
  );
}
