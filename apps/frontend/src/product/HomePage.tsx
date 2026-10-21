import { ArrowRight, BookOpen } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Page } from "../courses/Page";
import {
  lessonPath,
  parseCourse,
  parseCourses,
  useContent,
} from "../courses/api";
import { recentLesson, type RecentLesson } from "./recent";
import { CourseCard } from "./CourseCard";
import { ActivityDashboard } from "./ActivityDashboard";
import { discoverableCourses } from "./course-visibility";

function ContinueStudy({ recent }: { recent: RecentLesson }) {
  const { data } = useContent(
    "/" + encodeURIComponent(recent.course),
    parseCourse,
  );
  const lesson =
    data?.id === recent.course
      ? data.lessons.find((item) => item.slug === recent.slug)
      : undefined;
  if (!lesson || !data) return null;
  return (
    <section className="continue-study" aria-labelledby="continue-title">
      <h2 id="continue-title">Continuar estudando</h2>
      <Link
        to={lessonPath(recent.course, lesson.slug)}
        aria-label="Continuar estudando →"
        aria-describedby="continue-lesson"
        className="continue-link"
      >
        <BookOpen size={22} aria-hidden="true" />
        <span id="continue-lesson">
          <span className="continue-course">{data.title}</span>
          <strong>{lesson.title}</strong>
        </span>
        <ArrowRight size={20} aria-hidden="true" />
      </Link>
    </section>
  );
}
export function HomePage() {
  const { data, error } = useContent("", parseCourses);
  const [recent] = useState(recentLesson);
  const courses = data ? discoverableCourses(data) : undefined;
  return (
    <Page title="Início" className="product-page dashboard-page">
      <header className="global-page-heading">
        <p className="eyebrow">Seu espaço de estudo</p>
        <h1>Início</h1>
        <p>Retome uma lição ou escolha o próximo assunto para explorar.</p>
      </header>
      {recent && <ContinueStudy recent={recent} />}
      <ActivityDashboard />
      <section aria-labelledby="home-courses" className="home-courses">
        <div className="collection-heading">
          <h2 id="home-courses">Cursos disponíveis</h2>
          <Link className="collection-link" to="/courses">
            Explorar cursos →
          </Link>
        </div>
        {error ? (
          <div role="alert">
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>
              Tentar novamente
            </button>
          </div>
        ) : !courses ? (
          <p role="status">Carregando cursos…</p>
        ) : !courses.length ? (
          <p className="text-subtle">Nenhum curso disponível nesta seleção.</p>
        ) : (
          <div className="course-list">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}
